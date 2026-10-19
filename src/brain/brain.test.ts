import { describe, expect, it } from "vitest";
import { applyCast, castPrompt, castSchema, proposeCast, scopedLibrary, segmentScenes, drawModuleSvg, type BrainRunner } from "./index";
import { Library } from "../engine/library";
import { DEMO_SCRIPT } from "../library/demo";
import { estimateAlignment } from "../pipeline/align";
import { scenesFromLlm } from "../pipeline/segment";
import { EXPRESSIONS, POSES } from "../engine/character";
import { Episode, Project } from "../schema";

const lib = new Library();
const fixed = (obj: unknown): BrainRunner & { calls: { prompt: string; schema: string }[] } => {
  const calls: { prompt: string; schema: string }[] = [];
  const f = (async (prompt: string, schema: string) => {
    calls.push({ prompt, schema });
    return JSON.stringify(obj);
  }) as BrainRunner & { calls: typeof calls };
  f.calls = calls;
  return f;
};

const proposal = {
  style: { grade: "warm", subtitle: "clean", note: "hài hước, nhịp nhanh" },
  characters: [
    { reuse_id: "romulus", id: "romulus", name: "Romulus", role: "vua nhí", aliases: ["romulus"], age: "kid", build: "normal", skin: "#f8d2ae", hair_style: "bowl", hair_color: "#f2c14e", beard_style: "none", beard_color: "#000000", outfit_type: "royal", outfit_color: "#6c3fb0", outfit_trim: "#f2c14e", headwear: "crown", cape: null, hand_prop: null, generator: false, draw_svg: false, visual: "" },
    { reuse_id: null, id: "Julius Nepos", name: "Julius Nepos", role: "hoàng đế bị lật", aliases: ["nepos"], age: "adult", build: "slim", skin: "#eab88f", hair_style: "short", hair_color: "#3b2a1e", beard_style: "goatee", beard_color: "#3b2a1e", outfit_type: "royal", outfit_color: "#8f2d56", outfit_trim: "#f2c14e", headwear: "laurel", cape: "#7a2433", hand_prop: "scroll", generator: false, draw_svg: false, visual: "" },
  ],
  settings: [
    { reuse_id: "throne_room", id: "throne_room", name: "Điện", description: "", based_on: "throne_room", tags: [], backdrop_color: null, ground_color: null, base_lighting: "day", extra_items: [] },
    { reuse_id: null, id: "senate_hall", name: "Viện nguyên lão", description: "Hội trường cột đá", based_on: "palace_gate", tags: ["senate", "nguyên lão"], backdrop_color: "#d9c7a0", ground_color: "#bfa27a", base_lighting: "day", extra_items: [{ module: "amphora", x: 200, y: 1500, scale: 1, flip: false }] },
  ],
};

