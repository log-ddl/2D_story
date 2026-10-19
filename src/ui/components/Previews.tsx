import { useEffect, useRef } from "react";
import { drawCharacter } from "../../engine/character";
import type { Library } from "../../engine/library";
import { renderScene } from "../../engine/render";
import { compileModule, drawModule, type SvgModule } from "../../engine/svg";
import { Episode, Scene, type CharacterSpec } from "../../schema";

function useCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void, animate: boolean, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(c.clientWidth * dpr);
      const h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, (performance.now() - t0) / 1000);
      if (animate) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function CharacterPreview({ spec, pose, expression, library, talk = false, className }: { spec: CharacterSpec; pose: string; expression: string; library: Library; talk?: boolean; className?: string }) {
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const k = h / 470;
      ctx.translate(w / 2, h - 18 * k);
      ctx.scale(k, k);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 90, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter(ctx, spec, { pose, expression, t, u: t, talk: talk ? Math.abs(Math.sin(t * 9)) * 0.9 : 0, seed: 11, getModule: library.getModule });
    },
    true,
    [spec, pose, expression, library, talk],
  );
  return <canvas ref={ref} className={className} />;
}

/** Vẽ module vừa khung (dựa vào viewBox) */
export function ModulePreview({ svg, module, className }: { svg?: string; module?: SvgModule; className?: string }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      let m = module;
      try {
        if (!m && svg) m = compileModule("preview", svg);
      } catch (e) {
        ctx.fillStyle = "#ef5a5a";
        ctx.font = "12px sans-serif";
        ctx.fillText((e as Error).message, 8, 20);
        return;
      }
      if (!m) return;
      const [vx, vy, vw, vh] = m.viewBox;
      const k = Math.min((w * 0.86) / vw, (h * 0.86) / vh);
      ctx.translate(w / 2, h / 2);
      ctx.scale(k, k);
      ctx.translate(-(vx + vw / 2) + m.anchor[0], -(vy + vh / 2) + m.anchor[1]);
      drawModule(ctx, m);
    },
    false,
    [svg, module],
  );
  return <canvas ref={ref} className={className} />;
}

export function SettingPreview({ settingId, library, className }: { settingId: string; library: Library; className?: string }) {
  const ref = useCanvas(
    (ctx, w, h, t) => {
      const scene = Scene.parse({ id: "p", word_start: 0, word_end: 0, narration: "", start: 0, end: 4, duration: 4, background: { setting: settingId }, camera: { shot: "wide", move: "static" } });
      const ep = Episode.parse({ id: "p", title: "", script_text: "", scenes: [scene], subtitles: false });
      renderScene(ctx, { library, episode: ep }, scene, t, { width: w, height: h });
    },
    false,
    [settingId, library],
  );
  return <canvas ref={ref} className={className} style={{ aspectRatio: "9/16" }} />;
}
