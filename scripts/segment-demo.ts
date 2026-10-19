// In ra phân cảnh của tập demo từ file voice (out/voice/demo.wav)
import { execFileSync } from "node:child_process";
import { DEMO_CAST, DEMO_SCRIPT } from "../src/library/demo";
import { envelopeFromPcm, estimateAlignment, heuristicAlign } from "../src/pipeline/align";
import { ruleSegment } from "../src/pipeline/segment";
import { Library } from "../src/engine/library";

const file = process.argv[2];
let al;
if (file) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
  const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  al = heuristicAlign(DEMO_SCRIPT, envelopeFromPcm(pcm, 16000), pcm.length / 16000);
} else al = estimateAlignment(DEMO_SCRIPT);
const scenes = ruleSegment({ cast: DEMO_CAST, fps: 30 }, al, new Library());
for (const s of scenes)
  console.log(`${s.id} ${s.start.toFixed(2)}–${s.end.toFixed(2)} (${s.duration.toFixed(2)}s) ${s.beat.padEnd(9)} ${s.background.setting.padEnd(13)} ${s.camera.shot}/${s.camera.move} [${s.characters.map((c) => `${c.character}:${c.pose}/${c.expression}@${c.mark}`).join(", ")}] ${s.overlays.map((o) => `{${o.style}:${o.text}}`).join(" ")} | ${s.narration}`);
console.log(`${scenes.length} cảnh, tổng ${scenes[scenes.length - 1].end.toFixed(2)}s (${al.method})`);