describe("brain", () => {
  it("schema đề xuất là JSON schema hợp lệ và prompt có kịch bản + thư viện", async () => {
    const run = fixed(proposal);
    const p = await proposeCast(run, DEMO_SCRIPT, lib, "16:9");
    expect(p.characters).toHaveLength(2);
    const schema = JSON.parse(run.calls[0].schema);
    expect(schema.type).toBe("object");
    expect(schema.properties.characters.items.properties.headwear.enum).toContain("crown");
    expect(run.calls[0].prompt).toContain("September 4th");
    expect(run.calls[0].prompt).toContain("throne_room");
    expect(castPrompt(DEMO_SCRIPT, lib, "16:9")).toContain("16:9");
  });

  it("áp đề xuất: dùng lại + tạo mới nhân vật/bối cảnh, lưu vào dự án", () => {
    const p = castSchema(lib).parse(proposal);
    const project = Project.parse({ id: "p", name: "x" });
    const ep = Episode.parse({ id: "e", title: "t", script_text: DEMO_SCRIPT });
    const r = applyCast(p, project, ep, lib);
    expect(r.episode.cast).toEqual(["romulus", "julius_nepos"]);
    expect(r.project.characters[0].id).toBe("julius_nepos");
    expect(r.project.characters[0].aliases).toContain("nepos");
    expect(r.episode.sets).toEqual(["throne_room", "senate_hall"]);
    const hall = r.project.settings[0];
    expect(hall.layers[0].fill).toBe("#d9c7a0");
    expect(hall.layers.at(-1)!.items.some((i) => i.module === "amphora")).toBe(true);
    expect(r.episode.style).toMatchObject({ grade: "warm", subtitle: "clean" });
    // thư viện mới nhận nhân vật/bối cảnh vừa tạo
    const lib2 = new Library(r.project);
    expect(lib2.getCharacter("julius_nepos")?.headwear).toBe("laurel");
    expect(scopedLibrary(lib2, r.episode).settings.has("senate_hall")).toBe(true);
    expect(scopedLibrary(lib2, r.episode).settings.has("army_camp")).toBe(false);
  });

  it("chia cảnh qua bộ não chỉ thấy dàn của tập; kết quả được chuẩn hóa", async () => {
    const al = estimateAlignment(DEMO_SCRIPT);
    const n = al.words.length;
    const reply = {
      scenes: [
        { word_start: 0, word_end: 3, beat: "number", narration_vi: "", description: "", setting: "throne_room", weather: "sparkles", lighting: "auto", shot: "wide", move: "push_in", characters: [{ character: "romulus", mark: "A", pose: "sit", expression: "worried", speaking: false, flip: false }], overlays: [{ text: "476 AD", style: "banner", at_word: 2 }], transition: "cut", missing_module: null },
        { word_start: 4, word_end: n - 1, beat: "lạ", narration_vi: "", description: "", setting: "army_camp", weather: "mưa", lighting: "auto", shot: "medium", move: "static", characters: [], overlays: [], transition: "whip", missing_module: null },
      ],
    };
    const run = fixed(reply);
    const ep = Episode.parse({ id: "e", title: "t", script_text: DEMO_SCRIPT, cast: ["romulus"], sets: ["throne_room"], style: { note: "nhịp nhanh" } });
    const raw = await segmentScenes(run, al.words, lib, ep);
    expect(run.calls[0].prompt).toContain("nhịp nhanh");
    expect(run.calls[0].prompt).not.toContain("- odoacer:");
    const { scenes, warnings } = scenesFromLlm(raw, al, 30, scopedLibrary(lib, ep), Object.keys(POSES), Object.keys(EXPRESSIONS));
    expect(scenes).toHaveLength(2);
    expect(scenes[1].beat).toBe("context");
    expect(scenes[1].background.weather).toBe("clear");
    expect(scenes[1].background.setting).toBe("title_card"); // army_camp nằm ngoài dàn của tập
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("vẽ SVG: thử lại khi linter báo lỗi", async () => {
    let n = 0;
    const run: BrainRunner = async () => {
      n++;
      const svg = n === 1 ? `<svg><image href="x.png"/></svg>` : `<svg viewBox="-50 -100 100 100"><g stroke="#2b2233" stroke-width="6"><circle cx="0" cy="-50" r="40" fill="#f2c14e"/></g></svg>`;
      return JSON.stringify({ id: "sun_small", tags: ["sun"], svg, notes: "" });
    };
    const r = await drawModuleSvg(run, "mặt trời nhỏ");
    expect(n).toBe(2);
    expect(r.errors).toEqual([]);
  });

  it("đọc được JSON lẫn trong văn bản khi CLI không hỗ trợ schema", async () => {
    const run: BrainRunner = async () => `Đây là kết quả:\n${JSON.stringify(proposal)}\nXong.`;
    const p = await proposeCast(run, DEMO_SCRIPT, lib, "9:16");
    expect(p.settings[1].id).toBe("senate_hall");
  });
});

describe("brief", () => {
  it("prompt dùng hướng dẫn riêng, rỗng thì dùng mặc định", async () => {
    const { castPrompt, DEFAULT_BRIEF } = await import("./index");
    expect(castPrompt("x", lib, "9:16", "")).toContain(DEFAULT_BRIEF.slice(0, 30));
    const custom = castPrompt("x", lib, "9:16", "giọng hài, không dùng bản đồ");
    expect(custom).toContain("không dùng bản đồ");
    expect(custom).not.toContain(DEFAULT_BRIEF.slice(0, 30));
  });
});
