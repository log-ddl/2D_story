// Kiểm tra QA tự động cho từng cảnh.

import type { Episode, Scene } from "../schema";
import type { Library } from "../engine/library";
import { MAX_SCENE, MIN_SCENE } from "./segment";
import { resolveTarget } from "../engine/actions";

export function qaScene(ep: Episode, scene: Scene, idx: number, lib: Library): Scene["qa_issues"] {
  const issues: Scene["qa_issues"] = scene.qa_issues.filter((q) => q.level === "info" && q.message.startsWith("Gợi ý"));
  const words = ep.alignment?.words ?? [];
  if (scene.duration < MIN_SCENE - 0.05) issues.push({ level: "warn", message: `Cảnh quá ngắn (${scene.duration.toFixed(2)}s < ${MIN_SCENE}s)` });
  if (scene.duration > MAX_SCENE + 0.6) issues.push({ level: "warn", message: `Cảnh quá dài (${scene.duration.toFixed(2)}s) — nên tách` });
  if (!lib.settings.has(scene.background.setting)) issues.push({ level: "error", message: `Thiếu bối cảnh "${scene.background.setting}"` });
  for (const c of scene.characters) if (!lib.getCharacter(c.character)) issues.push({ level: "error", message: `Thiếu nhân vật "${c.character}"` });
  for (const p of scene.props) if (!lib.getModule(p.module)) issues.push({ level: "error", message: `Thiếu module "${p.module}"` });
  const setting = lib.settings.get(scene.background.setting);
  for (const c of scene.characters) if (setting && !setting.marks[c.mark]) issues.push({ level: "warn", message: `Mark "${c.mark}" không có trong bối cảnh` });
  const marks = scene.characters.map((c) => c.mark);
  if (new Set(marks).size < marks.length) issues.push({ level: "info", message: "Nhiều nhân vật chung một mark (sẽ tự giãn ra)" });
  for (const o of scene.overlays) {
    if (o.text.length > 32) issues.push({ level: "warn", message: `Chữ quá dài: "${o.text.slice(0, 20)}…"` });
    if (o.at_word != null && (o.at_word < scene.word_start || o.at_word > scene.word_end)) issues.push({ level: "warn", message: `Overlay "${o.text}" gắn vào từ ngoài cảnh` });
  }
  for (const a of scene.actions) if (!resolveTarget(scene, a.target)) issues.push({ level: "warn", message: `Hành động "${a.verb}" trỏ tới "${a.target}" không có trong cảnh` });
  for (const a of scene.actions) if (a.at_word != null && (a.at_word < scene.word_start || a.at_word > scene.word_end)) issues.push({ level: "warn", message: `Hành động "${a.verb}" gắn vào từ ngoài cảnh` });
  if (!scene.characters.length && !scene.overlays.length && !scene.props.length && !scene.background.setting.startsWith("map")) issues.push({ level: "info", message: "Cảnh chỉ có nền — cân nhắc thêm nhân vật hoặc chữ" });
  const mism = ep.alignment?.mismatches.filter((m) => m.index >= scene.word_start && m.index <= scene.word_end) ?? [];
  if (mism.length) issues.push({ level: "warn", message: `Giọng đọc lệch kịch bản: ${mism.slice(0, 3).map((m) => `"${m.expected}"→"${m.heard || "∅"}"`).join(", ")}` });
  const low = words.slice(scene.word_start, scene.word_end + 1).filter((w) => w.conf < 0.35).length;
  if (ep.alignment && ep.alignment.method !== "estimate" && low > 0) issues.push({ level: "info", message: `${low} từ căn thời gian kém tin cậy` });
  if (ep.alignment?.method === "estimate") issues.push({ level: "info", message: "Thời lượng đang ước lượng — chưa có giọng đọc" });
  const prev = ep.scenes[idx - 1];
  const prev2 = ep.scenes[idx - 2];
  if (prev && prev2 && [prev, prev2].every((p) => p.background.setting === scene.background.setting && p.camera.shot === scene.camera.shot)) issues.push({ level: "info", message: "3 cảnh liền cùng bối cảnh + cỡ cảnh — dễ nhàm" });
  return issues;
}

export function runQa(ep: Episode, lib: Library): Episode {
  const scenes = ep.scenes.map((s, i) => {
    const qa_issues = qaScene(ep, s, i, lib);
    const status: Scene["status"] = qa_issues.some((q) => q.level !== "info") ? "warning" : "ready";
    return { ...s, qa_issues, status };
  });
  return { ...ep, scenes };
}
