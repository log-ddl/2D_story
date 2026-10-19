// Nhân vật chibi dựng hoàn toàn bằng tham số: rig khớp + khuôn mặt bằng đường cong.
// Phụ kiện (mũ, vũ khí…) là module SVG trong thư viện.

import type { CharacterSpec } from "../schema";
import { DEG, blinkAmount, clamp, darken, hash, lerp, lighten, noise1, rng } from "./math";
import { drawModule, type SvgModule } from "./svg";

export const OUTLINE = "#2b2233";
const LW = 5.5;

// ───────── Tư thế ─────────

export interface Pose {
  /** [vai, khuỷu] độ; dương = xoay ra ngoài thân */
  armL: [number, number];
  armR: [number, number];
  torso: number;
  head: number;
  sit?: boolean;
  /** Hàm chuyển động riêng theo thời gian (vẫy tay, đi bộ…) */
  anim?: "wave" | "walk" | "cheer" | "tremble" | "fight";
}

export const POSES: Record<string, { label: string; pose: Pose }> = {
  stand: { label: "đứng", pose: { armL: [12, -8], armR: [12, -8], torso: 0, head: 0 } },
  point: { label: "chỉ tay", pose: { armL: [12, -8], armR: [100, -8], torso: -3, head: 4 } },
  raise_both: { label: "giơ hai tay", pose: { armL: [125, 15], armR: [125, 15], torso: 0, head: 0 } },
  hands_hips: { label: "chống hông", pose: { armL: [48, -105], armR: [48, -105], torso: 0, head: 3 } },
  shrug: { label: "nhún vai", pose: { armL: [55, 75], armR: [55, 75], torso: 0, head: -6 } },
  cross_arms: { label: "khoanh tay", pose: { armL: [-8, -112], armR: [-8, -104], torso: 0, head: -4 } },
  wave: { label: "vẫy tay", pose: { armL: [12, -8], armR: [118, 30], torso: 2, head: 5, anim: "wave" } },
  think: { label: "suy nghĩ", pose: { armL: [-10, -88], armR: [-25, -138], torso: 0, head: 8 } },
  sit: { label: "ngồi", pose: { armL: [25, -40], armR: [25, -40], torso: 0, head: 0, sit: true } },
  walk: { label: "đi", pose: { armL: [10, -10], armR: [10, -10], torso: 2, head: 0, anim: "walk" } },
  cheer: { label: "reo hò", pose: { armL: [122, 22], armR: [122, 22], torso: 0, head: -4, anim: "cheer" } },
  hold_up: { label: "giơ vật", pose: { armL: [12, -8], armR: [128, 8], torso: -2, head: -6 } },
  fight: { label: "thủ thế", pose: { armL: [40, -70], armR: [70, -60], torso: 4, head: 0, anim: "fight" } },
  cower: { label: "co rúm", pose: { armL: [-20, -130], armR: [-20, -130], torso: 6, head: 10, anim: "tremble" } },
};

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => lerp(x, y, t);
  return {
    armL: [l(a.armL[0], b.armL[0]), l(a.armL[1], b.armL[1])],
    armR: [l(a.armR[0], b.armR[0]), l(a.armR[1], b.armR[1])],
    torso: l(a.torso, b.torso),
    head: l(a.head, b.head),
    sit: t < 0.5 ? a.sit : b.sit,
    anim: t < 0.5 ? a.anim : b.anim,
  };
}

// ───────── Nét mặt ─────────

export interface Face {
  eye: "dot" | "happy" | "wide" | "line";
  eyeOpen: number;
  browAngle: number; // độ; dương = đầu trong hạ xuống (giận)
  browY: number; // dương = nâng
  mouthCurve: number; // -1 mếu → 1 cười
  mouthOpen: number;
  mouthWidth: number;
  teeth?: boolean;
  blush?: number;
  sweat?: boolean;
  tears?: boolean;
  anger?: boolean;
  pupil?: number;
}

