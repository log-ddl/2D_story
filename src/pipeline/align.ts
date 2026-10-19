// Căn thời gian từng từ: ước lượng (không audio), heuristic theo khoảng lặng,
// whisper.cpp (JSON), hoặc timestamp ký tự từ TTS.

import type { Alignment, Word } from "../schema";
import { pauseAfter, tokenize, type Token } from "./text";

const SYL_SEC = 0.19; // ~5.3 âm tiết/giây — nhịp đọc Shorts

// ───────── 1. Ước lượng khi chưa có audio ─────────

export function estimateAlignment(script: string, rate = 1): Alignment {
  const toks = tokenize(script);
  const words: Word[] = [];
  let t = 0.15;
  for (const tk of toks) {
    const d = Math.max(0.16, tk.syllables * SYL_SEC) / rate;
    words.push({ text: tk.text, start: round(t), end: round(t + d), conf: 0.3 });
    t += d + pauseAfter(tk.punct) / rate;
  }
  return { method: "estimate", duration: round(t + 0.4), words, silences: [], mismatches: [] };
}

// ───────── 2. Âm lượng & khoảng lặng ─────────

/** RMS 100 mẫu/giây, chuẩn hóa theo phân vị 95% */
export function envelopeFromPcm(pcm: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.round(sampleRate / 100);
  const n = Math.ceil(pcm.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const a = i * hop;
    const b = Math.min(pcm.length, a + hop);
    for (let k = a; k < b; k++) s += pcm[k] * pcm[k];
    env[i] = Math.sqrt(s / Math.max(1, b - a));
  }
  const sorted = Array.from(env).sort((x, y) => x - y);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / p95);
  // làm mượt nhẹ
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (env[Math.max(0, i - 1)] + env[i] * 2 + env[Math.min(n - 1, i + 1)]) / 4;
  return out;
}

/** Khoảng lặng ≥ minDur giây; ngưỡng thích nghi theo nền nhiễu */
export function detectSilences(env: Float32Array, minDur = 0.12): [number, number][] {
  const sorted = Array.from(env).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const thr = Math.max(0.06, floor + 0.08);
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= env.length; i++) {
    const quiet = i < env.length && env[i] < thr;
    if (quiet && s < 0) s = i;
    if (!quiet && s >= 0) {
      if ((i - s) / 100 >= minDur) out.push([s / 100, i / 100]);
      s = -1;
    }
  }
  return out;
}

// ───────── 3. Heuristic: gán khoảng lặng vào chỗ ngắt câu bằng quy hoạch động ─────────

