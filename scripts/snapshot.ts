// Render ảnh kiểm tra: bảng nhân vật + một loạt cảnh mẫu → out/*.png
import { mkdirSync, writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { drawCharacter, EXPRESSIONS, POSES } from "../src/engine/character";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { Episode, Scene } from "../src/schema";

mkdirSync("out", { recursive: true });
const lib = new Library();

// 1) Bảng nhân vật: mỗi nhân vật × vài nét mặt
{
  const chars = [...lib.characters.values()];
  const exprs = ["neutral", "happy", "worried", "angry", "surprised", "sad"];
  const cw = 300, ch = 420;
  const c = nodeCanvas(cw * exprs.length, ch * chars.length);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#efe6d6";
  ctx.fillRect(0, 0, c.width, c.height);
  chars.forEach((spec, r) =>
    exprs.forEach((e, k) => {
      ctx.save();
      ctx.translate(k * cw + cw / 2, r * ch + ch - 30);
      ctx.scale(0.95, 0.95);
      drawCharacter(ctx, spec, { pose: "stand", expression: e, t: 0.5, u: 0.5, talk: 0, seed: 7 + r * 13 + k, getModule: lib.getModule });
      ctx.restore();
    }),
  );
  writeFileSync("out/characters.png", c.toBuffer("image/png"));
}

// 2) Bảng tư thế
{
  const poses = Object.keys(POSES);
  const cw = 260, ch = 440;
  const cols = 7;
  const c = nodeCanvas(cw * cols, ch * Math.ceil(poses.length / cols));
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#e6eef5";
  ctx.fillRect(0, 0, c.width, c.height);
  const spec = lib.getCharacter("odoacer")!;
  poses.forEach((p, i) => {
    ctx.save();
    ctx.translate((i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch - 30);
    ctx.scale(0.9, 0.9);
    drawCharacter(ctx, spec, { pose: p, expression: Object.keys(EXPRESSIONS)[i % 12], t: 1, u: 0.3, talk: 0, seed: 3, getModule: lib.getModule });
    ctx.restore();
    ctx.fillStyle = "#2b2233";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p, (i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + 30);
  });
  writeFileSync("out/poses.png", c.toBuffer("image/png"));
}

// 3) Các bối cảnh có nhân vật
const S = (s: Partial<Scene> & { background: Scene["background"] }) =>
  Scene.parse({ id: "x", word_start: 0, word_end: 0, narration: "", start: 0, end: 4, duration: 4, ...s });

const scenes: Scene[] = [
  S({ background: { setting: "throne_room", weather: "sparkles", lighting: "auto" }, characters: [{ character: "romulus", mark: "A", pose: "sit", expression: "worried", speaking: false, flip: false }], overlays: [{ text: "476 AD", style: "banner", at_word: null }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "throne_room", weather: "clear", lighting: "auto" }, characters: [{ character: "romulus", mark: "A", pose: "sit", expression: "neutral", speaking: false, flip: false }, { character: "orestes", mark: "C", pose: "hands_hips", expression: "smug", speaking: false, flip: true }, { character: "senator", mark: "B", pose: "point", expression: "laugh", speaking: false, flip: false }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "army_camp", weather: "dust", lighting: "auto" }, characters: [{ character: "barbarian", mark: "B", pose: "cheer", expression: "angry", speaking: false, flip: false }, { character: "odoacer", mark: "A", pose: "fight", expression: "determined", speaking: false, flip: false }, { character: "barbarian", mark: "C", pose: "raise_both", expression: "angry", speaking: false, flip: true }], overlays: [{ text: "LAND!", style: "title", at_word: null }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "map_italy", weather: "clear", lighting: "auto" }, overlays: [{ text: "Aug 23, 476", style: "banner", at_word: null }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "seaside_villa", weather: "leaves", lighting: "auto" }, characters: [{ character: "romulus", mark: "D", pose: "wave", expression: "happy", speaking: false, flip: false }], overlays: [{ text: "RETIRED!", style: "stamp", at_word: null }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "city_walls", weather: "embers", lighting: "auto" }, characters: [{ character: "legionary", mark: "B", pose: "fight", expression: "scared", speaking: false, flip: false }, { character: "legionary", mark: "C", pose: "cower", expression: "scared", speaking: false, flip: true }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "forum", weather: "clear", lighting: "auto" }, characters: [{ character: "senator", mark: "A", pose: "think", expression: "confused", speaking: false, flip: false }], overlays: [{ text: "753 BC – 476 AD", style: "banner", at_word: null }], camera: { shot: "wide", move: "static", focus: "auto" } }),
  S({ background: { setting: "title_card", weather: "coins", lighting: "auto" }, characters: [{ character: "romulus", mark: "A", pose: "hold_up", expression: "surprised", speaking: false, flip: false }], overlays: [{ text: "6,000 GOLD COINS / YEAR", style: "counter", at_word: null }], camera: { shot: "medium", move: "static", focus: "auto" } }),
  S({ background: { setting: "palace_gate", weather: "clear", lighting: "spotlight" }, characters: [{ character: "odoacer", mark: "A", pose: "point", expression: "smug", speaking: false, flip: false }], camera: { shot: "close", move: "static", focus: "auto" } }),
];

const ep = Episode.parse({ id: "snap", title: "snap", script_text: "", scenes, subtitles: false });
const env = { library: lib, episode: ep, createCanvas: (w: number, h: number) => nodeCanvas(w, h) };
const tw = 360, th = 640;
const cols = 5;
const sheet = nodeCanvas(tw * cols, th * Math.ceil(scenes.length / cols));
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
scenes.forEach((s, i) => {
  const c = nodeCanvas(tw, th);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderScene(ctx, env, s, 1.6, { width: tw, height: th });
  sctx.drawImage(c as unknown as CanvasImageSource, (i % cols) * tw, Math.floor(i / cols) * th);
});
writeFileSync("out/scenes.png", sheet.toBuffer("image/png"));

// 4) Một khung hình độ phân giải đầy đủ
{
  const c = nodeCanvas(1080, 1920);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderScene(ctx, env, scenes[1], 1.6, { width: 1080, height: 1920 });
  writeFileSync("out/full.png", c.toBuffer("image/png"));
}
console.log("ok → out/");
