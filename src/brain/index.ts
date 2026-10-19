// "Bộ não" của fxcine: các tác vụ suy luận (đề xuất nhân vật/bối cảnh/phong cách, chia cảnh,
// vẽ module SVG, dịch) chạy qua CLI AI cài trên máy (claude / codex / agy), không gọi API trực tiếp.
// File này chỉ chứa prompt + schema + hàm áp kết quả (thuần, test được).

import { z } from "zod";
import { EXPRESSIONS, POSES } from "../engine/character";
import { GRADES } from "../engine/effects";
import type { Library } from "../engine/library";
import { darken, lighten } from "../engine/math";
import { lintModule } from "../engine/svg";
import { SUBTITLE_STYLES } from "../engine/text";
import { BUILTIN_MODULES } from "../library/modules";
import { CharacterSpec, LIGHTINGS, SettingSpec, type Episode, type Project, type Word } from "../schema";
import { buildSegmentPrompt, LlmResult } from "../pipeline/segment";

export const BRAIN_CLIS = ["claude", "codex", "agy"] as const;
export type BrainCli = (typeof BRAIN_CLIS)[number];

/** Hàm chạy một lượt CLI: nhận prompt + JSON schema, trả chuỗi JSON */
export type BrainRunner = (prompt: string, jsonSchema: string) => Promise<string>;

export const HAIR_STYLES = ["short", "bowl", "curly", "spiky", "long", "fringe", "bald"] as const;
export const BEARD_STYLES = ["none", "full", "long", "goatee", "mustache", "stubble"] as const;
export const OUTFITS = ["tunic", "toga", "armor", "robe", "royal"] as const;

const enumOf = (ids: string[]) => z.enum(ids as [string, ...string[]]);

function schemaString(s: z.ZodType) {
  const js = z.toJSONSchema(s) as Record<string, unknown>;
  delete js.$schema;
  return JSON.stringify(js);
}

async function ask<T>(run: BrainRunner, prompt: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await run(prompt, schemaString(schema));
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // CLI không hỗ trợ structured output → lấy khối JSON trong văn bản
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error(`Bộ não không trả về JSON: ${raw.slice(0, 200)}`);
    data = JSON.parse(raw.slice(a, b + 1));
  }
  return schema.parse(data);
}

/** Hướng dẫn phân tích mặc định — người dùng có thể thay bằng prompt riêng ở bước Kịch bản */
export const DEFAULT_BRIEF = `- Video ngắn kể chuyện: cảnh đầu là hook mạnh (câu hỏi, con số gây sốc), giữ nhịp nhanh, cảnh cuối kêu gọi theo dõi.
- Mỗi cảnh 1.2–4 giây, cắt ở ranh giới ý nghĩa; đổi cỡ cảnh (toàn/trung/cận) để không nhàm.
- Nhân vật chính xuất hiện xuyên suốt; nét mặt và tư thế bám theo cảm xúc của câu.
- Năm, ngày, con số quan trọng hiện thành chữ trên màn hình đúng lúc được đọc.
- Dùng lại nhân vật và bối cảnh có sẵn nếu hợp; chỉ tạo mới khi thật sự cần.`;

const briefBlock = (brief: string) => `\nHƯỚNG DẪN PHÂN TÍCH (ưu tiên cao nhất, theo người dùng):\n${brief.trim() || DEFAULT_BRIEF}\n`;

const RULES = `Bạn là bộ não của fxcine — studio làm video hoạt hình chibi vector (SVG + hàm toán học) cho YouTube/TikTok.
KHÔNG dùng công cụ, KHÔNG đọc/ghi file. Chỉ trả lời bằng JSON đúng schema được yêu cầu.`;

// ───────── 1. Đề xuất dàn nhân vật + bối cảnh + phong cách ─────────

