// Hành động → keyframe: trạng thái của từng diễn viên/đạo cụ là hàm thuần của thời gian trong cảnh.
// Mỗi hành động có thời điểm bắt đầu (gắn vào một từ của lời dẫn) và thời lượng; các hành động
// cộng dồn theo thứ tự thời gian, nên "đi tới A rồi ngã" cho ra đúng chuỗi chuyển động.

import type { Action, Scene, SettingSpec, Word } from "../schema";
import { blendPose, POSES, type Pose } from "./character";
import { DESIGN_W, spreadX, type Frame } from "./frame";
import { clamp, DEG, ease, lerp } from "./math";

export interface ActorState {
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  rot: number;
  alpha: number;
  dy: number;
  pose: Pose;
  expression: string;
  walking: boolean;
  /** nghiêng người khi di chuyển (áo choàng bay ngược) -1..1 */
  lean: number;
  /** điểm cần chỉ tay (tọa độ thiết kế) */
  pointAt: { x: number; y: number } | null;
}

export interface PropState {
  x: number;
  y: number;
  scale: number;
  rot: number;
  alpha: number;
}

export type TargetRef = { kind: "char"; idx: number } | { kind: "prop"; idx: number } | null;

/** "romulus", "romulus#2", "prop:coin_pile", "prop:coin_pile#2" → chỉ số trong cảnh */
export function resolveTarget(scene: Scene, target: string): TargetRef {
  const [name, nth] = target.split("#");
  const n = Math.max(1, parseInt(nth ?? "1", 10) || 1);
  if (name.startsWith("prop:")) {
    const mod = name.slice(5);
    let k = 0;
    const idx = scene.props.findIndex((p) => p.module === mod && ++k === n);
    return idx >= 0 ? { kind: "prop", idx } : null;
  }
  let k = 0;
  const idx = scene.characters.findIndex((c) => c.character === name && ++k === n);
  return idx >= 0 ? { kind: "char", idx } : null;
}

/** Thời điểm bắt đầu hành động, tính trong cảnh (giây) */
export function actionStart(a: Action, scene: Scene, words: Word[]): number {
  const base = a.at_word != null && words[a.at_word] ? words[a.at_word].start - scene.start : 0;
  return Math.max(0, base + a.delay);
}

/** x ngoài mép khung (tọa độ thiết kế đã giãn) */
const offscreenX = (f: Frame, side: string | null) => DESIGN_W / 2 + (side === "left" ? -1 : 1) * (f.W / (2 * f.k) + 260);

