import { useEffect, useRef } from "react";
import { renderFrame, renderScene, type RenderEnv } from "../../engine/render";
import type { Scene } from "../../schema";
import { clock } from "../clock";
import { useStore } from "../store";

const makeCanvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });

interface Props {
  /** Cảnh cụ thể; bỏ trống = toàn tập theo đồng hồ */
  scene?: Scene;
  /** Bám theo đồng hồ phát lại */
  live?: boolean;
  /** Thời điểm tĩnh trong cảnh (giây) khi không live */
  at?: number;
  /** Tự chạy vòng lặp khi rê chuột (thumbnail) */
  hoverPlay?: boolean;
  subtitles?: boolean;
  safeArea?: boolean;
  className?: string;
  onFps?: (fps: number) => void;
}

/** Canvas 9:16 vẽ bằng engine, độ phân giải theo devicePixelRatio */
export function Stage({ scene, live, at, hoverPlay, subtitles = true, safeArea, className, onFps }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const library = useStore((s) => s.library);
  const episode = useStore((s) => s.episode);
  const envelope = useStore((s) => s.audio?.envelope);
  const envRef = useRef<RenderEnv | null>(null);
  envRef.current = episode ? { library, episode, envelope, createCanvas: makeCanvas } : null;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    let hovering = false;
    let hoverStart = 0;
    let frames = 0;
    let lastFps = performance.now();
    const ctx = c.getContext("2d")!;

    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(90, Math.round(r.width * dpr));
      const h = Math.round((w * 16) / 9);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    };

    const draw = () => {
      const env = envRef.current;
      if (!env) return;
      size();
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
      if ((live && clock.playing) || hovering) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    let unsub = () => {};
    if (live) {
      // chỉ chạy vòng rAF khi đang phát; khi dừng thì vẽ lại lúc tua
      unsub = clock.subscribe(() => (clock.playing ? start() : draw()));
      if (clock.playing) start();
    }
    draw();

    const enter = () => {
      if (!hoverPlay) return;
      hovering = true;
      hoverStart = performance.now();
      start();
    };
    const leave = () => {
      if (!hoverPlay) return;
      hovering = false;
      setTimeout(draw, 20);
    };
    c.addEventListener("mouseenter", enter);
    c.addEventListener("mouseleave", leave);
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      c.removeEventListener("mouseenter", enter);
      c.removeEventListener("mouseleave", leave);
    };
  }, [scene, live, at, hoverPlay, subtitles, safeArea, library, episode, envelope, onFps]);

  return <canvas ref={ref} className={className} style={{ aspectRatio: "9 / 16", width: "100%", display: "block" }} />;
}