export function heuristicAlign(script: string, env: Float32Array, duration: number): Alignment {
  const toks = tokenize(script);
  if (!toks.length) return { method: "heuristic", duration, words: [], silences: [], mismatches: [] };
  const sil = detectSilences(env);
  const speechStart = sil.length && sil[0][0] <= 0.01 ? sil[0][1] : 0;
  const lastSil = sil[sil.length - 1];
  const speechEnd = lastSil && lastSil[1] >= duration - 0.02 ? lastSil[0] : duration;
  const inner = sil.filter(([a, b]) => a > speechStart + 0.05 && b < speechEnd - 0.05);

  const n = toks.length;
  const cum: number[] = [0];
  for (const tk of toks) cum.push(cum[cum.length - 1] + tk.syllables);
  const T = cum[n];
  // thời gian nói (trừ các khoảng lặng bên trong)
  const innerDur = inner.reduce((s, [a, b]) => s + (b - a), 0);
  const D = Math.max(0.1, speechEnd - speechStart - innerDur);
  const rate = T / D;
  // P[j] = thời gian nói tích lũy trước khoảng lặng j
  const P: number[] = [];
  let acc = 0;
  let prev = speechStart;
  for (const [a, b] of inner) {
    acc += a - prev;
    P.push(acc);
    prev = b;
  }
  // Khoảng lặng dài gần như chắc chắn rơi vào dấu câu; lặng ngắn có thể nằm giữa từ.
  const gapPenalty = (i: number, dur: number) => {
    const p = toks[i].punct;
    if (p && ".!?…".includes(p)) return 0;
    if (p && ",;:—-".includes(p)) return 0.3 + dur * 2;
    return 1 + dur * 25;
  };
  // Viterbi: trạng thái = khe (gap) cuối cùng đã gán; mỗi khoảng lặng j được gán vào một khe
  // sau đó hoặc bỏ qua. Chi phí chính là độ lệch CỤC BỘ giữa số âm tiết trong đoạn và
  // thời lượng đoạn × tốc độ đọc (không tích lũy sai số), cộng một phần nhỏ lệch toàn cục.
  const m = inner.length;
  const INF = 1e9;
  type Cell = { cost: number; prevGap: number; lastP: number };
  let layer = new Map<number, Cell>([[-1, { cost: 0, prevGap: -1, lastP: 0 }]]);
  const history: Map<number, Cell>[] = [];
  for (let j = 0; j < m; j++) {
    const next = new Map<number, Cell>();
    const dur = inner[j][1] - inner[j][0];
    const expectedCum = rate * P[j];
    for (const [g, cell] of layer) {
      const skip = cell.cost + 1.2 + dur * 6;
      if (skip < (next.get(g)?.cost ?? INF)) next.set(g, { cost: skip, prevGap: g, lastP: cell.lastP });
      const segExpected = rate * (P[j] - cell.lastP);
      const base = cum[g + 1];
      for (let i = g + 1; i < n - 1; i++) {
        const syl = cum[i + 1] - base;
        const local = (syl - segExpected) / Math.max(2.5, segExpected * 0.22);
        if (local > 4) break;
        if (local < -4) continue;
        const global = (cum[i + 1] - expectedCum) / Math.max(4, expectedCum * 0.15);
        const c = cell.cost + local * local + 0.15 * global * global + gapPenalty(i, dur);
        if (c < (next.get(i)?.cost ?? INF)) next.set(i, { cost: c, prevGap: g, lastP: P[j] });
      }
    }
    history.push(next);
    layer = next;
  }
  // truy vết
  const anchors: { gap: number; sil: [number, number] }[] = [];
  let best = -1;
  let bestCost = INF;
  for (const [g, c] of layer) {
    // phạt phần đuôi lệch
    const tail = c.cost;
    if (tail < bestCost) {
      bestCost = tail;
      best = g;
    }
  }
  let g = best;
  for (let j = m - 1; j >= 0; j--) {
    const cell = history[j].get(g)!;
    if (cell.prevGap !== g) anchors.unshift({ gap: g, sil: inner[j] });
    g = cell.prevGap;
  }
  // Phân bổ từ trong từng đoạn nói giữa các mốc
  const words: Word[] = [];
  const segs: { from: number; to: number; t0: number; t1: number }[] = [];
  let from = 0;
  let t0 = speechStart;
  for (const a of anchors) {
    segs.push({ from, to: a.gap, t0, t1: a.sil[0] });
    from = a.gap + 1;
    t0 = a.sil[1];
  }
  segs.push({ from, to: n - 1, t0, t1: speechEnd });
  for (const s of segs) distribute(toks, s.from, s.to, s.t0, s.t1, words);
  return { method: "heuristic", duration, words, silences: sil, mismatches: [] };
}

function distribute(toks: Token[], from: number, to: number, t0: number, t1: number, out: Word[]) {
  if (to < from) return;
  let total = 0;
  for (let i = from; i <= to; i++) total += toks[i].syllables + (i < to ? pauseAfter(toks[i].punct) * 4 : 0);
  const k = (t1 - t0) / Math.max(1, total);
  let t = t0;
  for (let i = from; i <= to; i++) {
    const d = toks[i].syllables * k;
    out.push({ text: toks[i].text, start: round(t), end: round(t + d), conf: 0.6 });
    t += d + (i < to ? pauseAfter(toks[i].punct) * 4 * k : 0);
  }
}

// ───────── 4. Whisper (whisper.cpp JSON) → khớp với kịch bản ─────────

export interface AsrWord {
  text: string;
  start: number;
  end: number;
  conf?: number;
}

/** Đọc JSON của whisper-cli (-oj, -ml 1 hoặc --output-json-full) */
export function parseWhisperJson(json: unknown): AsrWord[] {
  const out: AsrWord[] = [];
  const tr = (json as { transcription?: unknown[] })?.transcription ?? [];
  for (const seg of tr as { offsets?: { from: number; to: number }; text?: string; tokens?: { text: string; offsets: { from: number; to: number }; p?: number }[] }[]) {
    if (seg.tokens?.length) {
      // gộp token con thành từ (token bắt đầu bằng dấu cách = từ mới)
      let cur: AsrWord | null = null;
      for (const tk of seg.tokens) {
        if (/^\[.*\]$/.test(tk.text.trim())) continue;
        if (!cur || tk.text.startsWith(" ")) {
          if (cur) out.push(cur);
          cur = { text: tk.text.trim(), start: tk.offsets.from / 1000, end: tk.offsets.to / 1000, conf: tk.p };
        } else {
          cur.text += tk.text;
          cur.end = tk.offsets.to / 1000;
        }
      }
      if (cur) out.push(cur);
    } else if (seg.text?.trim() && seg.offsets) {
      out.push({ text: seg.text.trim(), start: seg.offsets.from / 1000, end: seg.offsets.to / 1000 });
    }
  }
  return out.filter((w) => w.text);
}

