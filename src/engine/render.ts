// render(scene, t): hàm thuần dùng chung cho preview 60fps và xuất video.

import type { Episode, Scene, Word } from "../schema";
import { applyCam, cameraAt, layerCam } from "./camera";
import { evalActors, evalProps, visemeAt, type ActorBase, type ActorState } from "./actions";
import { characterHeight, drawCharacter } from "./character";
import { drawGrade, drawLayerBase, drawLighting, drawProcedural, drawWeather } from "./effects";
import { applyDesign, frameFor, spreadX, type Frame } from "./frame";
import type { Library } from "./library";
import { clamp, ease, hash, lerp } from "./math";
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

const wordsOf = (ep: Episode): Word[] => ep.alignment?.words ?? [];

/** Khung của một cảnh (tỷ lệ tập + vùng quan tâm của bối cảnh) */
export function sceneFrame(env: RenderEnv, scene: Scene | null): Frame {
  const focusY = scene ? env.library.getSetting(scene.background.setting).focus_y : 1200;
  return frameFor(env.episode.aspect, focusY);
}

/** Điểm thiết kế (x đã giãn) → thế giới */
const dw = (f: Frame, x: number, y: number) => ({ x: f.W / 2 + (x - 540) * f.k, y: (y - f.yTop) * f.k });

export function renderFrame(ctx: Ctx, env: RenderEnv, t: number, opts: FrameOpts) {
  const ep = env.episode;
  const i = sceneIndexAt(ep, t);
  const base = sceneFrame(env, ep.scenes[i] ?? null);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.scale(opts.width / base.W, opts.height / base.H);
  if (i < 0) {
    drawEmpty(ctx, ep.title, base);
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
    octx.scale(opts.width / base.W, opts.height / base.H);
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
  drawGrade(ctx, ep.style.grade, base.W, base.H);
  if (opts.subtitles !== false && ep.subtitles) {
    const words = wordsOf(ep);
    if (words.length) drawSubtitles(ctx, words, [0, words.length - 1], t, base.W, base.H, ep.style.subtitle);
  }
  if (opts.safeArea) drawSafeArea(ctx, base);
  ctx.restore();
}

/** Vẽ một cảnh riêng lẻ (thumbnail / preview cảnh) */
export function renderScene(ctx: Ctx, env: RenderEnv, scene: Scene, u: number, opts: FrameOpts) {
  const f = sceneFrame(env, scene);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, opts.width, opts.height);
  ctx.scale(opts.width / f.W, opts.height / f.H);
  const t = scene.start + u;
  drawSceneWorld(ctx, env, scene, u, t, opts);
  drawGrade(ctx, env.episode.style.grade, f.W, f.H);
  if (opts.subtitles && env.episode.subtitles) {
    const words = wordsOf(env.episode);
    if (words.length) drawSubtitles(ctx, words, [scene.word_start, Math.min(scene.word_end, words.length - 1)], t, f.W, f.H, env.episode.style.subtitle);
  }
  if (opts.safeArea) drawSafeArea(ctx, f);
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
  /** tọa độ thiết kế (x đã giãn ngang) */
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  height: number;
  st: ActorState;
}

/** Vị trí gốc theo mark + trạng thái sau khi áp các hành động tại thời điểm u */
function placeCharacters(env: RenderEnv, scene: Scene, f: Frame, u: number): Placed[] {
  const setting = env.library.getSetting(scene.background.setting);
  const used = new Map<string, number>();
  const bases: (ActorBase & { idx: number; height: number })[] = [];
  scene.characters.forEach((p, idx) => {
    const spec = env.library.getCharacter(p.character);
    const mark = setting.marks[p.mark] ?? setting.marks.A ?? { x: 540, y: 1500, scale: 1.3 };
    const n = used.get(p.mark) ?? 0;
    used.set(p.mark, n + 1);
    const off = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 150 * mark.scale;
    bases.push({ idx, x: spreadX(f, mark.x) + off, y: mark.y + n * 12, scale: mark.scale, flip: p.flip, pose: p.pose, expression: p.expression, height: spec ? characterHeight(spec) : 370 });
  });
  const states = evalActors(scene, bases, u, wordsOf(env.episode), setting, f);
  return bases
    .map((b, i) => ({ idx: b.idx, x: states[i].x, y: states[i].y, scale: states[i].scale, flip: states[i].flip, height: b.height * states[i].scale, st: states[i] }))
    .filter((p) => env.library.getCharacter(scene.characters[p.idx].character));
}

/** Điểm camera nhắm vào, tọa độ thế giới (bám theo nhân vật đang di chuyển) */
export function focusPoint(env: RenderEnv, scene: Scene, f: Frame = sceneFrame(env, scene), u = 0): { x: number; y: number } {
  const placed = placeCharacters(env, scene, f, u);
  const setting = env.library.getSetting(scene.background.setting);
  if (!placed.length) return dw(f, 540, Math.max(f.yTop + 400, setting.text_zone.y + 400));
  let target = placed[0];
  const fc = scene.camera.focus;
  const byId = placed.find((p) => scene.characters[p.idx].character === fc);
  const speaking = placed.find((p) => scene.characters[p.idx].speaking);
  if (fc !== "auto" && byId) target = byId;
  else if (speaking) target = speaking;
  return dw(f, target.x, target.y + target.st.dy - target.height * 0.62);
}