export function castSchema(lib: Library) {
  const headwear = ["none", ...lib.moduleDefs.filter((m) => m.kind === "headwear").map((m) => m.id)];
  const hand = lib.moduleDefs.filter((m) => m.kind === "hand").map((m) => m.id);
  const settings = [...lib.settings.keys()];
  return z.object({
    style: z.object({ grade: z.enum(GRADES), subtitle: z.enum(SUBTITLE_STYLES), note: z.string() }),
    characters: z.array(
      z.object({
        reuse_id: z.string().nullable(),
        id: z.string(),
        name: z.string(),
        role: z.string(),
        aliases: z.array(z.string()),
        age: z.enum(["kid", "adult", "old"]),
        build: z.enum(["slim", "normal", "stocky"]),
        skin: z.string(),
        hair_style: z.enum(HAIR_STYLES),
        hair_color: z.string(),
        beard_style: z.enum(BEARD_STYLES),
        beard_color: z.string(),
        outfit_type: z.enum(OUTFITS),
        outfit_color: z.string(),
        outfit_trim: z.string(),
        headwear: enumOf(headwear),
        cape: z.string().nullable(),
        hand_prop: enumOf(hand).nullable(),
        generator: z.boolean(),
        /** true khi nhân vật không dựng được bằng tham số người chibi (con vật, robot, quái vật…) → bộ não vẽ SVG có khung xương */
        draw_svg: z.boolean(),
        visual: z.string(),
      }),
    ),
    settings: z.array(
      z.object({
        reuse_id: z.string().nullable(),
        id: z.string(),
        name: z.string(),
        description: z.string(),
        based_on: enumOf(settings),
        clear_base_items: z.boolean().default(false),
        tags: z.array(z.string()),
        backdrop_color: z.string().nullable(),
        ground_color: z.string().nullable(),
        base_lighting: z.enum(LIGHTINGS),
        extra_items: z.array(z.object({ module: z.string(), x: z.number(), y: z.number(), scale: z.number(), flip: z.boolean() })),
      }),
    ),
    new_modules: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          kind: z.enum(["prop", "scenery", "headwear", "hand"]).default("prop"),
          visual: z.string(),
        }),
      )
      .default([]),
  });
}
export type CastProposal = z.infer<ReturnType<typeof castSchema>>;

