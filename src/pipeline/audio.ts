// Âm thanh tạo bằng hàm toán học (SFX) + tiện ích WAV. Chạy được cả trình duyệt lẫn Node.

import type { Episode } from "../schema";
import { rng } from "../engine/math";

export const SFX_RATE = 48000;

type Synth = (t: number, r: () => number) => number;

const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

const SYNTHS: Record<string, { dur: number; f: Synth }> = {
  // pop: sin quét tần số lên nhanh
  pop: { dur: 0.16, f: (t) => Math.sin(2 * Math.PI * (380 * t + 2600 * t * t)) * env(t, 0.004, 0.045) * 0.55 },
  // whoosh: nhiễu trắng lọc thông thấp có tần số cắt quét
  whoosh: {
    dur: 0.42,
    f: (() => {
      let y = 0;
      return (t: number, r: () => number) => {
        const k = 0.02 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.42));
        y += k * (r() * 2 - 1 - y);
        return y * Math.sin(Math.PI * Math.min(1, t / 0.42)) * 1.6;
      };
    })(),
  },
  // thud: sin trầm tắt nhanh + chút nhiễu
  thud: { dur: 0.35, f: (t, r) => (Math.sin(2 * Math.PI * (90 - 40 * t) * t) * 0.8 + (r() - 0.5) * 0.25 * env(t, 0.001, 0.02)) * env(t, 0.002, 0.09) },
  // ding: hai họa âm, tắt chậm
  ding: { dur: 0.9, f: (t) => (Math.sin(2 * Math.PI * 1318 * t) * 0.5 + Math.sin(2 * Math.PI * 1976 * t) * 0.25) * env(t, 0.003, 0.22) * 0.5 },
};

export function synth(name: keyof typeof SYNTHS, rate = SFX_RATE): Float32Array {
  const s = SYNTHS[name];
  const n = Math.round(s.dur * rate);
  const out = new Float32Array(n);
  const r = rng(7);
  for (let i = 0; i < n; i++) out[i] = s.f(i / rate, r);
  return out;
}

export interface SfxEvent {
  t: number;
  name: keyof typeof SYNTHS;
  gain: number;
}

/** Sự kiện SFX suy ra từ cảnh: overlay bật lên, chuyển cảnh whip */
export function sfxEvents(ep: Episode): SfxEvent[] {
  const ev: SfxEvent[] = [];
  const words = ep.alignment?.words ?? [];
  for (const s of ep.scenes) {
    if (s.transition === "whip" && s.start > 0) ev.push({ t: Math.max(0, s.start - 0.2), name: "whoosh", gain: 0.7 });
    for (const o of s.overlays) {
      const at = o.at_word != null && words[o.at_word] ? words[o.at_word].start : s.start + 0.1;
      const name = o.style === "stamp" ? "thud" : o.style === "counter" ? "ding" : o.style === "banner" ? "whoosh" : "pop";
      ev.push({ t: at, name, gain: 0.8 });
      if (o.style === "banner") ev.push({ t: at + 0.3, name: "thud", gain: 0.5 });
    }
  }
  return ev;
}

export function buildSfxTrack(ep: Episode, duration: number, rate = SFX_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(duration * rate));
  const cache = new Map<string, Float32Array>();
  for (const e of sfxEvents(ep)) {
    let buf = cache.get(e.name);
    if (!buf) cache.set(e.name, (buf = synth(e.name, rate)));
    const o = Math.round(e.t * rate);
    for (let i = 0; i < buf.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += buf[i] * e.gain;
  }
  return out;
}

/** Float32 mono → WAV PCM 16-bit */
export function encodeWav(samples: Float32Array, rate = SFX_RATE): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Uint8Array(buf);
}

/** Đỉnh sóng âm để vẽ waveform (mỗi cột = max |x|) */
export function waveformPeaks(pcm: Float32Array, columns: number): Float32Array {
  const out = new Float32Array(columns);
  const step = pcm.length / columns;
  for (let c = 0; c < columns; c++) {
    let m = 0;
    const a = Math.floor(c * step);
    const b = Math.min(pcm.length, Math.floor((c + 1) * step));
    for (let i = a; i < b; i += 4) m = Math.max(m, Math.abs(pcm[i]));
    out[c] = m;
  }
  return out;
}

/** Phụ đề SRT từ alignment (gom như phụ đề trong video) */
export function buildSrt(ep: Episode, chunks: [number, number][]): string {
  const words = ep.alignment?.words ?? [];
  const ts = (t: number) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return chunks
    .map(([a, b], i) => `${i + 1}\n${ts(words[a].start)} --> ${ts(words[b].end + 0.15)}\n${words.slice(a, b + 1).map((w) => w.text).join(" ")}\n`)
    .join("\n");
}
