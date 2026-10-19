import { useEffect, useRef } from "react";
import { ASPECTS, type Aspect } from "../../engine/frame";
import { renderFrame, renderScene, type RenderEnv } from "../../engine/render";
import type { Scene } from "../../schema";
import { clock } from "../clock";
import { useStore } from "../store";

const makeCanvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });

/** Hàng đợi vẽ thumbnail: mỗi lượt vẽ vài cái rồi nhường luồng chính, để chuyển trang không bị khựng */
const queue: (() => void)[] = [];
let pumping = false;
function enqueue(job: () => void) {
  queue.push(job);
  if (pumping) return;
  pumping = true;
  const pump = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 10) queue.shift()!();
    if (queue.length) setTimeout(pump, 0);
    else pumping = false;
  };
  setTimeout(pump, 0);
}

interface Props {
  /** Cảnh cụ thể; bỏ trống = toàn tập theo đồng hồ */
  scene?: Scene;
  /** Bám theo đồng hồ phát lại */
  live?: boolean;
  /** Thời điểm tĩnh trong cảnh (giây) khi không live */
  at?: number;
  /** Ảnh nhỏ: độ phân giải 1x, vẽ qua hàng đợi, rê chuột để chạy */
  thumb?: boolean;
  subtitles?: boolean;
  safeArea?: boolean;
  className?: string;
  onFps?: (fps: number) => void;
}

/** Canvas vẽ bằng engine theo tỷ lệ khung của tập */
export function Stage({ scene, live, at, thumb, subtitles = true, safeArea, className, onFps }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const library = useStore((s) => s.library);
  const aspect = useStore((s) => s.episode?.aspect ?? "9:16");
  const envelope = useStore((s) => s.audio?.envelope);
  const episode = useStore((s) => s.episode);
  const words = useStore((s) => s.episode?.alignment?.words);
  const subsOn = useStore((s) => s.episode?.subtitles);
  const style = useStore((s) => s.episode?.style);
  const envRef = useRef<RenderEnv | null>(null);
  envRef.current = episode ? { library, episode, envelope, createCanvas: makeCanvas } : null;
  const [aw, ah] = ASPECTS[aspect as Aspect];
  // Ảnh một cảnh chỉ vẽ lại khi chính cảnh đó (hoặc phụ đề/phong cách) đổi; toàn tập thì theo cả tập
  const deps: unknown[] = scene ? [scene, words, subsOn, style] : [episode];

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    let hovering = false;
    let hoverStart = 0;
    let frames = 0;
    let lastFps = performance.now();
    let disposed = false;
    const ctx = c.getContext("2d")!;

    const size = () => {
      const cw = c.clientWidth;
      if (!cw) return false; // đang ẩn → không vẽ
      const dpr = thumb ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(90, Math.round(cw * dpr));
      const h = Math.round((w * ah) / aw);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      return true;
    };

    const draw = () => {
      const env = envRef.current;
      if (!env || disposed || !size()) return;
      const o = { width: c.width, height: c.height, subtitles, safeArea };
      if (scene) {
        let u = at ?? scene.duration * 0.55;
        if (live) u = clock.now() - scene.start;
        else if (hovering) u = ((performance.now() - hoverStart) / 1000) % Math.max(0.5, scene.duration);
        renderScene(ctx, env, scene, Math.max(0, u), o);
      } else renderFrame(ctx, env, clock.now(), o);
      if (onFps) {
        frames++;
        const now = performance.now();
        if (now - lastFps > 500) {
          onFps((frames * 1000) / (now - lastFps));
          frames = 0;
          lastFps = now;
        }
      }
    };

    let running = false;
    const loop = () => {
      draw();
      if (!disposed && ((live && clock.playing) || hovering)) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    let unsub = () => {};
    if (live) {
      unsub = clock.subscribe(() => (clock.playing ? start() : draw()));
      if (clock.playing) start();
    }
    if (thumb) enqueue(draw);
    else draw();

    const enter = () => {
      if (!thumb) return;
      hovering = true;
      hoverStart = performance.now();
      start();
    };
    const leave = () => {
      if (!thumb) return;
      hovering = false;
      setTimeout(draw, 20);
    };
    c.addEventListener("mouseenter", enter);
    c.addEventListener("mouseleave", leave);
    let lastW = c.clientWidth;
    const ro = new ResizeObserver(() => {
      // chỉ vẽ lại khi thật sự đổi cỡ (gồm lúc trang được hiện lại sau khi ẩn)
      if (c.clientWidth !== lastW) {
        lastW = c.clientWidth;
        if (thumb) enqueue(draw);
        else draw();
      }
    });
    ro.observe(c);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      c.removeEventListener("mouseenter", enter);
      c.removeEventListener("mouseleave", leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, live, at, thumb, subtitles, safeArea, library, envelope, onFps, aw, ah]);

  return <canvas ref={ref} className={className} style={{ aspectRatio: `${aw} / ${ah}`, width: "100%", display: "block" }} />;
}