export function castPrompt(script: string, lib: Library, aspect: string, brief = ""): string {
  const chars = [...lib.characters.values()].map((c) => `- ${c.id}: ${c.name} (${c.age}, ${c.outfit.type}, tóc ${c.hair.style}${c.generator ? ", nhân vật phụ sinh biến thể" : ""}) — alias: ${c.aliases.join(", ")}`).join("\n");
  const sets = [...lib.settings.values()].map((s) => `- ${s.id}: ${s.name} — ${s.tags.slice(0, 8).join(", ")} — đã có: ${[...new Set(s.layers.flatMap((l) => l.items.map((i) => i.module)))].join(", ") || "nền trơn"}`).join("\n");
  const mods = lib.moduleDefs.map((m) => `${m.id}(${m.kind})`).join(", ");
  return `${RULES}

NHIỆM VỤ: đọc kịch bản và lập "bible" cho tập phim: dàn nhân vật, các bối cảnh, đạo cụ đặc trưng, phong cách hình ảnh.
Khung hình: ${aspect}.
${briefBlock(brief)}
KỊCH BẢN:
"""
${script}
"""

NHÂN VẬT ĐÃ CÓ TRONG THƯ VIỆN (chỉ dùng lại khi đúng nhân vật/bối cảnh văn hóa — đặt reuse_id = id):
${chars}

BỐI CẢNH ĐÃ CÓ (ưu tiên chọn bối cảnh đúng địa hình — reuse_id = id hoặc based_on = id đó):
${sets}

MODULE SVG CÓ SẴN (đạo cụ thêm vào bối cảnh hoặc diễn trong phân cảnh): ${mods}

QUY TẮC:
- Mỗi nhân vật có lời thoại/được nhắc tên là một nhân vật riêng; đám đông (lính, quân sĩ, dân) dùng nhân vật generator=true.
- TUYỆT ĐỐI KHÔNG dùng lại nhân vật "robot" hoặc các nhân vật La Mã (romulus, orestes, odoacer, caesar, senator, nepotes) cho kịch bản lịch sử Việt Nam / Á Đông hoặc chủ đề không liên quan. Không tự bịa nhân vật "Người dẫn chuyện" bằng robot.
- Nhân vật không phải người chibi (con vật, robot, quái vật, đồ vật biết nói) → draw_svg = true và mô tả ngoại hình trong visual; người bình thường → draw_svg = false.
- aliases: mọi cách kịch bản gọi nhân vật đó (tiếng Anh/Việt, chữ thường), để nhận ra trong lời dẫn.
- Màu dạng #rrggbb, hài hòa, tươi theo style chibi. id dạng snake_case tiếng Anh, không trùng.
- Dùng lại nguyên trạng: reuse_id = id, clear_base_items = false, backdrop_color = null, ground_color = null, extra_items = []. Chỉ đổi màu/thêm đạo cụ khi bối cảnh thật sự khác (khi đó reuse_id = null và đặt id mới).
- QUAN TRỌNG VỀ BỐI CẢNH MỚI: nếu mượn based_on nhưng bối cảnh gốc có vật thể lệch văn hóa/chủ đề (ví dụ mượn seaside_villa có villa La Mã, cypress, amphora để làm cửa biển/sông; hoặc mượn palace_gate có cột đá La Mã), BẮT BUỘC đặt clear_base_items = true để xóa vật thể gốc rồi tự đặt extra_items phù hợp. Với cảnh sông nước/thủy chiến/bãi cọc, ưu tiên based_on = "river_estuary" hoặc "river_stakes".
- ĐẠO CỤ / MODULE MỚI (new_modules): nếu kịch bản nhắc tới vật thể/đạo cụ quan trọng (ví dụ: thuyền, cọc gỗ, trống trận, vũ khí, biểu tượng, vật phẩm...) mà CHƯA CÓ trong MODULE SVG CÓ SẴN, hãy khai báo vào new_modules (tối đa 5 module, id snake_case tiếng Anh, kind = "prop" hoặc "scenery", visual mô tả hình dáng rõ ràng) để hệ thống tự vẽ SVG. Bạn có thể dùng ngay id của new_modules trong extra_items của bối cảnh.
- extra_items KHÔNG lặp lại vật đã có trong based_on (trừ khi clear_base_items = true); đặt ở chỗ trống, không che giữa sân khấu (x 380–700) nơi nhân vật đứng.
- Không cần đưa title_card vào danh sách (luôn có sẵn).
- Bối cảnh mới: chọn based_on là bối cảnh gần nhất, đổi màu nền/mặt đất nếu cần, thêm tối đa 6 đạo cụ (tọa độ thiết kế 1080×1920, đáy giữa vật thể; mặt đất khoảng y 1250–1500; x 80–1000).
- 3–7 bối cảnh là đủ cho video ngắn; mỗi bối cảnh có tags (tiếng Anh + Việt) để chia cảnh tìm được.
- style.grade: tông màu tổng thể; style.subtitle: karaoke (sôi động), clean (tài liệu), pop (từng từ, rất nhanh); style.note: 1 câu mô tả phong cách.`;
}

export function proposeCast(run: BrainRunner, script: string, lib: Library, aspect: string, brief = "") {
  return ask(run, castPrompt(script, lib, aspect, brief), castSchema(lib));
}

const uniqueId = (id: string, taken: Set<string>) => {
  let base = id.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "item";
  let out = base;
  for (let i = 2; taken.has(out); i++) out = `${base}_${i}`;
  taken.add(out);
  return out;
};

export interface ToDrawModule {
  id: string;
  label: string;
  kind: "prop" | "scenery" | "headwear" | "hand";
  visual: string;
}

