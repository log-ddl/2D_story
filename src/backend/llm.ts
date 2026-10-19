// Gọi Claude qua SDK chính thức (chạy trong WebView của Tauri hoặc trình duyệt).
// Key lưu cục bộ trên máy người dùng; SDK cần dangerouslyAllowBrowser vì chạy phía client.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BEATS, LIGHTINGS, MOVES, OVERLAY_STYLES, SHOTS, TRANSITIONS, WEATHERS } from "../schema";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface LlmConfig {
  apiKey: string;
  model?: string;
  /** Cho test: thay fetch */
  fetch?: typeof fetch;
}

function client(cfg: LlmConfig) {
  if (!cfg.apiKey) throw new Error("Chưa có Anthropic API key — vào Cài đặt để nhập");
  return new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, ...(cfg.fetch ? { fetch: cfg.fetch } : {}) });
}

// Schema chặt cho structured output (mọi trường bắt buộc); kết quả sau đó
// vẫn đi qua LlmResult (lỏng hơn) trong pipeline/segment.ts để chuẩn hóa.
const ApiScene = z.object({
  word_start: z.number().int(),
  word_end: z.number().int(),
  beat: z.enum(BEATS),
  narration_vi: z.string(),
  description: z.string(),
  setting: z.string(),
  weather: z.enum(WEATHERS),
  lighting: z.enum(LIGHTINGS),
  shot: z.enum(SHOTS),
  move: z.enum(MOVES),
  characters: z.array(
    z.object({ character: z.string(), mark: z.string(), pose: z.string(), expression: z.string(), speaking: z.boolean(), flip: z.boolean() }),
  ),
  overlays: z.array(z.object({ text: z.string(), style: z.enum(OVERLAY_STYLES), at_word: z.number().int().nullable() })),
  transition: z.enum(TRANSITIONS),
  missing_module: z.string().nullable(),
});
export const ApiSegmentResult = z.object({ scenes: z.array(ApiScene) });

export const ApiSvgResult = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  svg: z.string(),
  notes: z.string(),
});

async function run<T>(cfg: LlmConfig, system: string, user: string, format: ReturnType<typeof zodOutputFormat<z.ZodType<T>>>, effort: "low" | "medium" | "high", onProgress?: (chars: number) => void): Promise<T> {
  const c = client(cfg);
  const stream = c.beta.messages.stream({
    model: cfg.model || DEFAULT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format },
  });
  let n = 0;
  stream.on("text", (d) => {
    n += d.length;
    onProgress?.(n);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error(`Claude từ chối yêu cầu (${msg.stop_details?.category ?? "không rõ"})`);
  if (msg.stop_reason === "max_tokens") throw new Error("Phản hồi bị cắt do vượt max_tokens");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as T;
}

export function llmSegment(cfg: LlmConfig, system: string, user: string, onProgress?: (chars: number) => void) {
  return run(cfg, system, user, zodOutputFormat(ApiSegmentResult), "medium", onProgress);
}

export function llmSvg(cfg: LlmConfig, system: string, user: string, onProgress?: (chars: number) => void) {
  return run(cfg, system, user, zodOutputFormat(ApiSvgResult), "high", onProgress);
}

export function llmTranslate(cfg: LlmConfig, lines: string[]) {
  const schema = z.object({ vi: z.array(z.string()) });
  return run(
    cfg,
    "Dịch từng dòng lời dẫn video sang tiếng Việt tự nhiên, ngắn gọn, giữ nguyên số dòng và thứ tự.",
    JSON.stringify(lines),
    zodOutputFormat(schema),
    "low",
  ).then((r) => r.vi);
}

/** QA hình: gửi frame PNG để Claude so với mô tả cảnh */
export async function llmVisionQa(cfg: LlmConfig, pngBase64: string, description: string, narration: string): Promise<{ ok: boolean; issues: string[] }> {
  const schema = z.object({ ok: z.boolean(), issues: z.array(z.string()) });
  const c = client(cfg);
  const stream = c.beta.messages.stream({
    model: cfg.model || DEFAULT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: "Bạn là người kiểm tra chất lượng khung hình hoạt hình chibi dọc 9:16. Chỉ ra lỗi thị giác cụ thể (nhân vật bị che, chữ tràn/khó đọc, sai bối cảnh so với lời dẫn, bố cục trống). Viết tiếng Việt, ngắn gọn.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: pngBase64 } },
          { type: "text", text: `Lời dẫn: ${narration}\nMô tả mong muốn: ${description || "(không có)"}\nKhung hình có ổn để đăng không?` },
        ],
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude từ chối kiểm tra khung hình");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return schema.parse(JSON.parse(text));
}
