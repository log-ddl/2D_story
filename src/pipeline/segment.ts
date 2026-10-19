// Chia cảnh theo nghĩa + căn thời gian theo giọng đọc.
// Có 2 đường: luật (offline, không cần API) và LLM (Claude) — cả hai ra cùng Scene JSON.

import { z } from "zod";
import type { Alignment, Beat, CharacterSpec, Episode, Scene, SettingSpec, Word } from "../schema";
import { Scene as SceneSchema, BEATS, SHOTS, MOVES, WEATHERS, LIGHTINGS, OVERLAY_STYLES, TRANSITIONS, VERBS, type Action, type Verb } from "../schema";
import { BUILTIN_MODULES } from "../library/modules";

/** Module dùng làm đạo cụ trong cảnh */
const PROP_MODULES = BUILTIN_MODULES.filter((m) => m.kind === "prop" || m.kind === "hand").map((m) => m.id);
import { hash } from "../engine/math";
import { tokenize } from "./text";

export const MIN_SCENE = 1.2;
export const MAX_SCENE = 4.2;

interface Unit {
  from: number;
  to: number;
}

const isStrong = (w: Word) => /[.!?…]["'”’)]*$/.test(w.text);
const isSoft = (w: Word) => /[,;:—–-]["'”’)]*$/.test(w.text);
const spanDur = (words: Word[], u: Unit) => words[u.to].end - words[u.from].start;

/** Bước 1: tách theo câu, tách câu dài ở dấu phẩy/liên từ, gộp đoạn quá ngắn */
export function splitUnits(words: Word[]): Unit[] {
  if (!words.length) return [];
  let units: Unit[] = [];
  let s = 0;
  words.forEach((w, i) => {
    if (isStrong(w) || i === words.length - 1) {
      units.push({ from: s, to: i });
      s = i + 1;
    }
  });
  // tách đoạn dài
  const split = (u: Unit): Unit[] => {
    if (spanDur(words, u) <= MAX_SCENE + 0.6 || u.to - u.from < 3) return [u];
    const mid = (words[u.from].start + words[u.to].end) / 2;
    let best = -1;
    let bestScore = Infinity;
    for (let i = u.from + 1; i < u.to - 1; i++) {
      const w = words[i];
      const next = words[i + 1];
      const gap = next.start - w.end;
      const conj = /^(and|but|so|then|because|which|who|while|after|before|until|và|nhưng|rồi)$/i.test(next.text.replace(/[^\p{L}]/gu, ""));
      // không tách giữa số và đơn vị/kỷ nguyên ("753 BC", "6,000 gold")
      const glued = /\d/.test(w.text) && /^(bc|ad|bce|ce|gold|coins|years?|days?|men|soldiers)\b/i.test(next.text);
      const score = Math.abs(w.end - mid) - (isSoft(w) ? 1.2 : 0) - (conj ? 0.6 : 0) - gap * 2 + (glued ? 5 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) return [u];
    return [...split({ from: u.from, to: best }), ...split({ from: best + 1, to: u.to })];
  };
  units = units.flatMap(split);
  // gộp đoạn ngắn
  let changed = true;
  while (changed && units.length > 1) {
    changed = false;
    for (let i = 0; i < units.length; i++) {
      if (spanDur(words, units[i]) >= MIN_SCENE) continue;
      const left = units[i - 1];
      const right = units[i + 1];
      const pickRight = right && (!left || spanDur(words, right) < spanDur(words, left));
      if (pickRight) units.splice(i, 2, { from: units[i].from, to: right.to });
      else if (left) units.splice(i - 1, 2, { from: left.from, to: units[i].to });
      changed = true;
      break;
    }
  }
  return units;
}

/**
 * Bước 2: thời gian cảnh. Điểm cắt nằm giữa khoảng lặng (hoặc sớm hơn tiếng nói ~0.08s),
 * làm tròn theo frame trên timestamp tuyệt đối để không trôi.
 */
export function computeTimes(scenes: Pick<Scene, "word_start" | "word_end">[], words: Word[], duration: number, fps: number) {
  const snap = (t: number) => Math.round(t * fps) / fps;
  const cuts: number[] = [0];
  for (let k = 1; k < scenes.length; k++) {
    const prevEnd = words[scenes[k - 1].word_end]?.end ?? 0;
    const nextStart = words[scenes[k].word_start]?.start ?? prevEnd;
    const gap = nextStart - prevEnd;
    const cut = gap > 0.2 ? prevEnd + gap / 2 : nextStart - Math.min(0.08, Math.max(0, gap));
    cuts.push(Math.max(cuts[k - 1] + 1 / fps, snap(cut)));
  }
  const end = snap(Math.max(duration, words[words.length - 1]?.end ?? 0));
  return scenes.map((_, k) => {
    const start = cuts[k];
    const e = k + 1 < cuts.length ? cuts[k + 1] : end;
    return { start, end: e, duration: Math.round((e - start) * 1000) / 1000 };
  });
}

// ───────── Đường luật (offline) ─────────

const KW: Record<string, RegExp> = {
  question: /\?|\b(why|how|what|who|ever wonder|did you know|tại sao|vì sao)\b/i,
  number: /\d|\b(thousand|million|hundred|gold|coins|years?|days?)\b/i,
  twist: /\b(but|however|actually|real|truth|secret|turns out|nhưng|thật ra)\b/i,
  climax: /\b(executed|killed|dies|died|attack|caught|war|battle|marches|army|crown|king|overthrow)\b/i,
  aftermath: /\b(instead|after|later|then|finally|retire|pension|villa|ended|end)\b/i,
  cta: /\b(follow|subscribe|comment|like|share|theo dõi|đăng ký)\b/i,
};

const SENTIMENT: [RegExp, string, string][] = [
  [/\b(executed|dies|died|killed|caught|fear|afraid|scared)\b/i, "scared", "cower"],
  [/\b(absolutely not|no!|angry|furious|refuse|demand)\b/i, "angry", "fight"],
  [/\b(pension|villa|gold|retire|happy|lucky|free)\b/i, "happy", "cheer"],
  [/\b(kid|boy|child|little|just a)\b/i, "worried", "stand"],
  [/\?|\b(where|wonder|really|what)\b/i, "confused", "think"],
  [/\b(boss|power|king|leader|named|real)\b/i, "smug", "hands_hips"],
  [/\b(march|army|soldiers|land|want)\b/i, "determined", "point"],
];

function pickSetting(text: string, settings: SettingSpec[], prev: string | null): string {
  const low = text.toLowerCase();
  let best = prev ?? settings[0]?.id ?? "title_card";
  let bestScore = prev ? 0.9 : 0;
  for (const s of settings) {
    let score = 0;
    for (const tag of s.tags) if (new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(low)) score += tag.length > 4 ? 1.2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = s.id;
    }
  }
  return best;
}

function mentioned(text: string, chars: CharacterSpec[]): CharacterSpec[] {
  const low = text.toLowerCase();
  return chars.filter((c) => [c.name, ...c.aliases].some((a) => new RegExp(`\\b${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(low)));
}

export function ruleSegment(ep: Pick<Episode, "cast" | "fps">, alignment: Alignment, lib: { settings: Map<string, SettingSpec>; characters: Map<string, CharacterSpec> }): Scene[] {
  const words = alignment.words;
  const units = splitUnits(words);
  const times = computeTimes(units.map((u) => ({ word_start: u.from, word_end: u.to })), words, alignment.duration, ep.fps);
  const settings = [...lib.settings.values()].filter((s) => s.id !== "title_card");
  const cast = (ep.cast.length ? ep.cast.map((id) => lib.characters.get(id)).filter(Boolean) : [...lib.characters.values()]) as CharacterSpec[];
  const out: Scene[] = [];
  let prevSetting: string | null = null;
  let lead: CharacterSpec | null = cast.find((c) => !c.generator) ?? null;
  let shotIdx = 0;
  units.forEach((u, k) => {
    const text = words.slice(u.from, u.to + 1).map((w) => w.text).join(" ");
    const pos = k / Math.max(1, units.length - 1);
    // Nhịp kể
    let beat: Beat = "context";
    if (k === units.length - 1 && KW.cta.test(text)) beat = "cta";
    else if (KW.question.test(text) && /\?/.test(text)) beat = "question";
    else if (KW.number.test(text) && /\d/.test(text)) beat = "number";
    else if (KW.twist.test(text)) beat = "twist";
    else if (KW.climax.test(text)) beat = pos > 0.45 ? "climax" : "escalate";
    else if (KW.aftermath.test(text) && pos > 0.5) beat = "aftermath";
    else beat = pos < 0.15 ? "question" : pos < 0.5 ? "escalate" : pos < 0.8 ? "climax" : "aftermath";

    const setting = k === units.length - 1 && beat === "cta" ? "title_card" : pickSetting(text, settings, prevSetting);
    const newSetting = setting !== prevSetting;
    prevSetting = setting;

    // Nhân vật
    const ment = mentioned(text, cast);
    const named = ment.filter((c) => !c.generator);
    if (named.length) lead = named[0];
    const crowd = ment.filter((c) => c.generator);
    let [expression, pose] = ["neutral", "stand"];
    for (const [re, e, p] of SENTIMENT)
      if (re.test(text)) {
        expression = e;
        pose = p;
        break;
      }
    const chars: Scene["characters"] = [];
    const isMap = setting.startsWith("map");
    if (!isMap) {
      const main = lead;
      if (main) {
        const onThrone = setting === "throne_room" && main.id === cast.find((c) => !c.generator)?.id;
        chars.push({ character: main.id, mark: onThrone ? "A" : named.length > 1 || crowd.length ? "D" : "A", pose: onThrone ? "sit" : pose, expression, speaking: /["“]|\b(I|me|my|we)\b/.test(text), flip: false });
      }
      for (const other of named.slice(1, 3)) chars.push({ character: other.id, mark: chars.length === 1 ? "C" : "B", pose: "hands_hips", expression: "smug", speaking: false, flip: true });
      if (crowd.length) {
        chars.push({ character: crowd[0].id, mark: "B", pose: "cheer", expression: "determined", speaking: false, flip: false });
        chars.push({ character: crowd[0].id, mark: "C", pose: "raise_both", expression: "angry", speaking: false, flip: true });
      }
    }

    // Camera: cảnh mới → toàn; tiếp tục cùng bối cảnh → trung/cận luân phiên
    shotIdx = newSetting ? 0 : shotIdx + 1;
    const shot = isMap || !chars.length ? "wide" : (["wide", "medium", "close", "medium"] as const)[shotIdx % 4];
    const move = isMap ? (k % 2 ? "pan_left" : "pan_right") : beat === "climax" ? "shake" : beat === "aftermath" ? "pull_out" : beat === "cta" ? "static" : "push_in";

    // Chữ trên màn hình
    const overlays: Scene["overlays"] = [];
    for (let i = u.from; i <= u.to; i++) {
      const raw = words[i].text.replace(/[^\d,]/g, "");
      if (/^\d[\d,]*$/.test(raw) && raw.replace(/,/g, "").length >= 3) {
        const v = parseInt(raw.replace(/,/g, ""), 10);
        const isYear = v < 2100 && !raw.includes(",");
        const era = words[i + 1]?.text.replace(/[^A-Za-z]/g, "").toUpperCase();
        // cụm danh từ đi kèm cho bộ đếm ("6,000 gold coins a year" → "6,000 GOLD COINS")
        const tail: string[] = [];
        for (let k = i + 1; k <= Math.min(u.to, i + 3); k++) {
          const t = words[k].text.replace(/[.,!?;:]+$/, "");
          if (/^(a|an|the|of|per|to|for|and|in|on|by)$/i.test(t)) break;
          tail.push(t);
          if (/[.,!?;:]$/.test(words[k].text)) break;
        }
        // năm có kỷ nguyên đi kèm ("753 BC to 476 AD") → gộp cả khoảng
        const range = /^(to|until|–|-)$/i.test(words[i + 2]?.text ?? "") ? words.slice(i, i + 5).map((w) => w.text.replace(/[.,!?]$/, "")).join(" ") : null;
        if (isYear && range) overlays.push({ text: range.replace(/\s+(to|until|–|-)\s+/i, "|"), style: "timeline", at_word: i });
        else if (isYear) overlays.push({ text: `${raw} ${era === "BC" || era === "AD" ? era : "AD"}`, style: "banner", at_word: i });
        else overlays.push({ text: `${raw} ${tail.join(" ")}`.trim().toUpperCase(), style: "counter", at_word: i });
        break;
      }
    }
    if (!overlays.length) {
      // câu cảm thán/câu hỏi ngắn trong cảnh → chữ lớn ("Land? Absolutely not!")
      let s0 = u.from;
      for (let i = u.from; i <= u.to; i++) {
        if (isStrong(words[i])) {
          const n = i - s0 + 1;
          if (n <= 3 && /[!?]/.test(words[i].text)) {
            overlays.push({ text: words.slice(s0, i + 1).map((w) => w.text).join(" ").toUpperCase(), style: "title", at_word: s0 });
            break;
          }
          s0 = i + 1;
        }
      }
    }
    if (/\b(retired|retire)\b/i.test(text)) overlays.push({ text: "RETIRED!", style: "stamp", at_word: u.to });
    if (beat === "cta" && !overlays.length) overlays.push({ text: "FOLLOW FOR MORE!", style: "title", at_word: u.from });

    // ── Hành động theo từ khóa (luật offline) ──
    const actions: Scene["actions"] = [];
    const props: Scene["props"] = [];
    const wordIdx = (re: RegExp) => {
      for (let i = u.from; i <= u.to; i++) if (re.test(words[i].text)) return i;
      return -1;
    };
    const lead0 = chars[0];
    const named0 = ment.filter((c) => !c.generator).map((c) => c.id);
    const victim = (named0.length ? chars.find((c) => c.character === named0[named0.length - 1]) : null) ?? lead0;
    const iMove = wordIdx(/^(march|marches|marched|walks?|goes|went|comes?|came|arrives?|enters?|tiến|đi)/i);
    if (iMove >= 0 && lead0 && !isMap && lead0.mark !== "A") actions.push({ target: lead0.character, verb: "enter", value: chars.length > 1 ? "right" : "left", at_word: iMove, delay: 0, duration: 1.3, to: null });
    const iFall = wordIdx(/^(executed|dies|died|killed|falls?|fell|caught|chết|ngã|bị)/i);
    if (iFall >= 0 && victim && !isMap) actions.push({ target: victim.character, verb: "fall", at_word: iFall, delay: 0.2, duration: 0.6, to: null, value: null });
    const iJoy = wordIdx(/^(celebrat|cheer|happy|wins?|won|vui|thắng)/i);
    if (iJoy >= 0 && lead0) actions.push({ target: lead0.character, verb: "hop", at_word: iJoy, delay: 0, duration: 1.2, to: null, value: null });
    const iScared = wordIdx(/^(scared|afraid|shock|panic|sợ|hoảng)/i);
    if (iScared >= 0 && lead0) actions.push({ target: lead0.character, verb: "shake", at_word: iScared, delay: 0, duration: 0.8, to: null, value: null });
    const iYou = wordIdx(/^(you\??|you're|this|that|mày|nhóc)/i);
    if (iYou >= 0 && chars.length >= 2) actions.push({ target: chars[1].character, verb: "point_at", to: chars[0].character, at_word: iYou, delay: 0, duration: 1.2, value: null });
    const iGold = wordIdx(/^(gold|coins?|money|pension|treasure|vàng|tiền)/i);
    if (iGold >= 0 && !isMap) {
      props.push({ module: "coin_pile", x: 790, y: 1700, scale: 0.9, rot: 0, flip: false });
      actions.push({ target: "prop:coin_pile", verb: "drop", at_word: iGold, delay: 0, duration: 1, to: null, value: null });
    }
    if (chars.length >= 2 && !actions.some((a) => a.target === chars[1].character)) actions.push({ target: chars[1].character, verb: "look", to: chars[0].character, at_word: u.from, delay: 0.3, duration: 0.3, value: null });
    // bản đồ + động từ di chuyển → vẽ đường đi tới thành phố được nhắc
    if (isMap) {
      const labels = (lib.settings.get(setting)?.layers ?? []).flatMap((l) => l.items).filter((i) => i.module.startsWith("label:")).map((i) => i.module.slice(6));
      const dest = labels.find((l) => new RegExp(`\\b${l}`, "i").test(text));
      const from = labels.find((l) => l !== dest);
      if (dest && from) overlays.push({ text: `${from} > ${dest}`, style: "route", at_word: Math.max(u.from, iMove) });
    }

    const weather = /gold|coins|pension/i.test(text) ? "coins" : setting === "throne_room" ? "sparkles" : beat === "climax" ? "embers" : setting === "army_camp" ? "dust" : setting === "seaside_villa" ? "leaves" : "clear";
    out.push(
      SceneSchema.parse({
        id: `s${String(k + 1).padStart(3, "0")}`,
        beat,
        word_start: u.from,
        word_end: u.to,
        ...times[k],
        narration: text,
        description: "",
        background: { setting, weather, lighting: beat === "climax" && !isMap ? "dramatic" : "auto" },
        camera: { shot, move, focus: "auto" },
        characters: chars,
        props,
        actions,
        overlays,
        transition: newSetting && k > 0 ? "whip" : "cut",
        seed: hash("scene", k) % 10000,
      }),
    );
  });
  return out;
}

// ───────── Đường LLM ─────────

export const LlmScene = z.object({
  word_start: z.number().int(),
  word_end: z.number().int(),
  beat: z.enum(BEATS).catch("context"),
  narration_vi: z.string().default(""),
  description: z.string().default(""),
  setting: z.string(),
  weather: z.enum(WEATHERS).catch("clear"),
  lighting: z.enum(LIGHTINGS).catch("auto"),
  shot: z.enum(SHOTS).catch("wide"),
  move: z.enum(MOVES).catch("push_in"),
  characters: z
    .array(z.object({ character: z.string(), mark: z.string().default("A"), pose: z.string().default("stand"), expression: z.string().default("neutral"), speaking: z.boolean().default(false), flip: z.boolean().default(false) }))
    .default([]),
  overlays: z.array(z.object({ text: z.string(), style: z.enum(OVERLAY_STYLES).catch("title"), at_word: z.number().int().nullable().default(null) })).default([]),
  props: z.array(z.object({ module: z.string(), x: z.number().catch(760), y: z.number().catch(1650), scale: z.number().catch(1) })).catch([]).default([]),
  actions: z
    .array(z.object({ target: z.string(), verb: z.string(), at_word: z.number().int().nullable().catch(null).default(null), duration: z.number().catch(0.8).default(0.8), to: z.string().nullable().catch(null).default(null), value: z.string().nullable().catch(null).default(null) }))
    .catch([])
    .default([]),
  transition: z.enum(TRANSITIONS).catch("cut"),
  missing_module: z.string().nullable().optional(),
});
export const LlmResult = z.object({ scenes: z.array(LlmScene).min(1) });
export type LlmResult = z.infer<typeof LlmResult>;

export function buildSegmentPrompt(words: Word[], lib: { settings: Map<string, SettingSpec>; characters: Map<string, CharacterSpec> }, poses: string[], expressions: string[]) {
  const indexed = words.map((w, i) => `${i}:${w.text}[${w.start.toFixed(2)}]`).join(" ");
  const props = PROP_MODULES;
  const settings = [...lib.settings.values()]
    .map((s) => `- ${s.id} (${s.name}; marks ${Object.keys(s.marks).join("/")} — A giữa, B trái, C phải ở hậu cảnh, D/E tiền cảnh to hơn${s.seats.length ? `; CHỖ NGỒI: ${s.seats.join("/")} (pose sit chỉ dùng ở đây)` : "; không có chỗ ngồi"}; tags: ${s.tags.slice(0, 6).join(", ")})`)
    .join("\n");
  const chars = [...lib.characters.values()].map((c) => `- ${c.id}: ${c.name}${c.generator ? " (nhân vật phụ, dùng cho đám đông)" : ""}; alias: ${c.aliases.join(", ")}`).join("\n");
  const system = `Bạn là đạo diễn phân cảnh cho video ngắn hoạt hình chibi dọc 9:16 (YouTube Shorts/TikTok).
Nhiệm vụ: chia lời dẫn thành các cảnh liên tiếp phủ kín mọi từ, mỗi cảnh 1.2–4.2 giây, cắt ở ranh giới ý nghĩa; chọn tham số cảnh CHỈ từ thư viện được cung cấp.
Trả về DUY NHẤT JSON hợp lệ dạng {"scenes":[...]} — không markdown, không giải thích.`;
  const user = `LỜI DẪN (index:từ[giây bắt đầu]):
${indexed}

BỐI CẢNH CÓ SẴN:
${settings}

NHÂN VẬT CÓ SẴN:
${chars}

TƯ THẾ: ${poses.join(", ")}
NÉT MẶT: ${expressions.join(", ")}
NHỊP KỂ (beat): ${BEATS.join(", ")}
CAMERA shot: ${SHOTS.join(", ")} · move: ${MOVES.join(", ")}
THỜI TIẾT: ${WEATHERS.join(", ")} · ÁNH SÁNG: ${LIGHTINGS.join(", ")}
OVERLAY style: ${OVERLAY_STYLES.join(", ")} (banner = bảng treo cho năm/ngày; counter = số chạy; stamp = dấu mộc; title = chữ lớn; label = nhãn nhỏ; chart = biểu đồ cột, text "Tên:số; Tên:số"; timeline = trục thời gian, text "753 BC|476 AD"; route = đường đi trên bản đồ, text "Roma > Ravenna" theo nhãn có trên bản đồ; versus = đối đầu, text "A VS B")
ĐẠO CỤ (props, module): ${props.join(", ")} — tọa độ thiết kế 1080×1920, đáy giữa vật; mặt đất y≈1300–1700.
HÀNH ĐỘNG (actions) — làm cảnh "diễn" chứ không đứng yên: target = id nhân vật trong cảnh ("romulus", lần xuất hiện thứ 2 là "romulus#2") hoặc "prop:<module>"; verb ∈ ${VERBS.join(", ")}; at_word = index từ bắt đầu hành động (trong cảnh); duration giây; to = mark đích (move) / id nhân vật (approach, look, point_at); value = tư thế (pose), nét mặt (emote), "left"/"right" (enter/exit), hệ số (grow/shrink).
  Ví dụ: {"target":"odoacer","verb":"enter","value":"right","at_word":42,"duration":1.4}, {"target":"orestes","verb":"fall","at_word":57,"duration":0.6}, {"target":"prop:coin_pile","verb":"drop","at_word":88,"duration":1}.
CHUYỂN CẢNH: ${TRANSITIONS.join(", ")}

Mỗi phần tử scenes gồm: word_start, word_end (index từ, liên tục, cảnh sau bắt đầu = word_end cảnh trước + 1, cảnh đầu = 0, cảnh cuối = ${words.length - 1}), beat, narration_vi (dịch tiếng Việt tự nhiên), description (mô tả hình ảnh 1 câu tiếng Việt), setting, weather, lighting, shot, move, characters [{character, mark, pose, expression, speaking, flip}], overlays [{text, style, at_word}], props [{module, x, y, scale}], actions [{target, verb, at_word, duration, to, value}], transition, missing_module (tên đạo cụ còn thiếu trong thư viện nếu có, ngược lại null).
Quy tắc: cảnh đầu phải là hook mạnh; giữ nhân vật chính xuyên suốt; mark khác nhau cho các nhân vật trong cùng cảnh; overlay ngắn (≤ 5 từ) và at_word là index từ được nhắc tới; đổi bối cảnh dùng transition "whip"; chỉ đưa nhân vật vào cảnh khi lời dẫn liên quan tới họ; chỉ thêm đạo cụ khi lời dẫn nhắc tới hoặc hành động cần; hầu hết cảnh có 1–3 hành động khớp đúng từ đang đọc (đi vào, chỉ tay, ngã, đồ vật rơi, đổi nét mặt…); dữ liệu/số liệu dùng chart, mốc thời gian dùng timeline, hành quân trên bản đồ dùng route.`;
  return { system, user };
}

/** Chuẩn hóa kết quả LLM: phủ kín từ, sửa id không tồn tại, tính thời gian */
export function scenesFromLlm(res: LlmResult, alignment: Alignment, fps: number, lib: { settings: Map<string, SettingSpec>; characters: Map<string, CharacterSpec> }, poses: string[], expressions: string[]): { scenes: Scene[]; warnings: string[] } {
  const warnings: string[] = [];
  const words = alignment.words;
  const n = words.length;
  const raw = [...res.scenes].sort((a, b) => a.word_start - b.word_start);
  // Ép liên tục
  let cursor = 0;
  const fixed = raw
    .map((s, i) => {
      const start = cursor;
      const end = i === raw.length - 1 ? n - 1 : Math.max(start, Math.min(n - 1, s.word_end));
      cursor = end + 1;
      return { ...s, word_start: start, word_end: end };
    })
    .filter((s) => s.word_start <= s.word_end && s.word_start < n);
  if (fixed.length !== raw.length) warnings.push("LLM trả về khoảng từ chồng/thiếu — đã tự sửa");
  const times = computeTimes(fixed, words, alignment.duration, fps);
  const scenes = fixed.map((s, k) => {
    let setting = s.setting;
    if (!lib.settings.has(setting)) {
      warnings.push(`${s.setting}: bối cảnh không có → dùng title_card`);
      setting = "title_card";
    }
    const characters = s.characters
      .filter((c) => {
        const ok = lib.characters.has(c.character);
        if (!ok) warnings.push(`Nhân vật "${c.character}" không có trong thư viện`);
        return ok;
      })
      .map((c) => ({ ...c, pose: poses.includes(c.pose) ? c.pose : "stand", expression: expressions.includes(c.expression) ? c.expression : "neutral" }));
    // "ngồi" ở chỗ không có ghế → chuyển vào ghế còn trống, nếu không thì đứng
    const seats = lib.settings.get(setting)?.seats ?? [];
    for (const c of characters) {
      if (c.pose !== "sit" || seats.includes(c.mark)) continue;
      const free = seats.find((m) => !characters.some((o) => o.mark === m));
      if (free) c.mark = free;
      else c.pose = "stand";
    }
    const qa: Scene["qa_issues"] = s.missing_module ? [{ level: "info", message: `Gợi ý tạo module: ${s.missing_module}` }] : [];
    const props = s.props.filter((p) => PROP_MODULES.includes(p.module)).slice(0, 6).map((p) => ({ module: p.module, x: Math.max(-100, Math.min(1180, p.x)), y: Math.max(300, Math.min(1900, p.y)), scale: Math.max(0.2, Math.min(3, p.scale)), rot: 0, flip: false }));
    const marks = Object.keys(lib.settings.get(setting)?.marks ?? {});
    const charIds = characters.map((c) => c.character);
    const actions = s.actions.flatMap((a): Action[] => {
      if (!(VERBS as readonly string[]).includes(a.verb)) return [];
      const name = a.target.split("#")[0];
      const ok = name.startsWith("prop:") ? props.some((p) => p.module === name.slice(5)) : charIds.includes(name);
      if (!ok) return [];
      const verb = a.verb as Verb;
      let to = a.to;
      if (verb === "move" && to && !marks.includes(to)) to = null;
      if ((verb === "approach" || verb === "look" || verb === "point_at") && to && !charIds.includes(to.split("#")[0]) && !to.startsWith("prop:") && !marks.includes(to)) to = null;
      let value = a.value;
      if (verb === "pose" && !poses.includes(value ?? "")) return [];
      if (verb === "emote" && !expressions.includes(value ?? "")) return [];
      if ((verb === "enter" || verb === "exit") && value !== "left" && value !== "right") value = "right";
      const at = a.at_word != null && a.at_word >= s.word_start && a.at_word <= s.word_end ? a.at_word : null;
      return [{ target: a.target, verb, at_word: at, delay: 0, duration: Math.max(0.2, Math.min(4, a.duration)), to, value }];
    });
    return SceneSchema.parse({
      id: `s${String(k + 1).padStart(3, "0")}`,
      beat: s.beat,
      word_start: s.word_start,
      word_end: s.word_end,
      ...times[k],
      narration: words.slice(s.word_start, s.word_end + 1).map((w) => w.text).join(" "),
      narration_vi: s.narration_vi,
      description: s.description,
      background: { setting, weather: s.weather, lighting: s.lighting },
      camera: { shot: s.shot, move: s.move, focus: "auto" },
      characters,
      props,
      actions: actions.slice(0, 8),
      overlays: s.overlays.map((o) => ({ ...o, at_word: o.at_word != null && o.at_word >= s.word_start && o.at_word <= s.word_end ? o.at_word : null })),
      transition: s.transition,
      seed: hash("scene", k) % 10000,
      qa_issues: qa,
    });
  });
  return { scenes, warnings };
}

/** Lấy JSON đầu tiên trong chuỗi trả về của LLM */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Không tìm thấy JSON trong phản hồi LLM");
  return JSON.parse(text.slice(start, end + 1));
}

/** Khi alignment thay đổi (ví dụ thay voice): giữ nội dung cảnh, cập nhật lại thời gian */
export function retime(scenes: Scene[], alignment: Alignment, fps: number): Scene[] {
  const n = alignment.words.length;
  const valid = scenes.filter((s) => s.word_start < n).map((s, i, arr) => ({ ...s, word_end: i === arr.length - 1 ? n - 1 : Math.min(s.word_end, n - 1) }));
  const times = computeTimes(valid, alignment.words, alignment.duration, fps);
  return valid.map((s, k) => ({ ...s, ...times[k] }));
}

/** Số từ của kịch bản (dùng kiểm tra alignment có khớp kịch bản hiện tại) */
export const scriptWordCount = (script: string) => tokenize(script).length;
