// Ảnh kiểm tra: cùng một cảnh ở 4 tỷ lệ khung → out/aspects.png
import { writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { ASPECT_LIST, outputSize } from "../src/engine/frame";
import { Episode, Scene } from "../src/schema";

const lib = new Library();
const S = (s: Record<string, unknown>) => Scene.parse({ id: "x", word_start: 0, word_end: 0, narration: "", start: 0, end: 4, duration: 4, camera: { shot: "wide", move: "static" }, ...s });
const scenes = [
  S({ background: { setting: "throne_room", weather: "sparkles", lighting: "auto" }, characters: [{ character: "romulus", mark: "A", pose: "sit", expression: "worried" }, { character: "orestes", mark: "C", pose: "hands_hips", expression: "smug", flip: true }, { character: "senator", mark: "B", pose: "point", expression: "laugh" }], overlays: [{ text: "476 AD", style: "banner", at_word: null }] }),
  S({ background: { setting: "army_camp", weather: "dust", lighting: "auto" }, characters: [{ character: "barbarian", mark: "B", pose: "cheer", expression: "angry" }, { character: "odoacer", mark: "A", pose: "fight", expression: "determined" }, { character: "barbarian", mark: "C", pose: "raise_both", expression: "angry", flip: true }] }),
  S({ background: { setting: "map_italy", weather: "clear", lighting: "auto" }, overlays: [{ text: "Aug 23, 476", style: "banner", at_word: null }] }),
  S({ background: { setting: "seaside_villa", weather: "leaves", lighting: "auto" }, characters: [{ character: "romulus", mark: "D", pose: "wave", expression: "happy" }], overlays: [{ text: "RETIRED!", style: "stamp", at_word: null }] }),
];
const rowH = 300;
const sizes = ASPECT_LIST.map((a) => { const [w, h] = outputSize(a, 1080); return { a, w: Math.round((rowH * w) / h), h: rowH }; });
const sheetW = sizes.reduce((s, x) => s + x.w + 10, 0);
const sheet = nodeCanvas(sheetW, scenes.length * (rowH + 10));
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
sctx.fillStyle = "#222"; sctx.fillRect(0, 0, sheet.width, sheet.height);
scenes.forEach((sc, r) => {
  let x = 0;
  for (const s of sizes) {
    const ep = Episode.parse({ id: "a", title: "", script_text: "", scenes: [sc], subtitles: false, aspect: s.a, style: { grade: r === 3 ? "warm" : "none" } });
    const c = nodeCanvas(s.w * 2, s.h * 2);
    renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, { library: lib, episode: ep, createCanvas: nodeCanvas }, sc, 1.6, { width: c.width, height: c.height });
    sctx.drawImage(c as unknown as CanvasImageSource, x, r * (rowH + 10), s.w, s.h);
    x += s.w + 10;
  }
});
writeFileSync("out/aspects.png", sheet.toBuffer("image/png"));
console.log("→ out/aspects.png");