/** Áp đề xuất vào dự án (dùng lại được cho các tập sau) và tập hiện tại */
export function applyCast(
  p: CastProposal,
  project: Project,
  ep: Episode,
  lib: Library,
): {
  project: Project;
  episode: Episode;
  created: { characters: number; settings: number };
  toDraw: { id: string; visual: string }[];
  toDrawModules: ToDrawModule[];
} {
  const charIds = new Set(lib.characters.keys());
  const setIds = new Set(lib.settings.keys());
  const modIds = new Set(lib.moduleDefs.map((m) => m.id));
  const scriptLower = (ep.script_text || "").toLowerCase();
  const newChars: CharacterSpec[] = [];
  const cast: string[] = [];
  const toDraw: { id: string; visual: string }[] = [];
  const toDrawModules: ToDrawModule[] = [];
  const moduleIdMap = new Map<string, string>();

  for (const m of p.new_modules ?? []) {
    const clean = m.id.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!clean) continue;
    if (modIds.has(clean)) {
      moduleIdMap.set(m.id, clean);
      continue;
    }
    const id = uniqueId(clean, modIds);
    moduleIdMap.set(m.id, id);
    toDrawModules.push({ id, label: m.label || id, kind: m.kind, visual: m.visual || m.label || id });
  }

  for (const c of p.characters) {
    if (c.reuse_id === "robot" && !/\b(robot|người máy|ai|bot)\b/i.test(scriptLower)) {
      continue;
    }
    if (c.reuse_id && lib.characters.has(c.reuse_id)) {
      cast.push(c.reuse_id);
      continue;
    }
    const spec = CharacterSpec.parse({
      id: uniqueId(c.id, charIds),
      name: c.name,
      aliases: [...new Set([c.name.toLowerCase(), ...c.aliases.map((a) => a.toLowerCase())])],
      age: c.age,
      build: c.build,
      skin: c.skin,
      hair: { style: c.hair_style, color: c.hair_color },
      beard: { style: c.beard_style, color: c.beard_color },
      outfit: { type: c.outfit_type, color: c.outfit_color, trim: c.outfit_trim },
      headwear: c.headwear,
      cape: c.cape,
      hand_prop: c.hand_prop,
      generator: c.generator,
    });
    newChars.push(spec);
    cast.push(spec.id);
    if (c.draw_svg) toDraw.push({ id: spec.id, visual: c.visual || c.name });
  }
  const newSets: SettingSpec[] = [];
  const sets: string[] = [];
  for (const s of p.settings) {
    if (s.reuse_id && lib.settings.has(s.reuse_id) && !s.extra_items.length && !s.backdrop_color && !s.ground_color && !s.clear_base_items) {
      sets.push(s.reuse_id);
      continue;
    }
    const base = structuredClone(lib.getSetting(s.based_on));
    const layers = base.layers.map((l, i) => {
      const out = { ...l };
      if (s.clear_base_items) {
        out.items = i === 0 ? out.items.filter((it) => it.module === "sun" || it.module === "cloud") : [];
      }
      if (i === 0 && s.backdrop_color) {
        if (out.sky) out.sky = [s.backdrop_color, lighten(s.backdrop_color, 0.55)];
        else out.fill = s.backdrop_color;
      }
      if (out.ground && s.ground_color) out.ground = { ...out.ground, color: s.ground_color, edge: darken(s.ground_color, 0.18) };
      return out;
    });
    const last = layers[layers.length - 1];
    const existing = new Set(layers.flatMap((l) => l.items.map((i) => i.module)));
    const extras = s.extra_items
      .map((it) => ({ ...it, module: moduleIdMap.get(it.module) ?? it.module }))
      .filter((it) => modIds.has(it.module) && (s.clear_base_items || !existing.has(it.module)))
      .slice(0, 6);
    last.items = [...last.items, ...extras.map((it) => ({ module: it.module, x: it.x, y: it.y, scale: Math.max(0.2, Math.min(3, it.scale)), flip: it.flip, rot: 0 }))];
    const spec = SettingSpec.parse({ ...base, id: uniqueId(s.id, setIds), name: s.name, description: s.description, tags: [...new Set([...s.tags, ...base.tags])], base_lighting: s.base_lighting, layers });
    newSets.push(spec);
    sets.push(spec.id);
  }
  return {
    project: { ...project, characters: [...project.characters, ...newChars], settings: [...project.settings, ...newSets] },
    episode: { ...ep, cast: [...new Set(cast)], sets: [...new Set(sets)], style: { ...ep.style, grade: p.style.grade, subtitle: p.style.subtitle, note: p.style.note } },
    created: { characters: newChars.length, settings: newSets.length },
    toDraw,
    toDrawModules,
  };
}