export const EXPRESSIONS: Record<string, { label: string; face: Face }> = {
  neutral: { label: "bình thường", face: { eye: "dot", eyeOpen: 1, browAngle: 0, browY: 0, mouthCurve: 0.25, mouthOpen: 0, mouthWidth: 0.8 } },
  happy: { label: "vui", face: { eye: "dot", eyeOpen: 1, browAngle: -5, browY: 0.15, mouthCurve: 1, mouthOpen: 0.35, mouthWidth: 1, blush: 0.6 } },
  laugh: { label: "cười lớn", face: { eye: "happy", eyeOpen: 1, browAngle: -8, browY: 0.25, mouthCurve: 1, mouthOpen: 0.8, mouthWidth: 1.1, blush: 0.8, teeth: true } },
  sad: { label: "buồn", face: { eye: "dot", eyeOpen: 0.75, browAngle: -18, browY: 0.1, mouthCurve: -0.8, mouthOpen: 0, mouthWidth: 0.7 } },
  worried: { label: "lo", face: { eye: "dot", eyeOpen: 0.95, browAngle: -16, browY: 0.15, mouthCurve: -0.4, mouthOpen: 0.08, mouthWidth: 0.6, sweat: true } },
  angry: { label: "giận", face: { eye: "dot", eyeOpen: 0.7, browAngle: 24, browY: -0.1, mouthCurve: -0.7, mouthOpen: 0.3, mouthWidth: 0.9, teeth: true, anger: true } },
  surprised: { label: "ngạc nhiên", face: { eye: "wide", eyeOpen: 1.15, browAngle: -4, browY: 0.45, mouthCurve: 0, mouthOpen: 0.75, mouthWidth: 0.5, pupil: 0.55 } },
  smug: { label: "tự mãn", face: { eye: "line", eyeOpen: 0.5, browAngle: 10, browY: 0.1, mouthCurve: 0.7, mouthOpen: 0, mouthWidth: 0.85 } },
  scared: { label: "sợ", face: { eye: "wide", eyeOpen: 1.1, browAngle: -22, browY: 0.35, mouthCurve: -0.6, mouthOpen: 0.45, mouthWidth: 0.8, teeth: true, sweat: true, pupil: 0.45 } },
  determined: { label: "quyết tâm", face: { eye: "dot", eyeOpen: 0.85, browAngle: 16, browY: 0, mouthCurve: 0.1, mouthOpen: 0, mouthWidth: 0.7 } },
  confused: { label: "bối rối", face: { eye: "dot", eyeOpen: 0.9, browAngle: -12, browY: 0.2, mouthCurve: -0.2, mouthOpen: 0.12, mouthWidth: 0.5, sweat: true } },
  crying: { label: "khóc", face: { eye: "happy", eyeOpen: 1, browAngle: -20, browY: 0.15, mouthCurve: -1, mouthOpen: 0.55, mouthWidth: 0.9, tears: true } },
};

// ───────── Kích thước theo tuổi/vóc ─────────

interface Dims {
  R: number;
  bodyH: number;
  bodyW: number;
  leg: number;
  armU: number;
  armF: number;
  armW: number;
}

export function dims(spec: CharacterSpec): Dims {
  const base: Dims =
    spec.age === "kid"
      ? { R: 90, bodyH: 100, bodyW: 118, leg: 38, armU: 40, armF: 36, armW: 24 }
      : { R: 92, bodyH: 132, bodyW: 140, leg: 52, armU: 52, armF: 48, armW: 27 };
  const k = spec.build === "slim" ? 0.88 : spec.build === "stocky" ? 1.16 : 1;
  return { ...base, bodyW: base.bodyW * k, armW: base.armW * (spec.build === "stocky" ? 1.12 : 1) };
}

/** Chiều cao tổng (đơn vị nhân vật) — dùng cho khung camera */
export function characterHeight(spec: CharacterSpec) {
  const d = dims(spec);
  return d.leg + d.bodyH + d.R * 1.85;
}

// ───────── Biến thể cho nhân vật phụ (lính, đám đông) ─────────

const SKINS = ["#f6c9a0", "#eab88f", "#d9a577", "#f3d1b0", "#c98f63"];
const HAIRS = ["#3b2a1e", "#6b4226", "#c9a227", "#2a1f2e", "#8a4b2a", "#a0522d"];
const BEARDS = ["full", "mustache", "none", "goatee", "stubble", "full"];
const SHIELDS = ["#c8553d", "#3d6fb6", "#3f8f5a", "#d9a441", "#7b4fa0"];

