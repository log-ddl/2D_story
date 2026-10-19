import { z } from "zod";

// ───────── Thời gian / alignment ─────────

export const Word = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  conf: z.number().default(1),
});
export type Word = z.infer<typeof Word>;

export const Alignment = z.object({
  method: z.enum(["estimate", "heuristic", "whisper", "tts"]),
  duration: z.number(),
  words: z.array(Word),
  /** Khoảng lặng phát hiện trong audio [start, end] */
  silences: z.array(z.tuple([z.number(), z.number()])).default([]),
  /** Cảnh báo khi lời thực đọc lệch kịch bản */
  mismatches: z.array(z.object({ index: z.number(), expected: z.string(), heard: z.string() })).default([]),
});
export type Alignment = z.infer<typeof Alignment>;

// ───────── Cảnh ─────────

export const BEATS = ["question", "number", "escalate", "climax", "aftermath", "twist", "cta", "context"] as const;
export const Beat = z.enum(BEATS);
export type Beat = z.infer<typeof Beat>;

export const SHOTS = ["wide", "medium", "close"] as const;
export const MOVES = ["static", "push_in", "pull_out", "pan_left", "pan_right", "tilt_up", "shake"] as const;
export const WEATHERS = ["clear", "sparkles", "rain", "snow", "dust", "embers", "coins", "confetti", "leaves"] as const;
export const LIGHTINGS = ["auto", "day", "dusk", "night", "spotlight", "dramatic"] as const;
export const OVERLAY_STYLES = ["banner", "title", "stamp", "label", "counter"] as const;
export const TRANSITIONS = ["cut", "fade", "whip"] as const;

export const CharacterPlacement = z.object({
  character: z.string(),
  mark: z.string().default("A"),
  pose: z.string().default("stand"),
  expression: z.string().default("neutral"),
  speaking: z.boolean().default(false),
  flip: z.boolean().default(false),
});
export type CharacterPlacement = z.infer<typeof CharacterPlacement>;

export const PropPlacement = z.object({
  module: z.string(),
  x: z.number(),
  y: z.number(),
  scale: z.number().default(1),
  rot: z.number().default(0),
  flip: z.boolean().default(false),
});
export type PropPlacement = z.infer<typeof PropPlacement>;

export const Overlay = z.object({
  text: z.string(),
  style: z.enum(OVERLAY_STYLES).default("title"),
  /** Index từ (trong toàn tập) mà overlay bật lên; null = đầu cảnh */
  at_word: z.number().nullable().default(null),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type Overlay = z.infer<typeof Overlay>;

export const Scene = z.object({
  id: z.string(),
  beat: Beat.default("context"),
  word_start: z.number(),
  word_end: z.number(),
  start: z.number().default(0),
  end: z.number().default(0),
  duration: z.number().default(0),
  narration: z.string(),
  narration_vi: z.string().default(""),
  description: z.string().default(""),
  background: z.object({
    setting: z.string(),
    weather: z.enum(WEATHERS).default("clear"),
    lighting: z.enum(LIGHTINGS).default("auto"),
  }),
  camera: z.object({
    shot: z.enum(SHOTS).default("wide"),
    move: z.enum(MOVES).default("push_in"),
    focus: z.string().default("auto"),
  }).prefault({}),
  characters: z.array(CharacterPlacement).default([]),
  props: z.array(PropPlacement).default([]),
  overlays: z.array(Overlay).default([]),
  transition: z.enum(TRANSITIONS).default("cut"),
  seed: z.number().default(1),
  status: z.enum(["draft", "ready", "warning"]).default("draft"),
  qa_issues: z.array(z.object({ level: z.enum(["info", "warn", "error"]), message: z.string() })).default([]),
});
export type Scene = z.infer<typeof Scene>;

// ───────── Nhân vật (spec tham số) ─────────

export const CharacterSpec = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  age: z.enum(["kid", "adult", "old"]).default("adult"),
  build: z.enum(["slim", "normal", "stocky"]).default("normal"),
  skin: z.string().default("#f6c9a0"),
  hair: z.object({ style: z.string().default("short"), color: z.string().default("#5a3b26") }).prefault({}),
  beard: z.object({ style: z.string().default("none"), color: z.string().default("#5a3b26") }).prefault({}),
  eyes: z.string().default("#2a1f2e"),
  outfit: z.object({
    type: z.enum(["toga", "tunic", "armor", "robe", "royal"]).default("tunic"),
    color: z.string().default("#c8553d"),
    trim: z.string().default("#f2c14e"),
  }).prefault({}),
  headwear: z.string().default("none"),
  cape: z.string().nullable().default(null),
  hand_prop: z.string().nullable().default(null),
  /** Nhân vật phụ: sinh biến thể theo seed */
  generator: z.boolean().default(false),
});
export type CharacterSpec = z.infer<typeof CharacterSpec>;

// ───────── Bối cảnh (composition các module) ─────────

export const SettingItem = z.object({
  module: z.string(),
  x: z.number(),
  y: z.number(),
  scale: z.number().default(1),
  flip: z.boolean().default(false),
  rot: z.number().default(0),
});

export const SettingLayer = z.object({
  depth: z.number().default(1),
  fill: z.string().optional(),
  sky: z.tuple([z.string(), z.string()]).optional(),
  ground: z.object({ y: z.number(), color: z.string(), edge: z.string().optional() }).optional(),
  procedural: z
    .array(z.object({ type: z.string(), count: z.number().default(20), color: z.string().optional(), area: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional() }))
    .default([]),
  items: z.array(SettingItem).default([]),
});

export const Mark = z.object({ x: z.number(), y: z.number(), scale: z.number().default(1) });

export const SettingSpec = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()).default([]),
  base_lighting: z.enum(LIGHTINGS).default("day"),
  layers: z.array(SettingLayer),
  marks: z.record(z.string(), Mark),
  /** Vùng trống để đặt chữ (banner/title) */
  text_zone: z.object({ x: z.number(), y: z.number() }).default({ x: 540, y: 420 }),
});
export type SettingSpec = z.infer<typeof SettingSpec>;
export type SettingInput = z.input<typeof SettingSpec>;

// ───────── Tập & dự án ─────────

export const Episode = z.object({
  id: z.string(),
  title: z.string(),
  script_text: z.string(),
  fps: z.number().default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  style: z.string().default("chibi"),
  audio: z
    .object({ file: z.string(), source: z.enum(["upload", "tts", "say"]), duration: z.number() })
    .nullable()
    .default(null),
  music: z.object({ file: z.string(), volume: z.number().default(0.25) }).nullable().default(null),
  alignment: Alignment.nullable().default(null),
  cast: z.array(z.string()).default([]),
  scenes: z.array(Scene).default([]),
  subtitles: z.boolean().default(true),
  updated_at: z.number().default(0),
});
export type Episode = z.infer<typeof Episode>;

export const Project = z.object({
  id: z.string(),
  name: z.string(),
  episodes: z.array(z.object({ id: z.string(), title: z.string() })).default([]),
  characters: z.array(CharacterSpec).default([]),
  /** Module SVG riêng của dự án (do AI sinh / người thêm) */
  modules: z
    .array(z.object({ id: z.string(), svg: z.string(), tags: z.array(z.string()).default([]), status: z.enum(["draft", "approved"]).default("draft"), anchor: z.tuple([z.number(), z.number()]).optional() }))
    .default([]),
  settings: z.array(SettingSpec).default([]),
});
export type Project = z.infer<typeof Project>;
