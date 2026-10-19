// render(scene, t): hàm thuần dùng chung cho preview 60fps và xuất video.

import type { Episode, Scene, Word } from "../schema";
import { applyCam, cameraAt, layerCam, WORLD_H, WORLD_W } from "./camera";
import { characterHeight, drawCharacter } from "./character";
import { drawLayerBase, drawLighting, drawProcedural, drawWeather } from "./effects";
import type { Library } from "./library";
import { clamp, ease, hash } from "./math";
import { drawModule } from "./svg";
import { drawLabel, drawOverlay, drawSubtitles, FONT_DISPLAY } from "./text";
import { countSyllables } from "../pipeline/text";

type Ctx = CanvasRenderingContext2D;
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
}

export interface RenderEnv {
  library: Library;
  episode: Episode;
  /** Âm lượng voice 100 mẫu/giây, chuẩn hóa 0..1 (để nhép miệng) */
  envelope?: Float32Array | null;
  createCanvas?: (w: number, h: number) => CanvasLike;
}

export interface FrameOpts {
  width: number;
  height: number;
  subtitles?: boolean;
  overlays?: boolean;
  safeArea?: boolean;
}

const TRANSITION = 0.32;

export function sceneIndexAt(ep: Episode, t: number): number {
  const sc = ep.scenes;
  if (!sc.length) return -1;
  for (let i = 0; i < sc.length; i++) if (t < sc[i].end) return i;
  return sc.length - 1;
}

export function episodeDuration(ep: Episode): number {
  const last = ep.scenes[ep.scenes.length - 1];
  return Math.max(last?.end ?? 0, ep.audio?.duration ?? 0, ep.alignment?.duration ?? 0);
}

function wordsOf(ep: Episode): Word[] {
  return ep.alignment?.words ?? [];
}

export function renderFrame(ctx: Ctx, env: RenderEnv, t: number, opts: FrameOpts) {
  const ep = env.episode;
  const i = sceneIndexAt(ep, t);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.scale(opts.width / WORLD_W, opts.height / WORLD_H);
  if (i < 0) {
    drawEmpty(ctx, ep.title);
    ctx.restore();
    return;
  }
  const scene = ep.scenes[i];
  const u = t - scene.start;
  const prev = ep.scenes[i - 1];
  const inTransition = prev && scene.transition !== "cut" && u < TRANSITION && env.createCanvas;
  if (inTransition) {
    const k = ease.inOutQuad(clamp(u / TRANSITION));
    drawSceneWorld(ctx, env, prev, t - prev.start, t, opts);
    const off = offscreen(env, opts.width, opts.height);
    const octx = off.getContext("2d") as Ctx;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, opts.width, opts.height);
    octx.scale(opts.width / WORLD_W, opts.height / WORLD_H);
    drawSceneWorld(octx, env, scene, u, t, opts);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (scene.transition === "fade") {
      ctx.globalAlpha = k;
      ctx.drawImage(off as unknown as CanvasImageSource, 0, 0);
    } else {
      // whip: lia nhanh + vệt mờ chuyển động
      const dx = (1 - k) * opts.width;
      for (let g = 3; g >= 0; g--) {
        ctx.globalAlpha = g === 0 ? 1 : 0.18;
        ctx.drawImage(off as unknown as CanvasImageSource, dx + g * 40 * (1 - k), 0);
      }
    }
    ctx.restore();
  } else {
    drawSceneWorld(ctx, env, scene, u, t, opts);
  }
  if (opts.subtitles !== false && ep.subtitles) {
    const words = wordsOf(ep);
    if (words.length) drawSubtitles(ctx, words, [0, words.length - 1], t);
  }
  if (opts.safeArea) drawSafeArea(ctx);
  ctx.restore();
}

/** Vẽ một cảnh riêng lẻ (thumbnail / preview cảnh) */
export function renderScene(ctx: Ctx, env: RenderEnv, scene: Scene, u: number, opts: FrameOpts) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.scale(opts.width / WORLD_W, opts.height / WORLD_H);
  const t = scene.start + u;
  drawSceneWorld(ctx, env, scene, u, t, opts);
  if (opts.subtitles && env.episode.subtitles) {
    const words = wordsOf(env.episode);
    if (words.length) drawSubtitles(ctx, words, [scene.word_start, Math.min(scene.word_end, words.length - 1)], t);
  }
  ctx.restore();
}

const offscreenCache = new WeakMap<object, CanvasLike>();
function offscreen(env: RenderEnv, w: number, h: number): CanvasLike {
  let c = offscreenCache.get(env.library);
  if (!c || c.width !== w || c.height !== h) {
    c = env.createCanvas!(w, h);
    offscreenCache.set(env.library, c);
  }
  return c;
}

// ───────── Cảnh ─────────

interface Placed {
  idx: number;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  height: number;
}

function placeCharacters(env: RenderEnv, scene: Scene): Placed[] {
  const setting = env.library.getSetting(scene.background.setting);
  const used = new Map<string, number>();
  const out: Placed[] = [];
  scene.characters.forEach((p, idx) => {
    const spec = env.library.getCharacter(p.character);
    if (!spec) return;
    const mark = setting.marks[p.mark] ?? setting.marks.A ?? { x: 540, y: 1500, scale: 1.3 };
    const n = used.get(p.mark) ?? 0;
    used.set(p.mark, n + 1);
    const off = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 150 * mark.scale;
    out.push({ idx, x: mark.x + off, y: mark.y + n * 12, scale: mark.scale, flip: p.flip, height: characterHeight(spec) * mark.scale });
  });
  return out;
}