export function variantSpec(spec: CharacterSpec, seed: number): CharacterSpec {
  if (!spec.generator) return spec;
  const r = rng(hash(spec.id, seed));
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const hair = pick(HAIRS);
  return {
    ...spec,
    skin: pick(SKINS),
    build: pick(["slim", "normal", "stocky"] as const),
    hair: { style: pick(["short", "curly", "short", "spiky"]), color: hair },
    beard: { style: pick(BEARDS), color: hair },
    outfit: { ...spec.outfit, trim: pick(SHIELDS) },
  };
}

// ───────── Vẽ ─────────

export interface CharacterDrawOpts {
  pose: string;
  expression: string;
  /** thời gian toàn cục (chớp mắt) */
  t: number;
  /** thời gian trong cảnh */
  u: number;
  /** độ mở miệng do nói 0..1 */
  talk: number;
  seed: number;
  getModule: (id: string) => SvgModule | undefined;
}

function outlinedFill(ctx: CanvasRenderingContext2D, fill: string, lw = LW) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/** Đoạn "ống" có viền: vẽ viền dày trước, lõi màu sau */
function limb(ctx: CanvasRenderingContext2D, pts: [number, number][], w: number, color: string) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + LW * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function armPoints(shoulder: [number, number], side: -1 | 1, a1: number, a2: number, u: number, f: number): [number, number][] {
  const d1 = a1 * DEG;
  const d2 = (a1 + a2) * DEG;
  const e: [number, number] = [shoulder[0] + side * Math.sin(d1) * u, shoulder[1] + Math.cos(d1) * u];
  const h: [number, number] = [e[0] + side * Math.sin(d2) * f, e[1] + Math.cos(d2) * f];
  return [shoulder, e, h];
}

function animatedPose(base: Pose, u: number, seed: number): Pose {
  const p: Pose = { ...base, armL: [...base.armL] as [number, number], armR: [...base.armR] as [number, number] };
  switch (base.anim) {
    case "wave":
      p.armR[1] = base.armR[1] + Math.sin(u * 9) * 28;
      break;
    case "walk": {
      const s = Math.sin(u * 7);
      p.armL[0] = base.armL[0] + s * 18;
      p.armR[0] = base.armR[0] - s * 18;
      break;
    }
    case "cheer": {
      const s = Math.sin(u * 8);
      p.armL[0] = base.armL[0] + s * 12;
      p.armR[0] = base.armR[0] - s * 12;
      break;
    }
    case "tremble":
      p.torso = base.torso + noise1(seed, u * 25) * 2.5;
      break;
    case "fight":
      p.armR[0] = base.armR[0] + Math.sin(u * 3) * 6;
      break;
  }
  return p;
}

