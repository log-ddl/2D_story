import { writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { Episode, Scene } from "../src/schema";
const lib = new Library();
const mk = (setting: string, overlays: unknown[], extra: Record<string, unknown> = {}) => Scene.parse({ id: "x", word_start: 0, word_end: 0, narration: "", start: 0, end: 4, duration: 4, background: { setting }, camera: { shot: "wide", move: "static" }, overlays, ...extra });
const scenes = [
  mk("classroom", [{ text: "Rome:1229; Byzantium:1123; Ottoman:623", style: "chart" }], { characters: [{ character: "robot", mark: "D", pose: "point" }] }),
  mk("title_card", [{ text: "753 BC|476 AD|1453 AD", style: "timeline" }]),
  mk("army_camp", [{ text: "Rome VS Carthage", style: "versus" }]),
  mk("map_italy", [{ text: "Roma > Ravenna", style: "route" }, { text: "Odoacer marches", style: "banner" }]),
];
const W = 240, H = 427;
const sheet = nodeCanvas(W * scenes.length, H);
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
scenes.forEach((sc, i) => {
  const ep = Episode.parse({ id: "a", title: "", script_text: "", scenes: [sc], subtitles: false });
  const c = nodeCanvas(W * 2, H * 2);
  renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, { library: lib, episode: ep, createCanvas: nodeCanvas }, sc, 2.5, { width: c.width, height: c.height });
  sctx.drawImage(c as unknown as CanvasImageSource, i * W, 0, W, H);
});
writeFileSync("out/explainer.png", sheet.toBuffer("image/png"));
