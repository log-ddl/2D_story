// Phần tử procedural: nền, hạt thời tiết, ánh sáng. Tất cả là hàm của (seed, t).

import type { SettingSpec } from "../schema";
import { TAU, hash, hash01, rng } from "./math";
import { OUTLINE } from "./character";
import { drawModule, type SvgModule } from "./svg";
import { bleed, DESIGN_H, DESIGN_W, spreadX, type Frame } from "./frame";

type Ctx = CanvasRenderingContext2D;
type Layer = SettingSpec["layers"][number];
type Proc = Layer["procedural"][number];

const PAD_Y = 260;

export function drawLayerBase(ctx: Ctx, layer: Layer, f: Frame) {
  const PAD = bleed(f);
  const WORLD_W = DESIGN_W;
  const WORLD_H = DESIGN_H;
  if (layer.sky) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, layer.sky[0]);
    g.addColorStop(1, layer.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-PAD, -PAD_Y, WORLD_W + PAD * 2, WORLD_H + PAD_Y * 2);
  } else if (layer.fill) {
    ctx.fillStyle = layer.fill;
    ctx.fillRect(-PAD, -PAD_Y, WORLD_W + PAD * 2, WORLD_H + PAD_Y * 2);
  }
  if (layer.ground) {
    const { y, color, edge } = layer.ground;
    ctx.fillStyle = color;
    ctx.fillRect(-PAD, y, WORLD_W + PAD * 2, WORLD_H - y + PAD_Y);
    ctx.strokeStyle = edge ?? OUTLINE;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-PAD, y);
    ctx.lineTo(WORLD_W + PAD, y);
    ctx.stroke();
  }
}

