import { describe, expect, it } from "vitest";
import { llmSegment } from "./llm";
import { LlmResult, scenesFromLlm, buildSegmentPrompt } from "../pipeline/segment";
import { estimateAlignment } from "../pipeline/align";
import { Library } from "../engine/library";
import { DEMO_SCRIPT } from "../library/demo";

/** Giả lập API trả về SSE stream giống thật */
function fakeFetch(json: unknown, captured: { url?: string; body?: any; headers?: Headers }) {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(url);
    captured.body = JSON.parse(String(init?.body));
    captured.headers = new Headers(init?.headers);
    const text = JSON.stringify(json);
    const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const sse =
      ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }) +
      ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
      ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(0, 20) } }) +
      ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(20) } }) +
      ev("content_block_stop", { index: 0 }) +
      ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 50 } }) +
      ev("message_stop", {});
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

describe("llm", () => {
  it("gửi đúng model/beta/fallbacks/structured output và parse kết quả", async () => {
    const al = estimateAlignment(DEMO_SCRIPT);
    const lib = new Library();
    const n = al.words.length;
    const reply = {
      scenes: [
        { word_start: 0, word_end: 3, beat: "number", narration_vi: "Ngày 4/9/476.", description: "", setting: "throne_room", weather: "sparkles", lighting: "auto", shot: "wide", move: "push_in", characters: [{ character: "romulus", mark: "A", pose: "sit", expression: "worried", speaking: false, flip: false }], overlays: [{ text: "476 AD", style: "banner", at_word: 2 }], transition: "cut", missing_module: null },
        { word_start: 4, word_end: n - 1, beat: "context", narration_vi: "…", description: "", setting: "forum", weather: "clear", lighting: "auto", shot: "medium", move: "static", characters: [], overlays: [], transition: "whip", missing_module: "boat" },
      ],
    };
    const cap: { body?: any; headers?: Headers; url?: string } = {};
    const { system, user } = buildSegmentPrompt(al.words, lib, ["stand", "sit"], ["neutral", "worried"]);
    const raw = await llmSegment({ apiKey: "sk-test", fetch: fakeFetch(reply, cap) }, system, user);
    expect(cap.url).toContain("/v1/messages");
    expect(cap.body.model).toBe("claude-opus-5-5");
    expect(cap.body.fallbacks).toBe("default");
    expect(cap.body.stream).toBe(true);
    expect(cap.body.output_config.format.type).toBe("json_schema");
    expect(cap.headers?.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    const { scenes } = scenesFromLlm(LlmResult.parse(raw), al, 30, lib, ["stand", "sit"], ["neutral", "worried"]);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].overlays[0].at_word).toBe(2);
    expect(scenes[1].qa_issues[0].message).toContain("boat");
  });
});

describe("llm svg", () => {
  it("module SVG do AI trả về đi qua linter", async () => {
    const { llmSvg } = await import("./llm");
    const { lintModule } = await import("../engine/svg");
    const svg = `<svg viewBox="-100 -120 200 120"><g stroke="#2b2233" stroke-width="6"><path d="M-90 0 Q0 -110 90 0 Z" fill="#8a5a33"/><rect x="-10" y="-100" width="20" height="60" fill="#f5e6c4"/></g></svg>`;
    const cap: { body?: any } = {};
    const r = await llmSvg({ apiKey: "sk-test", fetch: fakeFetch({ id: "boat", tags: ["boat", "thuyền"], svg, notes: "" }, cap) }, "sys", "vẽ thuyền");
    expect(cap.body.output_config.effort).toBe("high");
    expect(r.id).toBe("boat");
    expect(lintModule(r.svg).filter((i) => i.level === "error")).toEqual([]);
  });
});
