// Dải khung hình của một cảnh có hành động → out/actions.png
import { writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { renderScene } from "../src/engine/render";
import { Episode, Scene } from "../src/schema";

const lib = new Library();
const scene = Scene.parse({
  id: "s1", word_start: 0, word_end: 0, narration: "", start: 0, end: 5, duration: 5,
  background: { setting: "throne_room" }, camera: { shot: "wide", move: "static" },
  characters: [
    { character: "romulus", mark: "A", pose: "sit", expression: "worried" },
    { character: "odoacer", mark: "C", pose: "stand", expression: "smug" },
    { character: "legionary", mark: "B", pose: "stand", expression: "neutral" },
  ],
  props: [{ module: "coin_pile", x: 760, y: 1700, scale: 0.9 }],
  actions: [
    { target: "odoacer", verb: "enter", value: "right", delay: 0, duration: 1.6 },
    { target: "odoacer", verb: "point_at", to: "romulus", delay: 1.8, duration: 1 },
    { target: "romulus", verb: "emote", value: "scared", delay: 1.9 },
    { target: "legionary", verb: "fall", delay: 2.4, duration: 0.6 },
    { target: "prop:coin_pile", verb: "drop", delay: 3.0, duration: 1.0 },
    { target: "romulus", verb: "pose", value: "cheer", delay: 3.6, duration: 0.4 },
    { target: "romulus", verb: "emote", value: "laugh", delay: 3.6 },
  ],
});
const ep = Episode.parse({ id: "a", title: "", script_text: "", scenes: [scene], subtitles: false, aspect: "16:9" });
const times = [0.2, 0.8, 1.5, 2.2, 2.8, 3.3, 3.8, 4.6];
const W = 480, H = 270;
const sheet = nodeCanvas(W * 4, H * 2);
const sctx = sheet.getContext("2d") as unknown as CanvasRenderingContext2D;
times.forEach((t, i) => {
  const c = nodeCanvas(W, H);
  renderScene(c.getContext("2d") as unknown as CanvasRenderingContext2D, { library: lib, episode: ep, createCanvas: nodeCanvas }, scene, t, { width: W, height: H });
  sctx.drawImage(c as unknown as CanvasImageSource, (i % 4) * W, Math.floor(i / 4) * H);
  sctx.fillStyle = "#fff"; sctx.font = "bold 18px sans-serif"; sctx.fillText(`t=${t}`, (i % 4) * W + 8, Math.floor(i / 4) * H + 22);
});
writeFileSync("out/actions.png", sheet.toBuffer("image/png"));
console.log("→ out/actions.png");