function talkAt(env: RenderEnv, scene: Scene, t: number): { amount: number; viseme: "a" | "o" | "e" | "m" } {
  const words = wordsOf(env.episode);
  for (let i = scene.word_start; i <= scene.word_end && i < words.length; i++) {
    const w = words[i];
    if (t < w.start) break;
    if (t <= w.end) {
      const frac = (t - w.start) / Math.max(0.05, w.end - w.start);
      const viseme = visemeAt(w.text, frac);
      if (env.envelope?.length) {
        const v = env.envelope[Math.min(env.envelope.length - 1, Math.floor(t * 100))] ?? 0;
        return { amount: clamp((v - 0.06) * 2.4), viseme };
      }
      const n = Math.max(1, countSyllables(w.text));
      return { amount: Math.abs(Math.sin(Math.PI * n * frac)) * 0.9, viseme };
    }
  }
  return { amount: 0, viseme: "a" };
}

/** Vẽ với độ trong suốt cho cả một nhóm (hiện/ẩn dần): vẽ ra canvas phụ rồi ghép */
function withAlpha(ctx: Ctx, env: RenderEnv, alpha: number, draw: (c: Ctx) => void) {
  if (alpha >= 0.999) return draw(ctx);
  if (alpha <= 0.001 || !env.createCanvas) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const off = alphaCanvas(env, w, h);
  const oc = off.getContext("2d") as Ctx;
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.clearRect(0, 0, w, h);
  oc.setTransform(ctx.getTransform());
  draw(oc);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(off as unknown as CanvasImageSource, 0, 0);
  ctx.restore();
}
const alphaCache = new WeakMap<object, CanvasLike>();
function alphaCanvas(env: RenderEnv, w: number, h: number) {
  let c = alphaCache.get(env.library);
  if (!c || c.width !== w || c.height !== h) {
    c = env.createCanvas!(w, h);
    alphaCache.set(env.library, c);
  }
  return c;
}

function drawSceneWorld(ctx: Ctx, env: RenderEnv, scene: Scene, u: number, t: number, opts: FrameOpts) {
  const lib = env.library;
  const setting = lib.getSetting(scene.background.setting);
  const f = sceneFrame(env, scene);
  const focus = focusPoint(env, scene, f, u);
  const cam = cameraAt(scene, u, focus, f);
  const placed = placeCharacters(env, scene, f, u).sort((a, b) => a.y - b.y);
  const props = evalProps(scene, u, wordsOf(env.episode), f);
  const lastLayer = setting.layers.length - 1;
  const talk = talkAt(env, scene, t);

  setting.layers.forEach((layer, li) => {
    ctx.save();
    applyCam(ctx, layerCam(cam, layer.depth, f), f);
    applyDesign(ctx, f);
    drawLayerBase(ctx, layer, f);
    for (const p of layer.procedural) drawProcedural(ctx, p, layer, hash(setting.id, li, scene.seed), t, lib.getModule, f);
    for (const it of layer.items) {
      const x = spreadX(f, it.x);
      if (it.module.startsWith("label:")) {
        drawLabel(ctx, it.module.slice(6), x, it.y, 44 * it.scale);
        continue;
      }
      const m = lib.getModule(it.module);
      if (!m) continue;
      ctx.save();
      ctx.translate(x, it.y);
      if (it.rot) ctx.rotate(it.rot);
      ctx.scale(it.flip ? -it.scale : it.scale, it.scale);
      drawModule(ctx, m);
      ctx.restore();
    }
    if (li === lastLayer) {
      for (const o of scene.overlays) if (o.style === "route") drawRoute(ctx, o.text, setting, f, t - overlayStart(env, scene, o));
      scene.props.forEach((pr, i) => {
        const m = lib.getModule(pr.module);
        const ps = props[i];
        if (!m || !ps) return;
        withAlpha(ctx, env, ps.alpha, (c) => {
          c.save();
          c.translate(ps.x, ps.y);
          c.rotate(ps.rot);
          c.scale(pr.flip ? -ps.scale : ps.scale, ps.scale);
          drawModule(c, m);
          c.restore();
        });
      });
      for (const p of placed) {
        const pl = scene.characters[p.idx];
        const spec = lib.getCharacter(pl.character)!;
        const st = p.st;
        withAlpha(ctx, env, st.alpha, (c) => {
          c.save();
          c.translate(p.x, p.y + st.dy);
          if (st.rot) c.rotate(st.rot);
          c.scale(p.flip ? -p.scale : p.scale, p.scale);
          // điểm chỉ tay → hệ tọa độ cục bộ của nhân vật
          const pointAt = st.pointAt ? { x: ((st.pointAt.x - p.x) / p.scale) * (p.flip ? -1 : 1), y: (st.pointAt.y - p.y - st.dy) / p.scale } : null;
          drawCharacter(c, spec, {
            pose: pl.pose,
            poseOverride: st.pose,
            expression: st.expression,
            t,
            u,
            talk: pl.speaking ? talk.amount : 0,
            viseme: talk.viseme,
            lean: st.lean * (p.flip ? -1 : 1),
            pointAt,
            seed: hash(scene.seed, pl.character, p.idx),
            getModule: lib.getModule,
          });
          c.restore();
        });
      }
    }
    ctx.restore();
  });

  // Không gian màn hình (thế giới)
  drawWeather(ctx, scene.background.weather, scene.seed, t, f.W, f.H);
  const lighting = scene.background.lighting === "auto" ? setting.base_lighting : scene.background.lighting;
  const screenFocus = { x: (focus.x - cam.cx) * cam.zoom + f.W / 2, y: (focus.y - cam.cy) * cam.zoom + f.H / 2 };
  drawLighting(ctx, lighting, screenFocus, t, f.W, f.H);

  if (opts.overlays !== false) {
    const zone = dw(f, spreadX(f, setting.text_zone.x), setting.text_zone.y);
    zone.y = Math.max(zone.y, f.H * 0.13);
    let stack = 0;
    for (const o of scene.overlays) {
      if (o.style === "route") continue;
      const at = overlayStart(env, scene, o);
      // nhiều chữ cùng vùng → xếp chồng xuống dưới để không đè nhau
      const slot = o.x == null && o.y == null ? stack++ : 0;
      const mapped = o.x != null && o.y != null ? { ...o, ...dw(f, spreadX(f, o.x), o.y) } : o;
      drawOverlay(ctx, mapped, t - at, slot ? { x: zone.x, y: zone.y + slot * Math.min(f.W, f.H) * 0.17 } : zone, scene.seed, f.W);
    }
  }
}

