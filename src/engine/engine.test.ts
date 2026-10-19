import { describe, expect, it } from "vitest";
import { evalActors, evalProps, resolveTarget, visemeAt } from "./actions";
import { frameFor } from "./frame";
import { Library } from "./library";
import { lintRig, aimArm } from "./character";
import { Scene } from "../schema";

const lib = new Library();
const words = [
  { text: "Odoacer", start: 0.5, end: 1, conf: 1 },
  { text: "marches.", start: 1.1, end: 1.6, conf: 1 },
];
const mk = (extra: Record<string, unknown>) => Scene.parse({ id: "s", word_start: 0, word_end: 1, narration: "", start: 0, end: 5, duration: 5, background: { setting: "throne_room" }, ...extra });

describe("actions", () => {
  const f = frameFor("9:16");
  const setting = lib.getSetting("throne_room");

  it("resolve đích theo tên, lần xuất hiện, đạo cụ", () => {
    const sc = mk({ characters: [{ character: "legionary" }, { character: "legionary", mark: "C" }], props: [{ module: "coin_pile", x: 1, y: 1 }] });
    expect(resolveTarget(sc, "legionary")).toEqual({ kind: "char", idx: 0 });
    expect(resolveTarget(sc, "legionary#2")).toEqual({ kind: "char", idx: 1 });
    expect(resolveTarget(sc, "prop:coin_pile")).toEqual({ kind: "prop", idx: 0 });
    expect(resolveTarget(sc, "odoacer")).toBeNull();
  });

  it("đi vào khung: trước đó ở ngoài khung, sau đó đứng đúng mark và đang/không còn đi", () => {
    const sc = mk({ characters: [{ character: "odoacer", mark: "C" }], actions: [{ target: "odoacer", verb: "enter", value: "right", at_word: 1, duration: 1 }] });
    const base = [{ x: 860, y: 1600, scale: 1.6, flip: false, pose: "stand", expression: "neutral" }];
    const before = evalActors(sc, base, 0.5, words, setting, f)[0];
    expect(before.x).toBeGreaterThan(1080);
    const mid = evalActors(sc, base, 1.6, words, setting, f)[0];
    expect(mid.walking).toBe(true);
    expect(mid.flip).toBe(true); // đi từ phải sang trái → quay mặt sang trái
    const after = evalActors(sc, base, 3, words, setting, f)[0];
    expect(after.x).toBeCloseTo(860, 3);
    expect(after.walking).toBe(false);
  });

  it("ngã giữ nguyên sau khi kết thúc; đổi nét mặt đúng lúc", () => {
    const sc = mk({ characters: [{ character: "orestes" }], actions: [{ target: "orestes", verb: "fall", delay: 1, duration: 0.5 }, { target: "orestes", verb: "emote", value: "scared", delay: 0.5 }] });
    const base = [{ x: 540, y: 1500, scale: 1.5, flip: false, pose: "stand", expression: "neutral" }];
    expect(evalActors(sc, base, 0.2, words, setting, f)[0].expression).toBe("neutral");
    const s1 = evalActors(sc, base, 4, words, setting, f)[0];
    expect(s1.expression).toBe("scared");
    expect(Math.abs(s1.rot)).toBeGreaterThan(1.4);
  });

  it("đạo cụ rơi: ẩn trước khi rơi, nằm đúng chỗ sau khi nảy", () => {
    const sc = mk({ props: [{ module: "coin_pile", x: 760, y: 1700 }], actions: [{ target: "prop:coin_pile", verb: "drop", delay: 1, duration: 1 }] });
    expect(evalProps(sc, 0.5, words, f)[0].alpha).toBe(0);
    const mid = evalProps(sc, 1.2, words, f)[0];
    expect(mid.y).toBeLessThan(1700);
    expect(evalProps(sc, 3, words, f)[0].y).toBeCloseTo(1700, 3);
  });

  it("âm vị miệng", () => {
    expect(visemeAt("moon", 0)).toBe("m");
    expect(visemeAt("moon", 0.4)).toBe("o");
    expect(visemeAt("see", 0.9)).toBe("e");
  });

  it("IK: chỉ ngang ra ngoài → ~90°", () => {
    expect(aimArm([50, -100], { x: 300, y: -100 }, 1)[0]).toBeCloseTo(90, 0);
    expect(aimArm([50, -100], { x: 50, y: 200 }, 1)[0]).toBeCloseTo(0, 0);
  });

  it("robot mẫu có đủ khung xương", () => {
    expect(lintRig(lib.getModule("robot_rig")!)).toEqual([]);
  });
});