const normWord = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * Khớp từ nghe được với kịch bản (Levenshtein theo từ). Từ kịch bản khớp nhận
 * timestamp thật; từ không khớp được nội suy; chỗ lệch được ghi lại để cảnh báo.
 */
export function alignScriptToAsr(script: string, asr: AsrWord[], duration: number, method: Alignment["method"] = "whisper"): Alignment {
  const toks = tokenize(script);
  // trải số thành nhiều từ để so với ASR ("476" → four seventy six)
  const expanded: { tok: number; norm: string }[] = [];
  toks.forEach((t, i) => t.norm.split(" ").forEach((w) => expanded.push({ tok: i, norm: normWord(w) })));
  const heard = asr.map((w) => ({ ...w, norm: normWord(w.text) }));
  const A = expanded.length;
  const B = heard.length;
  const dp: Uint32Array[] = Array.from({ length: A + 1 }, () => new Uint32Array(B + 1));
  for (let i = 0; i <= A; i++) dp[i][0] = i;
  for (let j = 0; j <= B; j++) dp[0][j] = j;
  const same = (a: string, b: string) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
  for (let i = 1; i <= A; i++)
    for (let j = 1; j <= B; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (same(expanded[i - 1].norm, heard[j - 1].norm) ? 0 : 1));
  const match: (number | null)[] = new Array(A).fill(null);
  const mismatches: Alignment["mismatches"] = [];
  let i = A;
  let j = B;
  while (i > 0 && j > 0) {
    const sub = dp[i - 1][j - 1] + (same(expanded[i - 1].norm, heard[j - 1].norm) ? 0 : 1);
    if (dp[i][j] === sub) {
      match[i - 1] = j - 1;
      if (!same(expanded[i - 1].norm, heard[j - 1].norm)) mismatches.unshift({ index: expanded[i - 1].tok, expected: expanded[i - 1].norm, heard: heard[j - 1].text });
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      mismatches.unshift({ index: expanded[i - 1].tok, expected: expanded[i - 1].norm, heard: "" });
      i--;
    } else j--;
  }
  // gom về từng token kịch bản
  const times: ({ start: number; end: number; conf: number } | null)[] = toks.map(() => null);
  expanded.forEach((e, k) => {
    const m = match[k];
    if (m == null) return;
    const h = heard[m];
    const cur = times[e.tok];
    times[e.tok] = cur ? { start: Math.min(cur.start, h.start), end: Math.max(cur.end, h.end), conf: Math.min(cur.conf, h.conf ?? 1) } : { start: h.start, end: h.end, conf: h.conf ?? 1 };
  });
  // nội suy chỗ trống
  const words: Word[] = [];
  for (let k = 0; k < toks.length; k++) {
    let tm = times[k];
    if (!tm) {
      const prevEnd = k > 0 ? words[k - 1].end : 0;
      let nx = k + 1;
      while (nx < toks.length && !times[nx]) nx++;
      const nextStart = nx < toks.length ? times[nx]!.start : duration;
      const span = (nextStart - prevEnd) / (nx - k);
      tm = { start: prevEnd, end: prevEnd + span, conf: 0.2 };
    }
    words.push({ text: toks[k].text, start: round(tm.start), end: round(Math.max(tm.end, tm.start + 0.05)), conf: tm.conf });
  }
  return { method, duration, words, silences: [], mismatches: mismatches.filter((m, idx, arr) => arr.findIndex((x) => x.index === m.index) === idx) };
}

// ───────── 5. TTS trả timestamp từng ký tự (vd. ElevenLabs) ─────────

export function alignFromCharTimes(script: string, chars: string[], starts: number[], ends: number[], duration: number): Alignment {
  const asr: AsrWord[] = [];
  let cur: AsrWord | null = null;
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) asr.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { text: ch, start: starts[i], end: ends[i] };
    else {
      cur.text += ch;
      cur.end = ends[i];
    }
  });
  if (cur) asr.push(cur);
  return alignScriptToAsr(script, asr, duration, "tts");
}

const round = (v: number) => Math.round(v * 1000) / 1000;
