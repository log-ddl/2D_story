// Chữ do engine render (không để AI vẽ): bảng treo, tiêu đề, dấu mộc, nhãn, bộ đếm, phụ đề.

import type { Overlay, Word } from "../schema";
import { OUTLINE } from "./character";
import { DEG, clamp, ease, spring } from "./math";
import { WORLD_W } from "./camera";

type Ctx = CanvasRenderingContext2D;

export const FONT_DISPLAY = `"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Arial Rounded MT Bold", sans-serif`;
export const FONT_SUB = `"Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`;

function fitFont(ctx: Ctx, text: string, family: string, weight: string, size: number, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 20 && ctx.measureText(text).width > maxW) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function outlinedText(ctx: Ctx, text: string, x: number, y: number, fill: string, lw: number) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = lw;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Định dạng bộ đếm: giữ nguyên phần chữ, chỉ số chạy */
function counterText(text: string, k: number): string {
  return text.replace(/\d[\d,.]*/, (num) => {
    const v = parseFloat(num.replace(/,/g, ""));
    const cur = Math.round(v * k);
    return num.includes(",") || v >= 1000 ? cur.toLocaleString("en-US") : String(cur);
  });
}

/**
 * Vẽ overlay tại thời điểm `age` (giây kể từ khi xuất hiện). age < 0 → chưa hiện.
 */
export function drawOverlay(ctx: Ctx, o: Overlay, age: number, zone: { x: number; y: number }, seed: number) {
  if (age < 0) return;
  const x = o.x ?? zone.x;
  const y = o.y ?? zone.y;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (o.style) {
    case "banner": {
      // Bảng gỗ treo bằng 2 dây, rơi xuống rồi đung đưa tắt dần
      const drop = spring(age, 2.2, 0.45);
      const swing = Math.sin(age * 5) * Math.exp(-age * 2.2) * 6 * DEG + Math.sin(age * 1.3 + seed) * 0.6 * DEG;
      const by = -300 + (y + 300) * drop;
      const size = fitFont(ctx, o.text, FONT_DISPLAY, "bold", 92, 760);
      const w = Math.min(860, ctx.measureText(o.text).width + 120);
      const h = size + 70;
      ctx.translate(x, by);
      ctx.rotate(swing);
      ctx.strokeStyle = "#5a3b26";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-w * 0.32, -h / 2);
      ctx.lineTo(-w * 0.42, -by - 400);
      ctx.moveTo(w * 0.32, -h / 2);
      ctx.lineTo(w * 0.42, -by - 400);
      ctx.stroke();
      roundRect(ctx, -w / 2, -h / 2, w, h, 22);
      ctx.fillStyle = "#c99a5b";
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      roundRect(ctx, -w / 2 + 16, -h / 2 + 14, w - 32, h - 28, 14);
      ctx.fillStyle = "#f5e6c4";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.stroke();
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * (w * 0.32), -h / 2 + 2, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#8a5a33";
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#5a2b2b";
      ctx.fillText(o.text, 0, 6);
      break;
    }
    case "title": {
      const s = ease.outBack(clamp(age / 0.35));
      const wob = Math.sin(age * 3 + seed) * 1.2 * DEG;
      ctx.translate(x, y);
      ctx.rotate(wob);
      ctx.scale(s, s);
      const { lines, size } = wrap(ctx, o.text, 900, FONT_DISPLAY, 110);
      const lh = size * 1.1;
      lines.forEach((ln, i) => outlinedText(ctx, ln, 0, (i - (lines.length - 1) / 2) * lh, "#ffffff", 18));
      break;
    }
    case "counter": {
      const s = ease.outBack(clamp(age / 0.3));
      const k = ease.outCubic(clamp(age / 0.9));
      const txt = counterText(o.text, k);
      ctx.translate(x, y);
      ctx.scale(s, s);
      const { lines, size } = wrap(ctx, o.text, 900, FONT_DISPLAY, 112);
      const lh = size * 1.1;
      const shown = wrapLike(txt, lines);
      shown.forEach((ln, i) => outlinedText(ctx, ln, 0, (i - (shown.length - 1) / 2) * lh, i === 0 ? "#ffd84d" : "#ffffff", 18));
      break;
    }
    case "stamp": {
      const k = clamp(age / 0.22);
      const s = 2.4 - 1.4 * ease.outQuad(k);
      ctx.globalAlpha = clamp(k * 1.6);
      ctx.translate(x, y);
      ctx.rotate(-10 * DEG);
      ctx.scale(s, s);
      const size = fitFont(ctx, o.text, FONT_DISPLAY, "bold", 120, 760);
      const w = ctx.measureText(o.text).width + 80;
      const h = size + 50;
      roundRect(ctx, -w / 2, -h / 2, w, h, 16);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#d62839";
      ctx.stroke();
      ctx.fillStyle = "#d62839";
      ctx.fillText(o.text, 0, 6);
      break;
    }
    case "label": {
      const s = ease.outBack(clamp(age / 0.3));
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawLabel(ctx, o.text, 0, 0, 52);
      break;
    }
  }
  ctx.restore();
}