const bounce = (t: number) => {
  // easeOutBounce
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

export interface ActorBase {
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  pose: string;
  expression: string;
}

/** Vị trí đứng của một mark (thiết kế, đã giãn) */
export function markPos(setting: SettingSpec, mark: string, f: Frame) {
  const m = setting.marks[mark] ?? setting.marks.A ?? { x: 540, y: 1500, scale: 1.3 };
  return { x: spreadX(f, m.x), y: m.y, scale: m.scale };
}

export function evalActors(scene: Scene, bases: ActorBase[], u: number, words: Word[], setting: SettingSpec, f: Frame): ActorState[] {
  const acts = scene.actions
    .map((a) => ({ a, ref: resolveTarget(scene, a.target), start: actionStart(a, scene, words) }))
    .filter((x) => x.ref?.kind === "char")
    .sort((p, q) => p.start - q.start);

  return bases.map((b, idx) => {
    const mine = acts.filter((x) => x.ref!.idx === idx);
    const st: ActorState = { x: b.x, y: b.y, scale: b.scale, flip: b.flip, rot: 0, alpha: 1, dy: 0, pose: POSES[b.pose]?.pose ?? POSES.stand.pose, expression: b.expression, walking: false, lean: 0, pointAt: null };
    // Trạng thái trước hành động đầu tiên: vào khung → bắt đầu ở ngoài; hiện dần → ẩn
    const firstPos = mine.find((m) => ["enter", "move", "approach", "exit"].includes(m.a.verb));
    if (firstPos?.a.verb === "enter") st.x = offscreenX(f, firstPos.a.value);
    if (mine[0]?.a.verb === "fade_in") st.alpha = 0;

    for (const { a, start } of mine) {
      if (u < start) break;
      const d = Math.max(0.05, a.duration);
      const p = clamp((u - start) / d);
      const e = ease.inOutCubic(p);
      switch (a.verb) {
        case "move":
        case "approach":
        case "enter":
        case "exit": {
          let tx = st.x;
          let ty = st.y;
          let ts = st.scale;
          if (a.verb === "move" && a.to) {
            const m = markPos(setting, a.to, f);
            [tx, ty, ts] = [m.x, m.y, m.scale];
          } else if (a.verb === "approach" && a.to) {
            const r = resolveTarget(scene, a.to);
            if (r?.kind === "char" && bases[r.idx]) {
              const o = bases[r.idx];
              const side = o.x >= st.x ? -1 : 1;
              [tx, ty, ts] = [o.x + side * 240 * o.scale, o.y + 6, o.scale];
            }
          } else if (a.verb === "enter") {
            [tx, ty] = [b.x, b.y];
          } else if (a.verb === "exit") {
            tx = offscreenX(f, a.value);
          }
          const fromX = st.x;
          st.x = lerp(fromX, tx, e);
          st.y = lerp(st.y, ty, e);
          st.scale = lerp(st.scale, ts, e);
          if (Math.abs(tx - fromX) > 4) st.flip = tx < fromX;
          if (p < 1) {
            st.walking = true;
            st.lean = (tx < fromX ? 1 : -1) * Math.sin(Math.PI * p) * 0.8;
          }
          break;
        }
        case "turn":
          st.flip = !st.flip;
          break;
        case "look": {
          const r = a.to ? resolveTarget(scene, a.to) : null;
          if (r?.kind === "char" && bases[r.idx]) st.flip = bases[r.idx].x < st.x;
          break;
        }
        case "jump":
          if (p < 1) st.dy -= Math.sin(Math.PI * p) * 110;
          break;
        case "hop":
          if (p < 1) st.dy -= Math.abs(Math.sin((u - start) * 9)) * 30;
          break;
        case "shake":
          if (p < 1) st.x += Math.sin((u - start) * 70) * 7 * (1 - p);
          break;
        case "fall":
          st.rot = (st.flip ? 1 : -1) * 82 * DEG * ease.outQuad(p);
          st.dy -= 45 * e;
          break;
        case "rise":
          st.rot = lerp(st.rot, 0, e);
          st.dy = lerp(st.dy, 0, e);
          break;
        case "spin":
          if (p < 1) st.rot += Math.PI * 2 * e;
          break;
        case "pose": {
          const to = POSES[a.value ?? ""]?.pose;
          if (to) st.pose = blendPose(st.pose, to, clamp((u - start) / Math.min(d, 0.35)));
          break;
        }
        case "emote":
          if (a.value) st.expression = a.value;
          break;
        case "point_at": {
          const r = a.to ? resolveTarget(scene, a.to) : null;
          if (r?.kind === "char" && bases[r.idx]) st.pointAt = { x: bases[r.idx].x, y: bases[r.idx].y - 260 * bases[r.idx].scale };
          else if (r?.kind === "prop" && scene.props[r.idx]) st.pointAt = { x: spreadX(f, scene.props[r.idx].x), y: scene.props[r.idx].y - 80 };
          else if (a.to && setting.marks[a.to]) {
            const m = markPos(setting, a.to, f);
            st.pointAt = { x: m.x, y: m.y - 200 };
          }
          if (st.pointAt && p < 1) st.pointAt = { ...st.pointAt, y: st.pointAt.y + (1 - ease.outCubic(clamp((u - start) / 0.3))) * 400 };
          break;
        }
        case "grow":
          st.scale *= lerp(1, Number(a.value) || 1.35, ease.outBack(p));
          break;
        case "shrink":
          st.scale *= lerp(1, Number(a.value) || 0.65, e);
          break;
        case "fade_in":
          st.alpha = e;
          break;
        case "fade_out":
          st.alpha = Math.min(st.alpha, 1 - e);
          break;
        case "drop": {
          const h = 900;
          st.dy += (1 - bounce(p)) * -h;
          st.alpha = 1;
          break;
        }
        case "sink":
          st.dy += 220 * ease.inCubic(p);
          st.rot += (st.flip ? -1 : 1) * 0.35 * e;
          st.alpha = Math.min(st.alpha, 1 - ease.inCubic(clamp((p - 0.2) / 0.8)));
          break;
      }
    }
    if (st.walking) st.pose = { ...POSES.walk.pose, head: st.pose.head };
    return st;
  });
}

export function evalProps(scene: Scene, u: number, words: Word[], f: Frame, setting?: SettingSpec): PropState[] {
  const acts = scene.actions
    .map((a) => ({ a, ref: resolveTarget(scene, a.target), start: actionStart(a, scene, words) }))
    .filter((x) => x.ref?.kind === "prop")
    .sort((p, q) => p.start - q.start);
  return scene.props.map((pr, idx) => {
    const mine = acts.filter((x) => x.ref!.idx === idx);
    const st: PropState = { x: spreadX(f, pr.x), y: pr.y, scale: pr.scale, rot: pr.rot, alpha: 1 };
    if (mine[0] && ["drop", "fade_in", "grow", "enter", "rise"].includes(mine[0].a.verb)) st.alpha = 0;
    for (const { a, start } of mine) {
      if (u < start) break;
      const p = clamp((u - start) / Math.max(0.05, a.duration));
      const e = ease.inOutCubic(p);
      switch (a.verb) {
        case "enter": {
          const side = a.value === "left" || a.value === "right" ? a.value : pr.x < 540 ? "left" : "right";
          const off = offscreenX(f, side);
          st.alpha = clamp(p * 3);
          st.x = lerp(off, st.x, ease.outCubic(p));
          if (p < 1) st.y += Math.sin(p * Math.PI * 3) * 10;
          break;
        }
        case "exit": {
          const side =
            a.value === "left" || a.value === "right"
              ? a.value
              : a.to === "left" || a.to === "right"
                ? a.to
                : pr.x < 540
                  ? "left"
                  : "right";
          const off = offscreenX(f, side);
          st.x = lerp(st.x, off, ease.inCubic(p));
          st.alpha = Math.min(st.alpha, 1 - clamp((p - 0.65) / 0.35));
          break;
        }
        case "drop":
          st.alpha = 1;
          st.y -= (1 - bounce(p)) * 1000;
          st.rot += (1 - p) * 0.4;
          break;
        case "rise":
          st.alpha = Math.max(st.alpha, clamp(p * 2.5));
          st.y += (1 - ease.outBack(p)) * 180;
          break;
        case "fall":
          st.rot += (pr.flip ? -1 : 1) * 0.45 * bounce(p);
          st.y += 45 * e;
          break;
        case "sink":
          st.rot += (pr.flip ? -1 : 1) * 0.55 * e;
          st.y += 220 * ease.inCubic(p);
          st.alpha = Math.min(st.alpha, 1 - ease.inCubic(clamp((p - 0.25) / 0.75)));
          break;
        case "fade_in":
          st.alpha = e;
          break;
        case "fade_out":
          st.alpha = Math.min(st.alpha, 1 - e);
          break;
        case "grow":
          st.alpha = Math.max(st.alpha, clamp(p * 4));
          st.scale *= lerp(0.2, Number(a.value) || 1, ease.outBack(p));
          break;
        case "shrink":
          st.scale *= lerp(1, 0, e);
          break;
        case "spin":
          st.rot += Math.PI * 2 * e;
          break;
        case "shake":
          if (p < 1) st.x += Math.sin((u - start) * 70) * 8 * (1 - p);
          break;
        case "jump":
        case "hop":
          if (p < 1) st.y -= Math.abs(Math.sin(Math.PI * p * (a.verb === "hop" ? 4 : 1))) * 80;
          break;
        case "move": {
          if (a.to && setting?.marks[a.to]) {
            const m = markPos(setting, a.to, f);
            st.x = lerp(st.x, m.x, e);
            st.y = lerp(st.y, m.y, e);
          } else {
            // đạo cụ: to = "x,y" (thiết kế)
            const [tx, ty] = (a.to ?? "").split(",").map(Number);
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
              st.x = lerp(st.x, spreadX(f, tx), e);
              st.y = lerp(st.y, ty, e);
            }
          }
          break;
        }
      }
    }
    return st;
  });
}

/** Âm vị gần đúng tại thời điểm trong một từ — để miệng đổi hình khi nói */
export function visemeAt(word: string, frac: number): "a" | "o" | "e" | "m" {
  const letters = word.toLowerCase().replace(/[^a-zà-ỹ]/g, "");
  if (!letters) return "a";
  const c = letters[Math.min(letters.length - 1, Math.floor(clamp(frac) * letters.length))];
  if ("mbp".includes(c)) return "m";
  if ("ouwôơưóòọ".includes(c)) return "o";
  if ("eiyêé".includes(c)) return "e";
  return "a";
}
