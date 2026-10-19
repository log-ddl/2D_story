// Chữ do engine render (không để AI vẽ): bảng treo, tiêu đề, dấu mộc, nhãn, bộ đếm, phụ đề.

import type { Overlay, Word } from "../schema";
import { OUTLINE } from "./character";
import { DEG, clamp, ease, spring } from "./math";

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
export function drawOverlay(ctx: Ctx, o: Overlay, age: number, zone: { x: number; y: number }, seed: number, W = 1080) {
  if (age < 0) return;
  const x = o.x ?? zone.x;
  const y = o.y ?? zone.y;
  const maxW = Math.min(900, W * 0.84);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  switch (o.style) {
    case "banner": {
      // Bảng gỗ treo bằng 2 dây, rơi xuống rồi đung đưa tắt dần
      const drop = spring(age, 2.2, 0.45);
      const swing = Math.sin(age * 5) * Math.exp(-age * 2.2) * 6 * DEG + Math.sin(age * 1.3 + seed) * 0.6 * DEG;
      const by = -300 + (y + 300) * drop;
      const size = fitFont(ctx, o.text, FONT_DISPLAY, "bold", 92, maxW - 140);
      const w = Math.min(maxW, ctx.measureText(o.text).width + 120);
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
      const { lines, size } = wrap(ctx, o.text, maxW, FONT_DISPLAY, 110);
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
      const { lines, size } = wrap(ctx, o.text, maxW, FONT_DISPLAY, 112);
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
      const size = fitFont(ctx, o.text, FONT_DISPLAY, "bold", 120, maxW - 140);
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
    case "chart": {
      // "Rome:1229; Byzantium:1123" → cột mọc dần, số chạy
      const items = o.text.split(/[;|\n]/).map((x) => x.split(":")).filter((x) => x.length === 2).map(([l, v]) => ({ l: l.trim(), v: parseFloat(v.replace(/[^\d.-]/g, "")) || 0 }));
      if (!items.length) break;
      const max = Math.max(...items.map((i) => i.v), 1);
      const cw = maxW;
      const ch = Math.min(420, cw * 0.5);
      ctx.translate(x - cw / 2, y - ch / 2);
      roundRect(ctx, -24, -24, cw + 48, ch + 90, 22);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      const bw = (cw / items.length) * 0.62;
      const colors = ["#ff7a1a", "#4aa3df", "#6cbf5a", "#9b7be0", "#e84a5f", "#f2c14e"];
      items.forEach((it, i) => {
        const k = ease.outCubic(clamp((age - i * 0.15) / 0.8));
        const h = (it.v / max) * (ch - 50) * k;
        const bx = (i + 0.5) * (cw / items.length) - bw / 2;
        roundRect(ctx, bx, ch - h, bw, Math.max(1, h), 10);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = OUTLINE;
        ctx.font = `bold 34px ${FONT_SUB}`;
        ctx.fillText(Math.round(it.v * k).toLocaleString("en-US"), bx + bw / 2, ch - h - 26);
        ctx.font = `bold 30px ${FONT_DISPLAY}`;
        ctx.fillText(it.l, bx + bw / 2, ch + 34);
      });
      break;
    }
    case "timeline": {
      // "753 BC|476 AD|1453 AD" → trục thời gian, mốc hiện lần lượt
      const marks = o.text.split(/[|;]/).map((x) => x.trim()).filter(Boolean);
      if (!marks.length) break;
      const tw = maxW;
      ctx.translate(x - tw / 2, y);
      const prog = ease.inOutCubic(clamp(age / (0.6 + marks.length * 0.45)));
      ctx.lineCap = "round";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tw, 0);
      ctx.stroke();
      ctx.strokeStyle = "#f5e6c4";
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = "#ff7a1a";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(tw * prog, 0);
      ctx.stroke();
      marks.forEach((m, i) => {
        const mx = marks.length === 1 ? tw / 2 : (i / (marks.length - 1)) * tw;
        const on = clamp((prog * tw - mx) / 60 + 1);
        const sc = ease.outBack(on);
        ctx.save();
        ctx.translate(mx, 0);
        ctx.scale(sc || 0.001, sc || 0.001);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fillStyle = "#ffd84d";
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        drawLabel(ctx, m, 0, i % 2 ? 78 : -78, 40);
        ctx.restore();
      });
      break;
    }
    case "versus": {
      // "Rome VS Carthage" → hai huy hiệu trượt vào từ hai bên + chữ VS
      const [a, b] = o.text.split(/\s+vs\.?\s+/i);
      const k = ease.outBack(clamp(age / 0.45));
      ctx.translate(x, y);
      const side = (txt: string, dir: -1 | 1, color: string) => {
        ctx.save();
        ctx.translate(dir * (maxW * 0.28 + (1 - k) * 600), 0);
        ctx.rotate(dir * -4 * DEG);
        const w = maxW * 0.44;
        fitFont(ctx, txt, FONT_DISPLAY, "bold", 84, w - 50);
        roundRect(ctx, -w / 2, -72, w, 144, 30);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(txt, 0, 6);
        ctx.restore();
      };
      side(a ?? o.text, -1, "#e84a5f");
      side(b ?? "", 1, "#4aa3df");
      const vs = ease.outElastic(clamp((age - 0.3) / 0.6));
      ctx.scale(vs || 0.001, vs || 0.001);
      ctx.font = `bold 96px ${FONT_DISPLAY}`;
      outlinedText(ctx, "VS", 0, 6, "#ffd84d", 16);
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

export const SUBTITLE_STYLES = ["karaoke", "clean", "pop"] as const;
export type SubtitleStyle = (typeof SUBTITLE_STYLES)[number];

export function drawSubtitles(ctx: Ctx, words: Word[], range: [number, number], t: number, W = 1080, H = 1920, style: SubtitleStyle = "karaoke") {
  if (!words.length) return;
  const portrait = H > W;
  const y = H * (portrait ? 0.77 : 0.86);
  const unit = Math.min(W, H) / 1080;
  const chunks = style === "pop" ? Array.from({ length: range[1] - range[0] + 1 }, (_, i): [number, number] => [range[0] + i, range[0] + i]) : subtitleChunks(words, range[0], range[1]);
  let active: [number, number] | null = null;
  for (let ci = 0; ci < chunks.length; ci++) {
    const c = chunks[ci];
    const st = words[c[0]].start - 0.05;
    const next = chunks[ci + 1];
    const en = next ? words[next[0]].start - 0.05 : words[c[1]].end + 0.4;
    if (t >= st && t < en) active = c;
  }
  if (!active) return;
  const ws = words.slice(active[0], active[1] + 1);
  ctx.save();
  if (style === "clean") {
    const text = ws.map((w) => w.text).join(" ");
    const size = fitFont(ctx, text, FONT_SUB, "700", 54 * unit, W * 0.8);
    ctx.font = `700 ${size}px ${FONT_SUB}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    roundRect(ctx, W / 2 - tw / 2 - 28 * unit, y - size * 0.8, tw + 56 * unit, size * 1.6, 18 * unit);
    ctx.fillStyle = "rgba(15,10,20,0.62)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, W / 2, y + 2);
    ctx.restore();
    return;
  }
  const base = style === "pop" ? 104 : 76;
  const size = fitFont(ctx, ws.map((w) => w.text).join(" ").toUpperCase(), FONT_SUB, "900", base * unit, W * 0.87);
  ctx.font = `900 ${size}px ${FONT_SUB}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const parts = ws.map((w) => w.text.toUpperCase());
  const space = ctx.measureText(" ").width;
  const widths = parts.map((p) => ctx.measureText(p).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (parts.length - 1);
  let x = W / 2 - total / 2;
  const pop = ease.outBack(clamp((t - words[active[0]].start + 0.05) / 0.18));
  const sc = style === "pop" ? 0.6 + 0.4 * pop : 0.85 + 0.15 * pop;
  ctx.translate(W / 2, y);
  ctx.scale(sc, sc);
  ctx.translate(-W / 2, -y);
  parts.forEach((p, i) => {
    const w = ws[i];
    const on = style === "pop" || (t >= w.start - 0.02 && t < (ws[i + 1]?.start ?? w.end + 0.4));
    outlinedText(ctx, p, x, y, on ? "#ffd84d" : "#ffffff", 14 * unit);
    x += widths[i] + space;
  });
  ctx.restore();
}
