// Bộ não vẽ nhân vật SVG có khung xương (CLI thật) → out/brain-char.png
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { drawCharacterSvg, type BrainRunner } from "../src/brain";
import { drawCharacter, lintRig, POSES } from "../src/engine/character";
import { compileModule } from "../src/engine/svg";
import { CharacterSpec } from "../src/schema";
import { nodeCanvas } from "./node-canvas";

const cli = process.argv[2] ?? "agy";
const desc = process.argv[3] ?? "chú mèo cam mập đội mũ lính La Mã, cầm khiên nhỏ";
const run: BrainRunner = async (prompt, schema) => {
  const t0 = Date.now();
  const out = execFileSync(cli, ["--output-format", "json", "--json-schema", schema, "-p", prompt], { cwd: "/tmp", maxBuffer: 1 << 26, encoding: "utf8" });
  const v = JSON.parse(out);
  console.log(`  ${cli}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return JSON.stringify(v.structured_output ?? JSON.parse(v.response));
};
const check = (svg: string) => { try { return lintRig(compileModule("c", svg)); } catch (e) { return [(e as Error).message]; } };
const r = await drawCharacterSvg(run, desc, check);
console.log("id:", r.id, "lỗi:", r.errors);
writeFileSync("out/brain-char.svg", r.svg);
const m = compileModule("brain_rig", r.svg);
const spec = CharacterSpec.parse({ id: "x", name: r.name, kind: "svg", rig: "brain_rig" });
const poses = ["stand", "point", "raise_both", "walk", "cheer"];
const c = nodeCanvas(240 * poses.length, 460);
const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
ctx.fillStyle = "#efe6d6"; ctx.fillRect(0, 0, c.width, c.height);
poses.forEach((p, i) => {
  ctx.save(); ctx.translate(120 + i * 240, 440); ctx.scale(0.95, 0.95);
  drawCharacter(ctx, spec, { pose: p, poseOverride: POSES[p].pose, expression: "neutral", t: 0.3 + i, u: 0.4 + i * 0.3, talk: i % 2 ? 0.8 : 0, viseme: "a", seed: 5, getModule: (id) => (id === "brain_rig" ? m : undefined) });
  ctx.restore();
});
writeFileSync("out/brain-char.png", c.toBuffer("image/png"));
console.log("→ out/brain-char.png");
