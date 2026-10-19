import { writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { drawCharacter, lintRig, POSES } from "../src/engine/character";
const lib = new Library();
const spec = lib.getCharacter("robot")!;
console.log("lint:", lintRig(lib.getModule("robot_rig")!));
const poses = ["stand", "point", "raise_both", "wave", "walk", "cheer", "think"];
const c = nodeCanvas(220 * poses.length, 440);
const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.fillStyle = "#efe6d6"; ctx.fillRect(0, 0, c.width, c.height);
poses.forEach((p, i) => {
  ctx.save(); ctx.translate(110 + i * 220, 420); ctx.scale(0.9, 0.9);
  drawCharacter(ctx, spec, { pose: p, poseOverride: POSES[p].pose, expression: "neutral", t: 0.3 + i, u: 0.3 + i * 0.1, talk: i % 2 ? 0.8 : 0, viseme: "a", seed: 3, getModule: lib.getModule });
  ctx.restore();
});
writeFileSync("out/rig.png", c.toBuffer("image/png"));