export function drawCharacter(ctx: CanvasRenderingContext2D, rawSpec: CharacterSpec, o: CharacterDrawOpts) {
  const spec = variantSpec(rawSpec, o.seed);
  const d = dims(spec);
  const basePose = POSES[o.pose]?.pose ?? POSES.stand.pose;
  const pose = animatedPose(basePose, o.u, o.seed);
  const face = { ...(EXPRESSIONS[o.expression]?.face ?? EXPRESSIONS.neutral.face) };
  const phase = (o.seed % 1000) / 160;

  // Chuyển động thân: thở, nhún, bước
  const breathe = Math.sin((o.u / 2.8) * Math.PI * 2 + phase);
  let bob = 0;
  let legSwing = 0;
  if (pose.anim === "walk") {
    bob = Math.abs(Math.sin(o.u * 7)) * -6;
    legSwing = Math.sin(o.u * 7) * 16;
  } else if (pose.anim === "cheer") bob = -Math.abs(Math.sin(o.u * 8)) * 14;
  const legLen = pose.sit ? d.leg * 0.6 : d.leg;

  const sleeve = sleeveColor(spec);
  ctx.save();
  ctx.translate(0, bob);

  // Áo choàng
  const hipY = -legLen;
  if (spec.cape) {
    ctx.beginPath();
    ctx.moveTo(-d.bodyW * 0.38, hipY - d.bodyH * 0.92);
    ctx.quadraticCurveTo(-d.bodyW * 0.75, hipY + legLen * 0.2, -d.bodyW * 0.62, -4);
    ctx.lineTo(d.bodyW * 0.62, -4);
    ctx.quadraticCurveTo(d.bodyW * 0.75, hipY + legLen * 0.2, d.bodyW * 0.38, hipY - d.bodyH * 0.92);
    ctx.closePath();
    outlinedFill(ctx, spec.cape);
  }

  // Chân
  const legX = d.bodyW * (pose.sit ? 0.24 : 0.2);
  const shoe = "#6b4226";
  for (const s of [-1, 1] as const) {
    const sw = s * legSwing;
    const top: [number, number] = [s * legX, hipY + 6];
    const foot: [number, number] = [s * legX + sw * 0.5, -8 - Math.max(0, -sw) * 0.3];
    if (spec.outfit.type !== "robe") limb(ctx, [top, foot], d.armW * 0.95, legColor(spec));
    ctx.beginPath();
    ctx.ellipse(foot[0] + s * 4, foot[1] + 4, d.armW * 0.62, d.armW * 0.38, 0, 0, Math.PI * 2);
    outlinedFill(ctx, shoe);
  }

  // Thân
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.torso * DEG + noise1(o.seed + 7, o.u * 0.6) * 0.012);
  ctx.scale(1, 1 + breathe * 0.012);
  drawBody(ctx, spec, d);

  // Tay
  const shY = -d.bodyH * 0.84;
  const shX = d.bodyW * 0.36;
  const arms = {
    L: armPoints([-shX, shY], -1, pose.armL[0], pose.armL[1], d.armU, d.armF),
    R: armPoints([shX, shY], 1, pose.armR[0], pose.armR[1], d.armU, d.armF),
  };
  // Cánh tay vắt ngang thân (khoanh tay) vẽ sau đầu? Không — vẽ trước đầu, sau thân.
  for (const k of ["L", "R"] as const) {
    const pts = arms[k];
    limb(ctx, [pts[0], pts[1]], d.armW, sleeve);
    limb(ctx, [pts[1], pts[2]], d.armW * 0.92, armSkin(spec));
    // Ống tay áo
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], d.armW * 0.62, 0, Math.PI * 2);
    outlinedFill(ctx, sleeve);
  }
  // Đạo cụ cầm tay (tay phải)
  const hand = arms.R[2];
  const fore = arms.R[1];
  if (spec.hand_prop) {
    const m = o.getModule(spec.hand_prop);
    if (m) {
      ctx.save();
      ctx.translate(hand[0], hand[1]);
      // Góc cẳng tay tính từ hướng "lên": tay buông → vũ khí dựng đứng,
      // tay ngang → vũ khí chĩa theo tay, tay giơ → vũ khí theo tay lên trời.
      let phi = Math.atan2(hand[0] - fore[0], -(hand[1] - fore[1]));
      if (Math.abs(phi) > Math.PI / 2) phi = Math.sign(phi) * (Math.PI - Math.abs(phi));
      ctx.rotate(spec.hand_prop === "shield" ? 0 : phi);
      ctx.scale(d.R / 100, d.R / 100);
      drawModule(ctx, m, { palette: { accent: spec.outfit.trim } });
      ctx.restore();
    }
  }
  for (const k of ["L", "R"] as const) {
    const h = arms[k][2];
    ctx.beginPath();
    ctx.arc(h[0], h[1], d.armW * 0.6, 0, Math.PI * 2);
    outlinedFill(ctx, spec.skin);
  }

  // Đầu
  ctx.save();
  ctx.translate(0, -d.bodyH + 4);
  const talkBob = o.talk > 0 ? noise1(o.seed + 3, o.u * 4) * 3 : 0;
  ctx.rotate((pose.head + talkBob + noise1(o.seed + 11, o.u * 0.4) * 2) * DEG);
  ctx.translate(0, -d.R * 0.8);
  drawHead(ctx, spec, d.R, face, o);
  ctx.restore();

  ctx.restore(); // thân
  ctx.restore(); // bob
}

function sleeveColor(spec: CharacterSpec) {
  switch (spec.outfit.type) {
    case "toga":
      return "#f3efe6";
    case "armor":
      return darken(spec.outfit.color, 0.1);
    default:
      return spec.outfit.color;
  }
}
const armSkin = (spec: CharacterSpec) => spec.skin;
const legColor = (spec: CharacterSpec) => (spec.outfit.type === "armor" ? darken(spec.outfit.trim, 0.35) : spec.skin);