function overlayStart(env: RenderEnv, scene: Scene, o: Scene["overlays"][number]) {
  const words = wordsOf(env.episode);
  return o.at_word != null && words[o.at_word] ? words[o.at_word].start : scene.start + 0.1;
}

/**
 * Đường đi trên bản đồ: "Milano > Ravenna > Roma" nối các nhãn/điểm của bối cảnh.
 * Vẽ dần theo thời gian (nét đứt + mũi tên), trong hệ tọa độ thiết kế để bám theo camera.
 */
function drawRoute(ctx: Ctx, text: string, setting: ReturnType<RenderEnv["library"]["getSetting"]>, f: Frame, age: number) {
  if (age < 0) return;
  const items = setting.layers.flatMap((l) => l.items);
  const pts = text
    .split(/>|→|->|,/)
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .map((n) => {
      const label = items.find((i) => i.module.startsWith("label:") && i.module.slice(6).toLowerCase() === n);
      if (!label) return null;
      // điểm thành phố gần nhãn nhất (nếu có)
      const marker = items.filter((i) => i.module === "city_marker").sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y))[0];
      const p = marker && Math.hypot(marker.x - label.x, marker.y - label.y) < 160 ? marker : label;
      return { x: spreadX(f, p.x), y: p.y };
    })
    .filter((p): p is { x: number; y: number } => !!p);
  if (pts.length < 2) return;
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let left = total * ease.inOutSine(clamp(age / 1.6));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([26, 18]);
  ctx.lineDashOffset = -age * 60;
  let end = pts[0];
  let dir = 0;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < segs.length && left > 0; i++) {
    const k = Math.min(1, left / segs[i]);
    end = { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) };
    dir = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    ctx.lineTo(end.x, end.y);
    left -= segs[i];
  }
  ctx.strokeStyle = "#2b2233";
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.strokeStyle = "#e84a5f";
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(end.x, end.y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(-16, -20);
  ctx.lineTo(-16, 20);
  ctx.closePath();
  ctx.fillStyle = "#e84a5f";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#2b2233";
  ctx.stroke();
  ctx.restore();
}

function drawEmpty(ctx: Ctx, title: string, f: Frame) {
  const g = ctx.createLinearGradient(0, 0, 0, f.H);
  g.addColorStop(0, "#2a2140");
  g.addColorStop(1, "#14101f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.W, f.H);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `bold 72px ${FONT_DISPLAY}`;
  ctx.fillText(title || "fxcine", f.W / 2, f.H / 2);
  ctx.font = `36px ${FONT_DISPLAY}`;
  ctx.fillStyle = "#a99cc8";
  ctx.fillText("Chưa có cảnh — hãy nhập kịch bản", f.W / 2, f.H / 2 + 80);
}

function drawSafeArea(ctx: Ctx, f: Frame) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 3;
  // Dọc: tránh nút tương tác của Shorts/TikTok; ngang/vuông: vùng an toàn chữ 5%
  if (f.H > f.W) ctx.strokeRect(60, 150, f.W - 200, f.H - 150 - 330);
  else ctx.strokeRect(f.W * 0.05, f.H * 0.05, f.W * 0.9, f.H * 0.9);
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
