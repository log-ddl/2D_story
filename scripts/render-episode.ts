// Render tập demo ra MP4 không cần mở app (dùng cùng engine + pipeline).
// pnpm render:node [voice.wav] [out.mp4] [chiều cao]
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { nodeCanvas } from "./node-canvas";
import { Library } from "../src/engine/library";
import { episodeDuration, renderFrame } from "../src/engine/render";
import { DEMO_CAST, DEMO_SCRIPT, DEMO_TITLE } from "../src/library/demo";
import { envelopeFromPcm, estimateAlignment, heuristicAlign } from "../src/pipeline/align";
import { buildSfxTrack, encodeWav } from "../src/pipeline/audio";
import { runQa } from "../src/pipeline/qa";
import { ruleSegment } from "../src/pipeline/segment";
import { Episode } from "../src/schema";

const [voice, out = "out/demo.mp4", hArg = "1280"] = process.argv.slice(2);
const H = +hArg;
const W = Math.round((H * 9) / 16 / 2) * 2;
const FPS = 30;
const lib = new Library();
const ep = Episode.parse({ id: "demo", title: DEMO_TITLE, script_text: DEMO_SCRIPT, cast: DEMO_CAST });
let envelope: Float32Array | null = null;
if (voice) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", voice, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
  const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  envelope = envelopeFromPcm(pcm, 16000);
  ep.alignment = heuristicAlign(DEMO_SCRIPT, envelope, pcm.length / 16000);
} else ep.alignment = estimateAlignment(DEMO_SCRIPT);
ep.scenes = ruleSegment(ep, ep.alignment, lib);
Object.assign(ep, runQa(ep, lib));
const dur = episodeDuration(ep);
const total = Math.ceil(dur * FPS);
writeFileSync("out/sfx.wav", encodeWav(buildSfxTrack(ep, dur)));

const args = ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "pipe:0"];
if (voice) args.push("-i", voice);
args.push("-i", "out/sfx.wav");
const mix = voice ? "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[v];[2:a]aformat=sample_rates=48000:channel_layouts=stereo[s];[v][s]amix=inputs=2:normalize=0[a]" : "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a]";
args.push("-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-t", dur.toFixed(3), out);
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
const canvas = nodeCanvas(W, H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const env = { library: lib, episode: ep, envelope, createCanvas: (w: number, h: number) => nodeCanvas(w, h) };
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  renderFrame(ctx, env, f / FPS, { width: W, height: H });
  const data = ctx.getImageData(0, 0, W, H).data;
  if (!ff.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) process.stdout.write(`\r${f}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
console.log(`\n${ep.scenes.length} cảnh, ${dur.toFixed(2)}s, ${total} frame ${W}x${H} → ${out} trong ${((Date.now() - t0) / 1000).toFixed(1)}s`);