// ───────── 2. Chia cảnh ─────────

const SegmentSchema = z.object({
  scenes: z.array(
    z.object({
      word_start: z.number().int(),
      word_end: z.number().int(),
      beat: z.string(),
      narration_vi: z.string(),
      description: z.string(),
      setting: z.string(),
      weather: z.string(),
      lighting: z.string(),
      shot: z.string(),
      move: z.string(),
      characters: z.array(z.object({ character: z.string(), mark: z.string(), pose: z.string(), expression: z.string(), speaking: z.boolean(), flip: z.boolean() })),
      overlays: z.array(z.object({ text: z.string(), style: z.string(), at_word: z.number().int().nullable() })),
      props: z.array(z.object({ module: z.string(), x: z.number(), y: z.number(), scale: z.number() })).default([]),
      actions: z.array(z.object({ target: z.string(), verb: z.string(), at_word: z.number().int().nullable(), duration: z.number(), to: z.string().nullable(), value: z.string().nullable() })).default([]),
      transition: z.string(),
      missing_module: z.string().nullable(),
    }),
  ),
});

/** Thư viện thu hẹp theo dàn nhân vật/bối cảnh của tập (nếu đã chọn) */
export function scopedLibrary(lib: Library, ep: Pick<Episode, "cast" | "sets">) {
  const characters = ep.cast.length ? new Map([...lib.characters].filter(([k]) => ep.cast.includes(k))) : lib.characters;
  const settings = ep.sets.length ? new Map([...lib.settings].filter(([k]) => ep.sets.includes(k) || k === "title_card")) : lib.settings;
  return { characters, settings, moduleDefs: lib.moduleDefs };
}

export async function segmentScenes(run: BrainRunner, words: Word[], lib: Library, ep: Episode) {
  const scoped = scopedLibrary(lib, ep);
  const { system, user } = buildSegmentPrompt(words, scoped, Object.keys(POSES), Object.keys(EXPRESSIONS));
  const style = ep.style.note ? `\nPHONG CÁCH TẬP: ${ep.style.note}` : "";
  const raw = await ask(run, `${RULES}\n\n${system}${style}\nKhung hình: ${ep.aspect}.\n${briefBlock(ep.brief)}\n${user}`, SegmentSchema);
  // enum cụ thể được kiểm tra lỏng ở LlmResult (giá trị lạ → mặc định)
  return LlmResult.parse(raw);
}

// ───────── 3. Vẽ module SVG ─────────

export const SvgResult = z.object({ id: z.string(), tags: z.array(z.string()), svg: z.string(), notes: z.string() });

const KIND_RULES: Record<string, string> = {
  prop: "Đạo cụ/cảnh vật đứng trên mặt đất hoặc mặt nước: gốc (0,0) ở đáy giữa, khai báo data-anchor=\"0 0\".",
  scenery: "Cảnh vật lớn đặt trong bối cảnh: gốc (0,0) ở đáy giữa, khai báo data-anchor=\"0 0\".",
  headwear: "Đồ đội đầu: hệ tọa độ đầu nhân vật, tâm đầu (0,0), bán kính đầu 100 (đỉnh đầu y≈-96), data-anchor=\"0 0\".",
  hand: "Đồ cầm tay: gốc (0,0) là chỗ bàn tay nắm, vật hướng lên trên (y âm), data-anchor=\"0 0\", dài 100–330.",
};