export function drawProcedural(ctx: Ctx, p: Proc, layer: Layer, seed: number, t: number, getModule: (id: string) => SvgModule | undefined, f: Frame) {
  const PAD = bleed(f);
  const WORLD_W = DESIGN_W;
  const WORLD_H = DESIGN_H;
  const sx = (x: number) => spreadX(f, x);
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
      for (let i = -p.count * 2 - Math.ceil(PAD / 190); i <= p.count * 2 + Math.ceil(PAD / 190); i++) {
        const bx = vx + i * 190;
        const k = (gy - vy) / (WORLD_H + PAD_Y - vy);
        ctx.moveTo(vx + (bx - vx) * k, gy);
        ctx.lineTo(bx, WORLD_H + PAD_Y);
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
        const x = sx(ax + r() * aw);
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
        const span = WORLD_W + 2 * PAD;
        const x = ((r() * span + t * speed) % span) - PAD;
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
        const x = sx(ax + r() * aw) + Math.sin(t * 0.8 + i) * 10;
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
    // ───────── Bộ sinh cảnh vật có tham số (seed) ─────────
    case "skyline": {
      // dãy nhà cao tầng, cửa sổ sáng ngẫu nhiên
      const base = p.y ?? layer.ground?.y ?? 1300;
      const left = -PAD;
      const right = WORLD_W + PAD;
      let x = left;
      while (x < right) {
        const w = 90 + r() * 120;
        const h = 220 + r() * 520;
        ctx.fillStyle = r() < 0.5 ? (p.color ?? "#56607a") : (p.color2 ?? "#465069");
        ctx.fillRect(x, base - h, w - 8, h);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 5;
        ctx.strokeRect(x, base - h, w - 8, h);
        ctx.fillStyle = "#ffe08a";
        for (let wy = base - h + 24; wy < base - 30; wy += 46)
          for (let wx = x + 14; wx < x + w - 30; wx += 30) if (r() < 0.45) ctx.fillRect(wx, wy, 14, 22);
        x += w;
      }
      break;
    }
    case "forest": {
      const base = p.y ?? layer.ground?.y ?? 1300;
      const n = p.count;
      for (let i = 0; i < n; i++) {
        const x = sx(-PAD / 2 + (i / Math.max(1, n - 1)) * (WORLD_W + PAD)) + (r() - 0.5) * 60;
        const h = 220 + r() * 260;
        const w = h * (0.35 + r() * 0.15);
        const y = base + r() * 30;
        ctx.fillStyle = "#6b4226";
        ctx.fillRect(x - 10, y - 40, 20, 42);
        ctx.beginPath();
        if (r() < 0.6) {
          ctx.moveTo(x, y - h);
          ctx.lineTo(x + w / 2, y - 30);
          ctx.lineTo(x - w / 2, y - 30);
        } else ctx.ellipse(x, y - h * 0.55, w * 0.55, h * 0.45, 0, 0, TAU);
        ctx.closePath();
        ctx.fillStyle = r() < 0.5 ? (p.color ?? "#3f7a3a") : (p.color2 ?? "#4f9a45");
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
      }
      break;
    }
    case "mountains": {
      const base = p.y ?? layer.ground?.y ?? 1250;
      const n = p.count;
      for (let i = 0; i < n; i++) {
        const x = sx(-PAD / 2 + (i / Math.max(1, n - 1)) * (WORLD_W + PAD)) + (r() - 0.5) * 80;
        const h = 300 + r() * 380;
        const w = h * (1.1 + r() * 0.5);
        ctx.beginPath();
        ctx.moveTo(x - w / 2, base);
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + w / 2, base);
        ctx.closePath();
        ctx.fillStyle = r() < 0.5 ? (p.color ?? "#8a7fa8") : (p.color2 ?? "#7a6f98");
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        // tuyết trên đỉnh
        ctx.beginPath();
        ctx.moveTo(x - w * 0.14, base - h * 0.72);
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + w * 0.14, base - h * 0.72);
        ctx.lineTo(x + w * 0.05, base - h * 0.78);
        ctx.lineTo(x - w * 0.03, base - h * 0.7);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      break;
    }
    case "dunes": {
      const base = p.y ?? layer.ground?.y ?? 1300;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-PAD, WORLD_H + 300);
        const amp = 60 + k * 30;
        const ph = r() * TAU;
        for (let x = -PAD; x <= WORLD_W + PAD; x += 40) ctx.lineTo(x, base + k * 110 - amp * (0.5 + 0.5 * Math.sin(x / (260 + k * 90) + ph)));
        ctx.lineTo(WORLD_W + PAD, WORLD_H + 300);
        ctx.closePath();
        ctx.fillStyle = [p.color ?? "#e9b96e", p.color2 ?? "#ddaa5c", "#cf9b4e"][k];
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
      }
      break;
    }
    case "planets": {
      for (let i = 0; i < p.count; i++) {
        const x = sx(ax + r() * aw);
        const y = ay + r() * ah;
        const rad = 40 + r() * 110;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fillStyle = ["#e86a5a", "#6aa7ff", "#f2c14e", "#9b7be0", "#6cbf5a"][Math.floor(r() * 5)];
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
        if (r() < 0.5) {
          ctx.beginPath();
          ctx.ellipse(x, y, rad * 1.7, rad * 0.35, -0.3, 0, TAU);
          ctx.lineWidth = 8;
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.stroke();
        }
      }
      break;
    }
    case "wallpaper": {
      const limit = layer.ground?.y ?? WORLD_H;
      ctx.fillStyle = p.color ?? "rgba(255,255,255,0.12)";
      for (let x = -PAD; x < WORLD_W + PAD; x += 120) ctx.fillRect(x, 0 - 300, 60, limit + 300);
      // phào chân tường
      ctx.fillStyle = p.color2 ?? "#ffffff";
      ctx.fillRect(-PAD, limit - 40, WORLD_W + PAD * 2, 40);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 5;
      ctx.strokeRect(-PAD, limit - 40, WORLD_W + PAD * 2, 40);
      break;
    }
    case "planks": {
      const gy = layer.ground?.y ?? 1400;
      ctx.strokeStyle = p.color ?? "rgba(0,0,0,0.18)";
      ctx.lineWidth = 4;
      for (let y = gy + 60, row = 0; y < WORLD_H + 260; y += 70, row++) {
        ctx.beginPath();
        ctx.moveTo(-PAD, y);
        ctx.lineTo(WORLD_W + PAD, y);
        ctx.stroke();
        for (let x = -PAD + (row % 2) * 160; x < WORLD_W + PAD; x += 320) {
          ctx.beginPath();
          ctx.moveTo(x, y - 70);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      break;
    }
    case "road": {
      const gy = layer.ground?.y ?? 1400;
      ctx.fillStyle = p.color ?? "#5b5f6b";
      ctx.fillRect(-PAD, gy + 120, WORLD_W + PAD * 2, 260);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 6;
      ctx.strokeRect(-PAD, gy + 120, WORLD_W + PAD * 2, 260);
      ctx.fillStyle = "#ffe08a";
      const off = (t * 120) % 200;
      for (let x = -PAD - off; x < WORLD_W + PAD; x += 200) ctx.fillRect(x, gy + 240, 110, 18);
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

export function drawWeather(ctx: Ctx, kind: string, seed: number, t: number, W: number, H: number) {
  if (kind === "clear") return;
  const r = rng(hash(seed, kind));
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const N = Math.round(({ sparkles: 30, rain: 140, snow: 90, dust: 40, embers: 50, coins: 26, confetti: 70, leaves: 24 }[kind] ?? 30) * Math.max(1, (W * H) / (1080 * 1920)));
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

export function drawLighting(ctx: Ctx, kind: string, focus: { x: number; y: number }, t: number, W: number, H: number) {
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
      const g = ctx.createRadialGradient(focus.x, focus.y, 120, focus.x, focus.y, Math.max(W, H) * 0.36);
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
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.62);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(20,0,10,${0.55 + 0.05 * Math.sin(t * 2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
  }
  ctx.restore();
}

// ───────── Phong cách màu (color grade) toàn khung ─────────

export const GRADES = ["none", "warm", "cool", "pastel", "noir", "vintage"] as const;

export function drawGrade(ctx: Ctx, grade: string, W: number, H: number) {
  if (!grade || grade === "none") return;
  ctx.save();
  const vignette = (a: number) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(20,10,0,${a})`);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  switch (grade) {
    case "warm":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#ffe7cc";
      ctx.fillRect(0, 0, W, H);
      break;
    case "cool":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#dbe8ff";
      ctx.fillRect(0, 0, W, H);
      break;
    case "pastel":
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "rgba(255,240,250,0.28)";
      ctx.fillRect(0, 0, W, H);
      break;
    case "noir":
      ctx.globalCompositeOperation = "saturation";
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, W, H);
      vignette(0.5);
      break;
    case "vintage":
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#f3dcb4";
      ctx.fillRect(0, 0, W, H);
      vignette(0.35);
      break;
  }
  ctx.restore();
}

/** Seed ngẫu nhiên tất định cho từng hạt dùng lại ở chỗ khác */
export const particleSeed = (seed: number, i: number) => hash01(seed, i);