export function focusPoint(env: RenderEnv, scene: Scene): { x: number; y: number } {
  const placed = placeCharacters(env, scene);
  const setting = env.library.getSetting(scene.background.setting);
  if (!placed.length) return { x: WORLD_W / 2, y: setting.text_zone.y + 400 };
  let target = placed[0];
  const f = scene.camera.focus;
  const byId = placed.find((p) => scene.characters[p.idx].character === f);
  const speaking = placed.find((p) => scene.characters[p.idx].speaking);
  if (f !== "auto" && byId) target = byId;
  else if (speaking) target = speaking;
  return { x: target.x, y: target.y - target.height * 0.62 };
}

function talkAmount(env: RenderEnv, scene: Scene, t: number): number {
  const words = wordsOf(env.episode);
  for (let i = scene.word_start; i <= scene.word_end && i < words.length; i++) {
    const w = words[i];
    if (t < w.start) return 0;
    if (t <= w.end) {
      if (env.envelope?.length) {
        const v = env.envelope[Math.min(env.envelope.length - 1, Math.floor(t * 100))] ?? 0;
        return clamp((v - 0.06) * 2.4);
      }
      const n = Math.max(1, countSyllables(w.text));
      return Math.abs(Math.sin((Math.PI * n * (t - w.start)) / Math.max(0.05, w.end - w.start))) * 0.9;
    }
  }
  return 0;
}

function drawSceneWorld(ctx: Ctx, env: RenderEnv, scene: Scene, u: number, t: number, opts: FrameOpts) {
  const lib = env.library;
  const setting = lib.getSetting(scene.background.setting);
  const focus = focusPoint(env, scene);
  const cam = cameraAt(scene, u, focus);
  const placed = placeCharacters(env, scene).sort((a, b) => a.y - b.y);
  const lastLayer = setting.layers.length - 1;

  setting.layers.forEach((layer, li) => {
    ctx.save();
    applyCam(ctx, layerCam(cam, layer.depth));
    drawLayerBase(ctx, layer);
    for (const p of layer.procedural) drawProcedural(ctx, p, layer, hash(setting.id, li, scene.seed), t, lib.getModule);
    for (const it of layer.items) {
      if (it.module.startsWith("label:")) {
        drawLabel(ctx, it.module.slice(6), it.x, it.y, 44 * it.scale);
        continue;
      }
      const m = lib.getModule(it.module);
      if (!m) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.rot) ctx.rotate(it.rot);
      ctx.scale(it.flip ? -it.scale : it.scale, it.scale);
      drawModule(ctx, m);
      ctx.restore();
    }
    if (li === lastLayer) {
      for (const pr of scene.props) {
        const m = lib.getModule(pr.module);
        if (!m) continue;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(pr.rot);
        ctx.scale(pr.flip ? -pr.scale : pr.scale, pr.scale);
        drawModule(ctx, m);
        ctx.restore();
      }
      for (const p of placed) {
        const pl = scene.characters[p.idx];
        const spec = lib.getCharacter(pl.character)!;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.flip ? -p.scale : p.scale, p.scale);
        drawCharacter(ctx, spec, {
          pose: pl.pose,
          expression: pl.expression,
          t,
          u,
          talk: pl.speaking ? talkAmount(env, scene, t) : 0,
          seed: hash(scene.seed, pl.character, p.idx),
          getModule: lib.getModule,
        });
        ctx.restore();
      }
    }
    ctx.restore();
  });

  // Không gian màn hình
  drawWeather(ctx, scene.background.weather, scene.seed, t);
  const lighting = scene.background.lighting === "auto" ? setting.base_lighting : scene.background.lighting;
  const screenFocus = {
    x: (focus.x - cam.cx) * cam.zoom + WORLD_W / 2,
    y: (focus.y - cam.cy) * cam.zoom + WORLD_H / 2,
  };
  drawLighting(ctx, lighting, screenFocus, t);

  if (opts.overlays !== false) {
    const words = wordsOf(env.episode);
    for (const o of scene.overlays) {
      const at = o.at_word != null && words[o.at_word] ? words[o.at_word].start : scene.start + 0.1;
      drawOverlay(ctx, o, t - at, setting.text_zone, scene.seed);
    }
  }
}

function drawEmpty(ctx: Ctx, title: string) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#2a2140");
  g.addColorStop(1, "#14101f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `bold 72px ${FONT_DISPLAY}`;
  ctx.fillText(title || "fxcine", WORLD_W / 2, WORLD_H / 2);
  ctx.font = `36px ${FONT_DISPLAY}`;
  ctx.fillStyle = "#a99cc8";
  ctx.fillText("Chưa có cảnh — hãy nhập kịch bản", WORLD_W / 2, WORLD_H / 2 + 80);
}

function drawSafeArea(ctx: Ctx) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  // Vùng an toàn của Shorts/TikTok: tránh 260px dưới và 140px phải (nút tương tác)
  ctx.strokeRect(60, 150, WORLD_W - 200, WORLD_H - 150 - 330);
  ctx.restore();
}

/** Danh sách module dùng trong cảnh (để QA thiếu asset) */
export function missingAssets(env: RenderEnv, scene: Scene): string[] {
  const miss: string[] = [];
  if (!env.library.settings.has(scene.background.setting)) miss.push(`bối cảnh "${scene.background.setting}"`);
  for (const c of scene.characters) if (!env.library.getCharacter(c.character)) miss.push(`nhân vật "${c.character}"`);
  for (const p of scene.props) if (!env.library.getModule(p.module)) miss.push(`module "${p.module}"`);
  return miss;
}

export { drawModule };
