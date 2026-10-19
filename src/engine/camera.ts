import type { Scene } from "../schema";
import type { Frame } from "./frame";
import { clamp, ease, fbm1, lerp } from "./math";

export interface Cam {
  cx: number;
  cy: number;
  zoom: number;
  rot: number;
}

const SHOT_ZOOM = { wide: 1, medium: 1.4, close: 1.9 } as const;

/**
 * Camera là hàm thuần của (cảnh, thời gian trong cảnh, điểm nhắm) trong tọa độ thế giới.
 * Luôn kẹp để khung hình không lộ ra ngoài thế giới.
 */
export function cameraAt(scene: Scene, u: number, focus: { x: number; y: number }, f: Frame): Cam {
  const { W, H } = f;
  const dur = Math.max(scene.duration, 0.1);
  const p = ease.inOutSine(clamp(u / dur));
  const base: number = SHOT_ZOOM[scene.camera.shot] ?? 1;
  let zoom: number = base;
  let cx = scene.camera.shot === "wide" ? W / 2 : focus.x;
  let cy = scene.camera.shot === "wide" ? H / 2 : focus.y;
  let rot = 0;
  const pan = Math.min(W, H) * 0.065;
  switch (scene.camera.move) {
    case "push_in":
      zoom = base * lerp(1, 1.14, p);
      if (scene.camera.shot === "wide") {
        cx = lerp(W / 2, focus.x, p * 0.5);
        cy = lerp(H / 2, focus.y, p * 0.35);
      }
      break;
    case "pull_out":
      zoom = base * lerp(1.16, 1, p);
      break;
    case "pan_left":
      zoom = Math.max(base, 1.18);
      cx += lerp(pan, -pan, p);
      break;
    case "pan_right":
      zoom = Math.max(base, 1.18);
      cx += lerp(-pan, pan, p);
      break;
    case "tilt_up":
      zoom = Math.max(base, 1.2);
      cy += lerp(pan * 2.2, -pan * 2.2, p);
      break;
    case "shake": {
      zoom = base * 1.06;
      const k = Math.max(0.25, 1 - u / 0.8);
      cx += fbm1(scene.seed, u * 9) * 22 * k;
      cy += fbm1(scene.seed + 5, u * 9) * 22 * k;
      rot = fbm1(scene.seed + 9, u * 6) * 0.012 * k;
      break;
    }
  }
  const hw = W / 2 / zoom;
  const hh = H / 2 / zoom;
  cx = clamp(cx, hw, W - hw);
  cy = clamp(cy, hh, H - hh);
  return { cx, cy, zoom, rot };
}

/** Camera cho một lớp có độ sâu d (parallax): lớp xa di chuyển/zoom ít hơn */
export function layerCam(cam: Cam, depth: number, f: Frame): Cam {
  return {
    cx: f.W / 2 + (cam.cx - f.W / 2) * depth,
    cy: f.H / 2 + (cam.cy - f.H / 2) * depth,
    zoom: 1 + (cam.zoom - 1) * depth,
    rot: cam.rot * depth,
  };
}

export function applyCam(ctx: CanvasRenderingContext2D, cam: Cam, f: Frame) {
  ctx.translate(f.W / 2, f.H / 2);
  ctx.rotate(cam.rot);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);
}
