// Khung hình theo tỷ lệ. Bối cảnh được thiết kế trong "không gian thiết kế" dọc 1080×1920;
// với khung ngang/vuông, engine cắt dải dọc quanh vùng quan tâm (focus_y), thu nhỏ đều và
// giãn vị trí theo chiều ngang để lấp đầy chiều rộng — vật thể không bao giờ bị méo.

export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export const ASPECTS = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
} as const;
export type Aspect = keyof typeof ASPECTS;
export const ASPECT_LIST = Object.keys(ASPECTS) as Aspect[];

export interface Frame {
  /** kích thước thế giới (= kích thước khung đầu ra ở độ phân giải chuẩn) */
  W: number;
  H: number;
  /** tỉ lệ thu nhỏ từ không gian thiết kế */
  k: number;
  /** mép trên của dải thiết kế được hiển thị */
  yTop: number;
  /** hệ số giãn ngang vị trí (không giãn hình) */
  spread: number;
}

const VISIBLE_SPAN = 1440;

export function frameFor(aspect: string, focusY = 1200): Frame {
  const [W, H] = ASPECTS[aspect as Aspect] ?? ASPECTS["9:16"];
  if (H / W > 1.5) return { W, H, k: 1, yTop: 0, spread: 1 };
  const k = H / VISIBLE_SPAN;
  const yTop = Math.max(0, Math.min(DESIGN_H - VISIBLE_SPAN, focusY - VISIBLE_SPAN / 2));
  const spread = Math.max(1, Math.min(1.75, ((W / k) / DESIGN_W) * 0.82));
  return { W, H, k, yTop, spread };
}

/** x trong không gian thiết kế sau khi giãn ngang */
export const spreadX = (f: Frame, x: number) => DESIGN_W / 2 + (x - DESIGN_W / 2) * f.spread;

/** Điểm thiết kế → thế giới */
export function toWorld(f: Frame, x: number, y: number): [number, number] {
  return [f.W / 2 + (x - DESIGN_W / 2) * f.spread * f.k, (y - f.yTop) * f.k];
}

/** Áp phép biến đổi thiết kế → thế giới (đều, không giãn) */
export function applyDesign(ctx: CanvasRenderingContext2D, f: Frame) {
  ctx.translate(f.W / 2, -f.yTop * f.k);
  ctx.scale(f.k, f.k);
  ctx.translate(-DESIGN_W / 2, 0);
}

/** Lề cần vẽ thêm hai bên (đơn vị thiết kế) để nền phủ kín khung rộng */
export const bleed = (f: Frame) => Math.max(260, (f.W / f.k - DESIGN_W) / 2 + 320);

/** Kích thước xuất theo cạnh ngắn (720/1080/2160) */
export function outputSize(aspect: string, short: number): [number, number] {
  const [W, H] = ASPECTS[aspect as Aspect] ?? ASPECTS["9:16"];
  const s = short / Math.min(W, H);
  const even = (v: number) => Math.round((v * s) / 2) * 2;
  return [even(W), even(H)];
}
