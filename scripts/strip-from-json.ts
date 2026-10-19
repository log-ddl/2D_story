// Dải khung hình theo thời gian của vài cảnh trong file JSON → out/strip.png
import { readFileSync, writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { Episode, Project } from "../src/schema";
const data = JSON.parse(readFileSync("out/brain-live.json", "utf8"));
const lib = new Library(Project.parse(data.project));
const ep = Episode.parse(data.episode);
const ids = process.argv.slice(2);
const W = 384, H = 216, N = 5;
const sheet = nodeCanvas(W * N, H * ids.length);
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
ids.forEach((id, r) => {
  const s = ep.scenes.find((x) => x.id === id)!;
  for (let k = 0; k < N; k++) {
    const u = (s.duration * (k + 0.5)) / N;
    const c = nodeCanvas(W * 2, H * 2);
    renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, { library: lib, episode: ep, createCanvas: nodeCanvas }, s, u, { width: c.width, height: c.height, subtitles: true });
    sctx.drawImage(c as unknown as CanvasImageSource, k * W, r * H, W, H);
    sctx.fillStyle = "#fff"; sctx.font = "bold 13px sans-serif"; sctx.fillText(`${id} u=${u.toFixed(2)}`, k * W + 6, r * H + 15);
  }
});
writeFileSync("out/strip.png", sheet.toBuffer("image/png"));
