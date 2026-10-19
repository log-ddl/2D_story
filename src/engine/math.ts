// Hàm toán học dùng chung cho engine. Mọi ngẫu nhiên phải đi qua PRNG có seed.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp(invLerp(a, b, v));
  return t * t * (3 - 2 * t);
};

/** PRNG mulberry32 – tất định theo seed */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Băm số nguyên/chuỗi thành seed 32-bit */
export function hash(...parts: (number | string)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}

/** Giá trị ngẫu nhiên tất định tại một điểm nguyên */
export const hash01 = (seed: number, i: number) => rng(hash(seed, i))();

/** Value noise 1D mượt, giá trị trong [-1, 1] */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return lerp(a, b, u);
}

/** Noise phân dạng (fbm) 1D */
export function fbm1(seed: number, x: number, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise1(seed + o * 101, x * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return v;
}

// ───────── Easing ─────────

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
};

/**
 * Phản hồi lò xo tắt dần (giải tích) cho bước nhảy 0 → 1 tại t=0.
 * Tính trực tiếp từ t nên tất định, không cần mô phỏng từng bước.
 */
export function spring(t: number, freq = 4, damping = 0.35): number {
  if (t <= 0) return 0;
  const w = TAU * freq;
  const zeta = clamp(damping, 0.01, 0.99);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

/** Xung tam giác chớp nhoáng (dùng cho chớp mắt) */
export function blinkAmount(t: number, seed: number): number {
  // Mỗi chu kỳ 2.5–5.0s có một lần chớp dài 0.14s
  let acc = hash01(seed, 0) * 2;
  for (let i = 0; i < 400; i++) {
    const period = 2.5 + hash01(seed, i + 1) * 2.5;
    if (t < acc + period) {
      const local = t - acc;
      const blinkAt = period - 0.14;
      if (local < blinkAt) return 0;
      const k = (local - blinkAt) / 0.14;
      return 1 - Math.abs(k * 2 - 1);
    }
    acc += period;
  }
  return 0;
}

export function rotatePoint(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Trộn màu hex #rrggbb với tỉ lệ t */
export function mixColor(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(lerp(pa[0], pb[0], t));
  const g = Math.round(lerp(pa[1], pb[1], t));
  const bl = Math.round(lerp(pa[2], pb[2], t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function parseHex(c: string): [number, number, number] {
  let h = c.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const darken = (c: string, t = 0.2) => mixColor(c, "#000000", t);
export const lighten = (c: string, t = 0.2) => mixColor(c, "#ffffff", t);
