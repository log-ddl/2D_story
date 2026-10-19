// Phần tử procedural: nền, hạt thời tiết, ánh sáng. Tất cả là hàm của (seed, t).

import type { SettingSpec } from "../schema";
import { TAU, hash, hash01, rng } from "./math";
import { OUTLINE } from "./character";
import { drawModule, type SvgModule } from "./svg";
import { WORLD_H, WORLD_W } from "./camera";

type Ctx = CanvasRenderingContext2D;
type Layer = SettingSpec["layers"][number];
type Proc = Layer["procedural"][number];

const PAD = 260;

export function drawLayerBase(ctx: Ctx, layer: Layer) {
  if (layer.sky) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, layer.sky[0]);
    g.addColorStop(1, layer.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-PAD, -PAD, WORLD_W + PAD * 2, WORLD_H + PAD * 2);
  } else if (layer.fill) {
    ctx.fillStyle = layer.fill;
    ctx.fillRect(-PAD, -PAD, WORLD_W + PAD * 2, WORLD_H + PAD * 2);
  }
  if (layer.ground) {
    const { y, color, edge } = layer.ground;
    ctx.fillStyle = color;
    ctx.fillRect(-PAD, y, WORLD_W + PAD * 2, WORLD_H - y + PAD);
    ctx.strokeStyle = edge ?? OUTLINE;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-PAD, y);
    ctx.lineTo(WORLD_W + PAD, y);
    ctx.stroke();
  }
}

export function drawProcedural(ctx: Ctx, p: Proc, layer: Layer, seed: number, t: number, getModule: (id: string) => SvgModule | undefined) {
  const r = rng(hash(seed, p.type));
  const [ax, ay, aw, ah] = p.area ?? [0, 0, WORLD_W, layer.ground?.y ?? WORLD_H];
  switch (p.type) {
    case "bricks": {
      ctx.strokeStyle = p.color ?? "rgba(0,0,0,0.1)";
      ctx.lineWidth = 4;
      const bh = 70;
      const bw = 150;
      const limit = layer.ground?.y ?? WORLD_H;
      for (let row = 0, y = 0; y < limit; row++, y += bh) {
        ctx.beginPath();
        ctx.moveTo(-PAD, y);
        ctx.lineTo(WORLD_W + PAD, y);
        for (let x = (row % 2) * (bw / 2) - PAD; x < WORLD_W + PAD; x += bw) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
        }
        ctx.stroke();
      }
      break;
    }
    case "tiles": {
      const gy = layer.ground?.y ?? 1400;
      ctx.strokeStyle = p.color ?? "rgba(0,0,0,0.15)";
      ctx.lineWidth = 4;
      const vx = WORLD_W / 2;
      const vy = gy - 500;
      ctx.beginPath();
      for (let i = -p.count * 2; i <= p.count * 2; i++) {
        const bx = vx + i * 190;
        const k = (gy - vy) / (WORLD_H + PAD - vy);
        ctx.moveTo(vx + (bx - vx) * k, gy);
        ctx.lineTo(bx, WORLD_H + PAD);
      }
      for (let j = 1; j <= p.count; j++) {
        const y = gy + Math.pow(j / p.count, 1.6) * (WORLD_H - gy + 60);
        ctx.moveTo(-PAD, y);
        ctx.lineTo(WORLD_W + PAD, y);
      }
      ctx.stroke();
      break;
    }
    case "stars": {
      for (let i = 0; i < p.count; i++) {
        const x = ax + r() * aw;
        const y = ay + r() * ah;
        const s = 8 + r() * 14;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + r() * 2) + r() * TAU);
        sparkle(ctx, x, y, s * tw, p.color ?? "#f7d774");
      }
      break;
    }
    case "clouds": {
      const m = getModule("cloud");
      if (!m) break;
      for (let i = 0; i < p.count; i++) {
        const speed = 6 + r() * 10;
        const span = WORLD_W + 600;
        const x = ((r() * span + t * speed) % span) - 300;
        const y = 150 + r() * 520;
        ctx.save();
        ctx.translate(x, y);
        const sc = 0.7 + r() * 0.8;
        ctx.scale(sc, sc);
        drawModule(ctx, m);
        ctx.restore();
      }
      break;
    }
    case "waves": {
      ctx.strokeStyle = p.color ?? "#9ccbe4";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (let i = 0; i < p.count; i++) {
        const x = ax + r() * aw + Math.sin(t * 0.8 + i) * 10;
        const y = ay + r() * ah;
        const w = 30 + r() * 30;
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.quadraticCurveTo(x - w / 2, y - 14, x, y);
        ctx.quadraticCurveTo(x + w / 2, y - 14, x + w, y);
        ctx.stroke();
      }
      break;
    }
    case "rays": {
      const cx = WORLD_W / 2;
      const cy = 760;
      const n = p.count;
      ctx.fillStyle = p.color ?? "rgba(255,255,255,0.3)";
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + t * 0.12;
        const a1 = a0 + (TAU / n) * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * 2600, cy + Math.sin(a0) * 2600);
        ctx.lineTo(cx + Math.cos(a1) * 2600, cy + Math.sin(a1) * 2600);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