function bodyPath(ctx: CanvasRenderingContext2D, d: Dims, long = false) {
  const wB = d.bodyW / 2;
  const wT = d.bodyW * 0.39;
  const h = d.bodyH;
  const bottom = long ? 40 : 6;
  ctx.beginPath();
  ctx.moveTo(-wT, -h);
  ctx.quadraticCurveTo(0, -h - 10, wT, -h);
  ctx.quadraticCurveTo(wB * 1.02, -h * 0.5, wB, bottom - 8);
  ctx.quadraticCurveTo(wB, bottom, wB - 10, bottom);
  ctx.lineTo(-wB + 10, bottom);
  ctx.quadraticCurveTo(-wB, bottom, -wB, bottom - 8);
  ctx.quadraticCurveTo(-wB * 1.02, -h * 0.5, -wT, -h);
  ctx.closePath();
}

function drawBody(ctx: CanvasRenderingContext2D, spec: CharacterSpec, d: Dims) {
  const { type, color, trim } = spec.outfit;
  const h = d.bodyH;
  const long = type === "robe";
  const base = type === "toga" ? "#f3efe6" : color;
  bodyPath(ctx, d, long);
  outlinedFill(ctx, base);
  ctx.save();
  bodyPath(ctx, d, long);
  ctx.clip();
  ctx.lineWidth = LW;
  ctx.strokeStyle = OUTLINE;
  switch (type) {
    case "tunic": {
      ctx.fillStyle = trim;
      ctx.fillRect(-d.bodyW, -h * 0.34, d.bodyW * 2, 16);
      ctx.strokeRect(-d.bodyW, -h * 0.34, d.bodyW * 2, 16);
      ctx.beginPath();
      ctx.moveTo(-16, -h - 4);
      ctx.lineTo(0, -h + 26);
      ctx.lineTo(16, -h - 4);
      ctx.fillStyle = spec.skin;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "toga": {
      ctx.beginPath();
      ctx.moveTo(-d.bodyW * 0.45, -h - 6);
      ctx.lineTo(-d.bodyW * 0.1, -h - 6);
      ctx.lineTo(d.bodyW * 0.6, -h * 0.05);
      ctx.lineTo(d.bodyW * 0.6, 20);
      ctx.lineTo(d.bodyW * 0.25, 20);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 3;
      for (const k of [0.3, 0.55, 0.8]) {
        ctx.beginPath();
        ctx.moveTo(-d.bodyW * 0.42, -h * k);
        ctx.quadraticCurveTo(-d.bodyW * 0.2, -h * (k - 0.06), -d.bodyW * 0.05, -h * (k + 0.05));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "armor": {
      ctx.fillStyle = lighten(color, 0.25);
      for (let i = 0; i < 4; i++) {
        const y = -h * 0.85 + i * h * 0.17;
        ctx.fillRect(-d.bodyW, y, d.bodyW * 2, h * 0.11);
        ctx.strokeRect(-d.bodyW, y, d.bodyW * 2, h * 0.11);
      }
      // Dải da (pteruges)
      ctx.fillStyle = trim;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const w = d.bodyW / n;
        const x = -d.bodyW / 2 + i * w;
        ctx.beginPath();
        ctx.rect(x + 2, -h * 0.18, w - 4, h * 0.3);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "robe": {
      ctx.fillStyle = trim;
      ctx.fillRect(-10, -h, 20, h + 50);
      ctx.strokeRect(-10, -h, 20, h + 50);
      break;
    }
    case "royal": {
      ctx.fillStyle = trim;
      ctx.fillRect(-14, -h, 28, h + 10);
      ctx.strokeRect(-14, -h, 28, h + 10);
      ctx.fillRect(-d.bodyW, -14, d.bodyW * 2, 24);
      ctx.strokeRect(-d.bodyW, -14, d.bodyW * 2, 24);
      ctx.beginPath();
      ctx.ellipse(0, -h + 6, d.bodyW * 0.36, 22, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#e84a5f";
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
  // Viền ngoài lần nữa để chi tiết không đè lên viền
  bodyPath(ctx, d, long);
  ctx.lineWidth = LW;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

// ───────── Đầu & mặt ─────────

function drawHead(ctx: CanvasRenderingContext2D, spec: CharacterSpec, R: number, f: Face, o: CharacterDrawOpts) {
  const hairStyle = spec.hair.style;
  const hairColor = spec.hair.color;

  if (hairStyle === "long") {
    ctx.beginPath();
    ctx.moveTo(-R * 1.08, -R * 0.2);
    ctx.quadraticCurveTo(-R * 1.25, R * 0.9, -R * 0.9, R * 1.15);
    ctx.lineTo(R * 0.9, R * 1.15);
    ctx.quadraticCurveTo(R * 1.25, R * 0.9, R * 1.08, -R * 0.2);
    ctx.closePath();
    outlinedFill(ctx, darken(hairColor, 0.08));
  }
  // Tai
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * R * 1.0, R * 0.12, R * 0.17, R * 0.2, 0, 0, Math.PI * 2);
    outlinedFill(ctx, spec.skin);
  }
  // Mặt
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 1.03, R * 0.96, 0, 0, Math.PI * 2);
  outlinedFill(ctx, spec.skin);

  drawFace(ctx, spec, R, f, o);
  drawHair(ctx, hairStyle, hairColor, R);
  if (spec.headwear && spec.headwear !== "none") {
    const m = o.getModule(spec.headwear);
    if (m) {
      ctx.save();
      ctx.scale(R / 100, R / 100);
      drawModule(ctx, m, { palette: { accent: spec.outfit.trim, main: spec.outfit.color } });
      ctx.restore();
    }
  }
}

function drawFace(ctx: CanvasRenderingContext2D, spec: CharacterSpec, R: number, f: Face, o: CharacterDrawOpts) {
  const blink = blinkAmount(o.t, o.seed);
  const open = f.eyeOpen * (1 - blink);
  const ex = R * 0.37;
  const ey = R * 0.14;
  const browCol = darken(spec.hair.style === "bald" ? spec.beard.color : spec.hair.color, 0.25);

  // Má hồng
  if (f.blush) {
    ctx.globalAlpha = 0.45 * f.blush;
    ctx.fillStyle = "#ff8fa3";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * R * 0.6, R * 0.42, R * 0.15, R * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Mắt
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * ex, ey);
    ctx.lineCap = "round";
    ctx.strokeStyle = OUTLINE;
    if (open < 0.18 || f.eye === "happy") {
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      if (f.eye === "happy") ctx.arc(0, R * 0.05, R * 0.11, Math.PI * 1.1, Math.PI * 1.9);
      else ctx.arc(0, -R * 0.04, R * 0.11, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (f.eye === "line") {
      ctx.lineWidth = R * 0.055;
      ctx.beginPath();
      ctx.moveTo(-R * 0.11, 0);
      ctx.quadraticCurveTo(0, R * 0.05 * open, R * 0.11, 0);
      ctx.stroke();
    } else if (f.eye === "wide") {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.14, R * 0.17 * open, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = R * 0.04;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, R * 0.01, R * 0.13 * (f.pupil ?? 0.5), 0, Math.PI * 2);
      ctx.fillStyle = spec.eyes;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.115, R * 0.155 * open, 0, 0, Math.PI * 2);
      ctx.fillStyle = spec.eyes;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-R * 0.035, -R * 0.055 * open, R * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(R * 0.04, R * 0.05 * open, R * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Lông mày
  ctx.strokeStyle = browCol;
  ctx.lineWidth = R * 0.075;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    const by = ey - R * 0.27 - f.browY * R * 0.12;
    const a = f.browAngle * DEG;
    const inner: [number, number] = [s * (ex - R * 0.12), by + Math.sin(a) * R * 0.09];
    const outer: [number, number] = [s * (ex + R * 0.13), by - Math.sin(a) * R * 0.09];
    ctx.beginPath();
    ctx.moveTo(inner[0], inner[1]);
    ctx.lineTo(outer[0], outer[1]);
    ctx.stroke();
  }

  // Mũi
  ctx.lineWidth = R * 0.035;
  ctx.strokeStyle = darken(spec.skin, 0.3);
  ctx.beginPath();
  ctx.arc(0, R * 0.3, R * 0.05, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  // Râu (trước miệng để miệng nằm trên)
  drawBeard(ctx, spec.beard.style, spec.beard.color, R, false);

  // Miệng
  const talkOpen = o.talk;
  const mOpen = Math.max(f.mouthOpen, talkOpen * 0.85);
  const w = R * 0.2 * f.mouthWidth * (1 - talkOpen * 0.25);
  const my = R * 0.5;
  const curve = f.mouthCurve;
  ctx.save();
  ctx.translate(0, my);
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (mOpen < 0.06) {
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.moveTo(-w, -curve * R * 0.04);
    ctx.quadraticCurveTo(0, curve * R * 0.16, w, -curve * R * 0.04);
    ctx.stroke();
  } else {
    const top = curve * R * 0.06 - mOpen * R * 0.04;
    const bot = mOpen * R * 0.36 + Math.max(0, curve) * R * 0.12;
    ctx.beginPath();
    ctx.moveTo(-w, -curve * R * 0.04);
    ctx.quadraticCurveTo(0, top, w, -curve * R * 0.04);
    ctx.quadraticCurveTo(0, bot, -w, -curve * R * 0.04);
    ctx.closePath();
    ctx.fillStyle = "#7a2433";
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (f.teeth) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w, top - R * 0.1, w * 2, R * 0.1 + R * 0.05);
    }
    ctx.fillStyle = "#e9707e";
    ctx.beginPath();
    ctx.ellipse(0, bot * 0.75, w * 0.6, Math.max(2, bot * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = R * 0.045;
    ctx.stroke();
  }
  ctx.restore();

  drawBeard(ctx, spec.beard.style, spec.beard.color, R, true);

  // Mồ hôi, nước mắt, dấu giận
  if (f.sweat) {
    ctx.save();
    ctx.translate(R * 0.82, -R * 0.35 + Math.sin(o.u * 3) * 3);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.14);
    ctx.quadraticCurveTo(R * 0.11, R * 0.04, 0, R * 0.08);
    ctx.quadraticCurveTo(-R * 0.11, R * 0.04, 0, -R * 0.14);
    outlinedFill(ctx, "#8fd3ff", 3.5);
    ctx.restore();
  }
  if (f.tears) {
    ctx.fillStyle = "#8fd3ff";
    ctx.globalAlpha = 0.85;
    for (const s of [-1, 1]) {
      const len = R * (0.35 + 0.1 * Math.sin(o.u * 6 + s));
      ctx.fillRect(s * ex - R * 0.05, ey + R * 0.08, R * 0.1, len);
    }
    ctx.globalAlpha = 1;
  }
  if (f.anger) {
    ctx.save();
    ctx.translate(R * 0.55, -R * 0.62);
    ctx.strokeStyle = "#e23d4b";
    ctx.lineWidth = R * 0.05;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(R * 0.04, R * 0.04);
      ctx.quadraticCurveTo(R * 0.06, R * 0.14, R * 0.14, R * 0.06);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBeard(ctx: CanvasRenderingContext2D, style: string, color: string, R: number, mustachePass: boolean) {
  if (!style || style === "none") return;
  if (!mustachePass) {
    if (style === "mustache" || style === "goatee") return;
    ctx.beginPath();
    const chin = style === "long" ? R * 1.65 : R * 1.22;
    ctx.moveTo(-R * 1.0, R * 0.02);
    ctx.quadraticCurveTo(-R * 1.0, chin * 0.85, 0, chin);
    ctx.quadraticCurveTo(R * 1.0, chin * 0.85, R * 1.0, R * 0.02);
    ctx.quadraticCurveTo(R * 0.85, R * 0.36, R * 0.55, R * 0.38);
    // chừa khoảng da quanh miệng để miệng luôn nhìn rõ
    ctx.quadraticCurveTo(R * 0.3, R * 0.8, 0, R * 0.8);
    ctx.quadraticCurveTo(-R * 0.3, R * 0.8, -R * 0.55, R * 0.38);
    ctx.quadraticCurveTo(-R * 0.85, R * 0.36, -R * 1.0, R * 0.02);
    ctx.closePath();
    if (style === "stubble") {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else outlinedFill(ctx, color);
    return;
  }
  if (style === "stubble") return;
  if (style === "goatee") {
    ctx.beginPath();
    ctx.moveTo(-R * 0.16, R * 0.74);
    ctx.quadraticCurveTo(0, R * 1.18, R * 0.16, R * 0.74);
    ctx.closePath();
    outlinedFill(ctx, color, 4);
  }
  // Ria mép
  ctx.beginPath();
  ctx.moveTo(0, R * 0.36);
  ctx.quadraticCurveTo(-R * 0.26, R * 0.3, -R * 0.36, R * 0.52);
  ctx.quadraticCurveTo(-R * 0.18, R * 0.46, 0, R * 0.47);
  ctx.quadraticCurveTo(R * 0.18, R * 0.46, R * 0.36, R * 0.52);
  ctx.quadraticCurveTo(R * 0.26, R * 0.3, 0, R * 0.36);
  ctx.closePath();
  outlinedFill(ctx, darken(color, 0.06), 4);
}

/** Tóc: phần mái phía trước, dựng từ cung tròn + răng cưa/lượn sóng */
function drawHair(ctx: CanvasRenderingContext2D, style: string, color: string, R: number) {
  if (style === "bald") return;
  if (style === "fringe") {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * R * 0.9, -R * 0.42);
      ctx.quadraticCurveTo(s * R * 1.12, -R * 0.2, s * R * 1.0, -R * 0.02);
      ctx.lineTo(s * R * 0.9, -R * 0.1);
      ctx.lineTo(s * R * 0.86, 0);
      ctx.quadraticCurveTo(s * R * 0.78, -R * 0.22, s * R * 0.9, -R * 0.42);
      ctx.closePath();
      outlinedFill(ctx, color, 4);
    }
    return;
  }
  if (style === "curly") {
    const bumps: [number, number, number][] = [];
    for (let a = 188; a <= 352; a += 18) {
      const r = a * DEG;
      bumps.push([Math.cos(r) * R * 0.97, Math.sin(r) * R * 0.9 - R * 0.08, R * 0.22]);
    }
    for (let i = -2; i <= 2; i++) bumps.push([i * R * 0.28, -R * 0.46 + Math.abs(i) * R * 0.06, R * 0.17]);
    ctx.lineWidth = LW * 2;
    ctx.strokeStyle = OUTLINE;
    for (const [x, y, r] of bumps) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    for (const [x, y, r] of bumps) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // vá phần giữa đỉnh đầu
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.6, R * 0.85, R * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.ellipse(0, -R * 0.05, R * 1.09, R * 1.03, 0, Math.PI * 1.0, Math.PI * 2.0);
  const sideY = style === "long" ? R * 0.55 : R * 0.12;
  ctx.lineTo(R * 1.06, sideY);
  ctx.quadraticCurveTo(R * 0.92, -R * 0.1, R * 0.8, -R * 0.32);
  if (style === "bowl") {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x0 = R * 0.8 - (i * R * 1.6) / n;
      const x1 = R * 0.8 - ((i + 1) * R * 1.6) / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, -R * 0.12, x1, -R * 0.36);
    }
  } else if (style === "spiky") {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x0 = R * 0.8 - (i * R * 1.6) / n;
      const x1 = R * 0.8 - ((i + 1) * R * 1.6) / n;
      ctx.lineTo((x0 + x1) / 2, -R * 0.18);
      ctx.lineTo(x1, -R * 0.5);
    }
  } else if (style === "long") {
    ctx.quadraticCurveTo(R * 0.3, -R * 0.35, 0, -R * 0.75);
    ctx.quadraticCurveTo(-R * 0.3, -R * 0.35, -R * 0.8, -R * 0.32);
  } else {
    // short: răng cưa nhẹ
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x0 = R * 0.8 - (i * R * 1.6) / n;
      const x1 = R * 0.8 - ((i + 1) * R * 1.6) / n;
      ctx.quadraticCurveTo(x0 - R * 0.08, -R * 0.26, (x0 + x1) / 2 - R * 0.04, -R * 0.24);
      ctx.quadraticCurveTo(x1 + R * 0.02, -R * 0.36, x1, -R * 0.44);
    }
  }
  ctx.quadraticCurveTo(-R * 0.92, -R * 0.1, -R * 1.06, sideY);
  ctx.closePath();
  outlinedFill(ctx, color);
  // Ánh tóc
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = lighten(color, 0.5);
  ctx.lineWidth = R * 0.06;
  ctx.beginPath();
  ctx.arc(-R * 0.25, -R * 0.35, R * 0.55, Math.PI * 1.25, Math.PI * 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export const clampTalk = (v: number) => clamp(v, 0, 1);
