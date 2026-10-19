// Ảnh lưới các cảnh từ file JSON {project, episode} → out/<tên>.png
import { readFileSync, writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { outputSize } from "../src/engine/frame";
import { Episode, Project } from "../src/schema";

const [file = "out/brain-live.json", out = "out/brain-live.png"] = process.argv.slice(2);
const data = JSON.parse(readFileSync(file, "utf8"));
const project = Project.parse(data.project);
const ep = Episode.parse(data.episode);
const lib = new Library(project);
const [W, H] = outputSize(ep.aspect, 360);
const cols = ep.aspect === "9:16" ? 7 : 4;
const sheet = nodeCanvas(cols * W, Math.ceil(ep.scenes.length / cols) * H);
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
ep.scenes.forEach((s, i) => {
  const c = nodeCanvas(W, H);
  renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, { library: lib, episode: ep, createCanvas: nodeCanvas }, s, s.duration * 0.6, { width: W, height: H, subtitles: true });
  sctx.drawImage(c as unknown as CanvasImageSource, (i % cols) * W, Math.floor(i / cols) * H);
});
writeFileSync(out, sheet.toBuffer("image/png"));
console.log("→", out);