export function drawLabel(ctx: Ctx, text: string, x: number, y: number, size = 46) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px ${FONT_DISPLAY}`;
  const w = ctx.measureText(text).width + 40;
  const h = size + 22;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = "#fff6df";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillText(text, x, y + 3);
  ctx.restore();
}

function wrap(ctx: Ctx, text: string, maxW: number, family: string, size: number): { lines: string[]; size: number } {
  ctx.font = `bold ${size}px ${family}`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > 3 && size > 40) return wrap(ctx, text, maxW, family, size - 12);
  return { lines, size };
}

/** Chia `txt` theo cùng số từ mỗi dòng như `lines` */
function wrapLike(txt: string, lines: string[]): string[] {
  const words = txt.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  for (const ln of lines) {
    const n = ln.split(/\s+/).length;
    out.push(words.slice(i, i + n).join(" "));
    i += n;
  }
  return out;
}

// ───────── Phụ đề ─────────

/** Nhóm từ thành cụm phụ đề ngắn (≤ 4 từ / 22 ký tự, ngắt ở dấu câu) */
export function subtitleChunks(words: Word[], from: number, to: number): [number, number][] {
  const chunks: [number, number][] = [];
  let s = from;
  let len = 0;
  for (let i = from; i <= to; i++) {
    const w = words[i];
    len += w.text.length + 1;
    const n = i - s + 1;
    const punct = /[.,!?;:]$/.test(w.text);
    if (n >= 4 || len > 22 || punct || i === to) {
      chunks.push([s, i]);
      s = i + 1;
      len = 0;
    }
  }
  return chunks;
}

export function drawSubtitles(ctx: Ctx, words: Word[], range: [number, number], t: number, y = 1480) {
  if (!words.length) return;
  const chunks = subtitleChunks(words, range[0], range[1]);
  let active: [number, number] | null = null;
  for (const c of chunks) {
    const st = words[c[0]].start - 0.05;
    const next = chunks[chunks.indexOf(c) + 1];
    const en = next ? words[next[0]].start - 0.05 : words[c[1]].end + 0.4;
    if (t >= st && t < en) active = c;
  }
  if (!active) return;
  const ws = words.slice(active[0], active[1] + 1);
  ctx.save();
  const size = fitFont(ctx, ws.map((w) => w.text).join(" ").toUpperCase(), FONT_SUB, "900", 76, 940);
  ctx.font = `900 ${size}px ${FONT_SUB}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const parts = ws.map((w) => w.text.toUpperCase());
  const space = ctx.measureText(" ").width;
  const widths = parts.map((p) => ctx.measureText(p).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (parts.length - 1);
  let x = WORLD_W / 2 - total / 2;
  const pop = ease.outBack(clamp((t - words[active[0]].start + 0.05) / 0.18));
  ctx.translate(WORLD_W / 2, y);
  ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
  ctx.translate(-WORLD_W / 2, -y);
  parts.forEach((p, i) => {
    const w = ws[i];
    const on = t >= w.start - 0.02 && t < (ws[i + 1]?.start ?? w.end + 0.4);
    outlinedText(ctx, p, x, y, on ? "#ffd84d" : "#ffffff", 14);
    x += widths[i] + space;
  });
  ctx.restore();
}