export function sparkle(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fillStyle = color;
  ctx.fill();
}

// ───────── Thời tiết (không gian màn hình) ─────────

export function drawWeather(ctx: Ctx, kind: string, seed: number, t: number) {
  if (kind === "clear") return;
  const r = rng(hash(seed, kind));
  const W = WORLD_W;
  const H = WORLD_H;
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const N = { sparkles: 30, rain: 140, snow: 90, dust: 40, embers: 50, coins: 26, confetti: 70, leaves: 24 }[kind] ?? 30;
  for (let i = 0; i < N; i++) {
    const x0 = r() * W;
    const y0 = r() * H;
    const sp = r();
    const ph = r() * TAU;
    switch (kind) {
      case "sparkles": {
        const tw = Math.max(0, Math.sin(t * (2 + sp * 3) + ph));
        sparkle(ctx, x0, y0, (10 + sp * 18) * tw, "#fff3b0");
        break;
      }
      case "rain": {
        const y = wrap(y0 + t * (1800 + sp * 600), H + 100) - 50;
        const x = wrap(x0 - t * 300, W);
        ctx.strokeStyle = "rgba(170,200,255,0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 12, y + 46);
        ctx.stroke();
        break;
      }
      case "snow": {
        const y = wrap(y0 + t * (80 + sp * 80), H + 40) - 20;
        const x = x0 + Math.sin(t * 1.2 + ph) * 30;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(x, y, 5 + sp * 7, 0, TAU);
        ctx.fill();
        break;
      }
      case "dust": {
        const x = wrap(x0 + t * (20 + sp * 30), W);
        const y = y0 + Math.sin(t * 0.7 + ph) * 20;
        ctx.fillStyle = "rgba(230,200,150,0.35)";
        ctx.beginPath();
        ctx.arc(x, y, 8 + sp * 16, 0, TAU);
        ctx.fill();
        break;
      }
      case "embers": {
        const y = wrap(y0 - t * (90 + sp * 120), H);
        const x = x0 + Math.sin(t * 2 + ph) * 18;
        ctx.fillStyle = `rgba(255,${140 + Math.floor(sp * 80)},60,${0.5 + 0.5 * Math.sin(t * 5 + ph)})`;
        ctx.beginPath();
        ctx.arc(x, y, 4 + sp * 5, 0, TAU);
        ctx.fill();
        break;
      }
      case "coins": {
        const y = wrap(y0 + t * (380 + sp * 300), H + 120) - 60;
        const flip = Math.cos(t * (5 + sp * 4) + ph);
        ctx.save();
        ctx.translate(x0, y);
        ctx.scale(Math.max(0.15, Math.abs(flip)), 1);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, TAU);
        ctx.fillStyle = flip > 0 ? "#f2c14e" : "#e0a526";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "confetti":
      case "leaves": {
        const y = wrap(y0 + t * (160 + sp * 160), H + 60) - 30;
        const x = x0 + Math.sin(t * 1.6 + ph) * 40;
        const colors = kind === "leaves" ? ["#5fae52", "#9cc96b", "#c9a227"] : ["#e84a5f", "#f2c14e", "#4aa3df", "#6cbf5a", "#b07cd8"];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (2 + sp * 3) + ph);
        ctx.fillStyle = colors[i % colors.length];
        if (kind === "leaves") {
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 9, 0, 0, TAU);
          ctx.fill();
        } else ctx.fillRect(-9, -5, 18, 10);
        ctx.restore();
        break;
      }
    }
  }
}

// ───────── Ánh sáng ─────────

export function drawLighting(ctx: Ctx, kind: string, focus: { x: number; y: number }, t: number) {
  const W = WORLD_W;
  const H = WORLD_H;
  ctx.save();
  switch (kind) {
    case "dusk":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#ffd0a0";
      ctx.fillRect(0, 0, W, H);
      break;
    case "night":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#5f6fb8";
      ctx.fillRect(0, 0, W, H);
      break;
    case "spotlight": {
      const g = ctx.createRadialGradient(focus.x, focus.y, 120, focus.x, focus.y, 700);
      g.addColorStop(0, "rgba(10,5,20,0)");
      g.addColorStop(1, "rgba(10,5,20,0.78)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "dramatic": {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#ffb3a0";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(20,0,10,${0.55 + 0.05 * Math.sin(t * 2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
  }
  ctx.restore();
}

/** Seed ngẫu nhiên tất định cho từng hạt dùng lại ở chỗ khác */
export const particleSeed = (seed: number, i: number) => hash01(seed, i);