export async function drawModuleSvg(run: BrainRunner, request: string, kind: "prop" | "scenery" | "headwear" | "hand" = "prop") {
  const examples = BUILTIN_MODULES.filter((m) => ["coin_pile", "tent", "amphora", "chest"].includes(m.id))
    .map((m) => `<!-- ${m.id} -->\n${m.svg}`)
    .join("\n\n");
  let prompt = `${RULES}

NHIỆM VỤ: vẽ một module SVG cho thư viện: ${request}

QUY ƯỚC BẮT BUỘC:
- Chỉ dùng <svg>, <g>, <path>, <rect>, <circle>, <ellipse>, <polygon>, <polyline>, <line>. Không <text>, <image>, gradient, filter, script.
- Viền stroke="#2b2233", stroke-width 5–7, stroke-linejoin="round". Màu phẳng, tươi, 3–6 màu.
- viewBox ôm vật thể. ${KIND_RULES[kind]}
- Cỡ 150–600 đơn vị, dưới 120 phần tử, khối tròn trịa dễ thương.
- id snake_case tiếng Anh; tags 3–6 từ khóa (Anh + Việt).

VÍ DỤ ĐÚNG STYLE:
${examples}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await ask(run, prompt, SvgResult);
    const errors = lintModule(r.svg).filter((i) => i.level === "error");
    if (!errors.length || attempt === 1) return { ...r, errors: errors.map((e) => e.message) };
    prompt += `\n\nBẢN TRƯỚC LỖI: ${errors.map((e) => e.message).join("; ")}. Vẽ lại cho đúng quy ước.`;
  }
  throw new Error("unreachable");
}

// ───────── 4. Dịch lời dẫn ─────────

export async function translateLines(run: BrainRunner, lines: string[]): Promise<string[]> {
  const r = await ask(run, `${RULES}\n\nDịch từng dòng lời dẫn video sang tiếng Việt tự nhiên, ngắn gọn. Giữ đúng số dòng (${lines.length}) và thứ tự.\n\n${JSON.stringify(lines)}`, z.object({ vi: z.array(z.string()) }));
  return r.vi;
}

// ───────── 5. Vẽ nhân vật SVG có khung xương ─────────

export const RigResult = z.object({ id: z.string(), name: z.string(), aliases: z.array(z.string()), svg: z.string(), notes: z.string() });

export async function drawCharacterSvg(run: BrainRunner, description: string, compile: (svg: string) => string[]) {
  const example = BUILTIN_MODULES.find((m) => m.id === "robot_rig")!.svg;
  let prompt = `${RULES}

NHIỆM VỤ: vẽ một nhân vật hoạt hình chibi dạng SVG CÓ KHUNG XƯƠNG để engine tự cử động: ${description}

QUY ƯỚC KHUNG XƯƠNG (bắt buộc):
- viewBox có gốc (0,0) ở giữa hai bàn chân, data-anchor="0 0"; nhân vật cao 330–420 đơn vị (y âm hướng lên), rộng ≤ 300.
- Các nhóm <g> theo thứ tự vẽ: leg_L, leg_R, arm_L, body, arm_R, head (tay trước thân thì đặt sau body).
- Mỗi nhóm leg_L, leg_R, arm_L, arm_R, head có data-pivot="x y" = tọa độ khớp (hông, vai, cổ). Tay/chân vẽ ở tư thế buông thẳng xuống.
- Nhóm head chứa mặt; trong head có eyes_open và eyes_closed (chớp mắt), mouth_closed và mouth_open (nói). Nhóm tail tùy chọn (có data-pivot).
- Con vật 4 chân: coi chân trước là arm_L/arm_R, chân sau là leg_L/leg_R.
- Style: viền stroke="#2b2233" stroke-width 5–7, màu phẳng tươi, đầu to (chibi), không <text>/<image>/gradient.
- id snake_case tiếng Anh; aliases: các cách gọi trong lời dẫn.

VÍ DỤ ĐÚNG QUY ƯỚC (robot):
${example}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await ask(run, prompt, RigResult);
    const errors = [...lintModule(r.svg).filter((i) => i.level === "error").map((i) => i.message), ...compile(r.svg)];
    if (!errors.length || attempt === 1) return { ...r, errors };
    prompt += `\n\nBẢN TRƯỚC LỖI: ${errors.join("; ")}. Vẽ lại cho đúng quy ước.`;
  }
  throw new Error("unreachable");
}
