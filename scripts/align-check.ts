// Đo độ chính xác căn thời gian heuristic: đọc từng câu bằng `say`, ghép lại
// (biết chính xác câu bắt đầu lúc nào), rồi so với kết quả heuristicAlign.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { DEMO_SCRIPT } from "../src/library/demo";
import { envelopeFromPcm, heuristicAlign } from "../src/pipeline/align";
import { splitSentences, tokenize } from "../src/pipeline/text";

const dir = "out/voice";
mkdirSync(dir, { recursive: true });
const voice = process.argv[2] ?? "Daniel";
// Người đọc thật thường ngừng 0.2–0.4s giữa các câu; GAP=0 để thử trường hợp xấu nhất
const GAP = Number(process.env.GAP ?? 0.22);
const sentences = splitSentences(DEMO_SCRIPT);
const SR = 16000;
const pcmOf = (file: string) => {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
const parts: Float32Array[] = [];
const truth: { word: number; t: number }[] = [];
let t = 0;
let w = 0;
sentences.forEach((s, i) => {
  const f = `${dir}/s${i}.aiff`;
  execFileSync("say", ["-v", voice, "-r", "190", "-o", f, s]);
  const pcm = pcmOf(f);
  // tìm điểm bắt đầu có tiếng trong câu
  let k = 0;
  while (k < pcm.length && Math.abs(pcm[k]) < 0.01) k++;
  truth.push({ word: w, t: t + k / SR });
  parts.push(pcm);
  t += pcm.length / SR;
  if (GAP > 0 && i < sentences.length - 1) {
    parts.push(new Float32Array(Math.round(GAP * SR)));
    t += GAP;
  }
  w += tokenize(s).length;
});
const total = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
let o = 0;
for (const p of parts) {
  total.set(p, o);
  o += p.length;
}
const env = envelopeFromPcm(total, SR);
const al = heuristicAlign(DEMO_SCRIPT, env, total.length / SR);
if (process.env.DBG) for (const tr of truth) console.log(al.words[tr.word].text.padEnd(12), "truth", tr.t.toFixed(2), "got", al.words[tr.word].start.toFixed(2));
const errs = truth.map((tr) => Math.abs(al.words[tr.word].start - tr.t));
errs.sort((a, b) => a - b);
console.log(`voice=${voice} duration=${(total.length / SR).toFixed(2)}s sentences=${truth.length} words=${al.words.length}`);
console.log(`sentence-start error: median ${errs[Math.floor(errs.length / 2)].toFixed(3)}s, p90 ${errs[Math.floor(errs.length * 0.9)].toFixed(3)}s, max ${errs[errs.length - 1].toFixed(3)}s`);
// ghi file wav ghép để dùng cho demo
const wav = `${dir}/demo.wav`;
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", wav], { input: Buffer.from(total.buffer) });
console.log("→", wav);
