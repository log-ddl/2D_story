import { describe, expect, it } from "vitest";
import { numberToWords, tokenize, splitSentences } from "./text";
import { alignScriptToAsr, detectSilences, estimateAlignment, heuristicAlign, parseWhisperJson } from "./align";
import { computeTimes, retime, ruleSegment, scenesFromLlm, splitUnits, LlmResult } from "./segment";
import { Library } from "../engine/library";
import { DEMO_CAST, DEMO_SCRIPT } from "../library/demo";
import { lintModule, parseSvg } from "../engine/svg";
import { BUILTIN_MODULES } from "../library/modules";

describe("text", () => {
  it("đổi số thành chữ", () => {
    expect(numberToWords("476").join(" ")).toBe("four seventy six");
    expect(numberToWords("6,000").join(" ")).toBe("six thousand");
    expect(numberToWords("4th").join(" ")).toBe("fourth");
    expect(numberToWords("23rd").join(" ")).toBe("twenty third");
    expect(numberToWords("1st").join(" ")).toBe("first");
  });
  it("tách từ giữ dấu câu", () => {
    const t = tokenize("Land? Absolutely not!");
    expect(t.map((x) => x.punct)).toEqual(["?", "", "!"]);
    expect(splitSentences(DEMO_SCRIPT).length).toBeGreaterThan(20);
  });
});

describe("align", () => {
  it("ước lượng tăng dần, không chồng", () => {
    const a = estimateAlignment(DEMO_SCRIPT);
    for (let i = 1; i < a.words.length; i++) expect(a.words[i].start).toBeGreaterThanOrEqual(a.words[i - 1].end);
    expect(a.duration).toBeGreaterThan(30);
  });

  it("heuristic gán khoảng lặng vào cuối câu", () => {
    // audio giả: mỗi câu là một khối tiếng, giữa các câu lặng 0.3s
    const script = "One two three four. Five six seven. Eight nine ten eleven twelve.";
    const blocks = [1.6, 1.2, 2.0];
    const env: number[] = [];
    const starts: number[] = [];
    for (const b of blocks) {
      starts.push(env.length / 100);
      for (let i = 0; i < b * 100; i++) env.push(0.6 + 0.3 * Math.sin(i));
      for (let i = 0; i < 30; i++) env.push(0.01);
    }
    const al = heuristicAlign(script, Float32Array.from(env), env.length / 100);
    expect(al.words[4].start).toBeCloseTo(starts[1], 1);
    expect(al.words[7].start).toBeCloseTo(starts[2], 1);
    expect(detectSilences(Float32Array.from(env)).length).toBe(3);
  });

  it("khớp kịch bản với ASR và báo chỗ đọc lệch", () => {
    const asr = [
      { text: "Hello", start: 0, end: 0.4 },
      { text: "big", start: 0.5, end: 0.8 },
      { text: "world", start: 0.9, end: 1.3 },
    ];
    const al = alignScriptToAsr("Hello brave world.", asr, 2);
    expect(al.words.map((w) => w.start)).toEqual([0, 0.5, 0.9]);
    expect(al.mismatches[0]).toMatchObject({ index: 1, expected: "brave", heard: "big" });
  });

  it("đọc JSON whisper.cpp", () => {
    const j = { transcription: [{ offsets: { from: 0, to: 900 }, text: " Hi there", tokens: [{ text: " Hi", offsets: { from: 0, to: 300 } }, { text: " the", offsets: { from: 400, to: 600 } }, { text: "re", offsets: { from: 600, to: 900 } }] }] };
    expect(parseWhisperJson(j)).toEqual([
      { text: "Hi", start: 0, end: 0.3, conf: undefined },
      { text: "there", start: 0.4, end: 0.9, conf: undefined },
    ]);
  });
});

describe("segment", () => {
  const lib = new Library();
  const al = estimateAlignment(DEMO_SCRIPT);

  it("cảnh phủ kín từ, liên tục, thời lượng hợp lý", () => {
    const scenes = ruleSegment({ cast: DEMO_CAST, fps: 30 }, al, lib);
    expect(scenes[0].word_start).toBe(0);
    expect(scenes[scenes.length - 1].word_end).toBe(al.words.length - 1);
    for (let i = 1; i < scenes.length; i++) {
      expect(scenes[i].word_start).toBe(scenes[i - 1].word_end + 1);
      expect(scenes[i].start).toBeCloseTo(scenes[i - 1].end, 6);
    }
    for (const s of scenes) {
      expect(s.duration).toBeGreaterThan(1);
      // thời điểm cắt nằm trên lưới frame
      expect(Math.abs(s.start * 30 - Math.round(s.start * 30))).toBeLessThan(1e-6);
    }
  });

  it("đoạn ngắn được gộp", () => {
    const units = splitUnits(al.words);
    for (const u of units) expect(al.words[u.to].end - al.words[u.from].start).toBeGreaterThan(0.9);
  });

  it("cắt ở giữa khoảng lặng", () => {
    const words = [
      { text: "a.", start: 0, end: 1, conf: 1 },
      { text: "b.", start: 2, end: 3, conf: 1 },
    ];
    const t = computeTimes([{ word_start: 0, word_end: 0 }, { word_start: 1, word_end: 1 }], words, 3.5, 30);
    expect(t[1].start).toBeCloseTo(1.5, 5);
    expect(t[1].end).toBeCloseTo(3.5, 5);
  });

  it("chuẩn hóa kết quả LLM: sửa khoảng chồng, id lạ", () => {
    const res = LlmResult.parse({
      scenes: [
        { word_start: 0, word_end: 10, setting: "throne_room", characters: [{ character: "romulus", pose: "dance" }] },
        { word_start: 8, word_end: 20, setting: "khong_co", characters: [{ character: "ghost" }] },
      ],
    });
    const { scenes, warnings } = scenesFromLlm(res, al, 30, lib, ["stand", "sit"], ["neutral"]);
    expect(scenes[1].word_start).toBe(11);
    expect(scenes[1].word_end).toBe(al.words.length - 1);
    expect(scenes[0].characters[0].pose).toBe("stand");
    expect(scenes[1].background.setting).toBe("title_card");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("retime giữ nội dung khi đổi voice", () => {
    const scenes = ruleSegment({ cast: DEMO_CAST, fps: 30 }, al, lib);
    const slower = { ...al, duration: al.duration * 1.5, words: al.words.map((w) => ({ ...w, start: w.start * 1.5, end: w.end * 1.5 })) };
    const re = retime(scenes, slower, 30);
    expect(re.length).toBe(scenes.length);
    expect(re[re.length - 1].end).toBeGreaterThan(scenes[scenes.length - 1].end * 1.4);
    expect(re[3].narration).toBe(scenes[3].narration);
  });
});

describe("svg", () => {
  it("mọi module có sẵn đều parse được và qua linter", () => {
    for (const m of BUILTIN_MODULES) {
      expect(() => parseSvg(m.svg)).not.toThrow();
      expect(lintModule(m.svg).filter((i) => i.level === "error")).toEqual([]);
    }
  });
  it("linter chặn ảnh raster/script", () => {
    const bad = `<svg viewBox="0 0 10 10"><image href="x.png"/><script>alert(1)</script></svg>`;
    expect(lintModule(bad).some((i) => i.level === "error")).toBe(true);
  });
});
