import { useEffect, useState } from "react";
import { estimateAlignment } from "../../pipeline/align";
import { tokenize } from "../../pipeline/text";
import { Timeline } from "../components/Timeline";
import { useStore } from "../store";

export function ScriptPage() {
  const episode = useStore((s) => s.episode);
  const library = useStore((s) => s.library);
  const audio = useStore((s) => s.audio);
  const backend = useStore((s) => s.backend);
  const settings = useStore((s) => s.settings);
  const caps = useStore((s) => s.caps);
  const st = useStore();
  const [voices, setVoices] = useState<string[]>([]);

  useEffect(() => {
    backend?.sayVoices?.().then(setVoices).catch(() => {});
  }, [backend]);

  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const words = tokenize(episode.script_text).length;
  const est = episode.script_text.trim() ? estimateAlignment(episode.script_text).duration : 0;
  const al = episode.alignment;
  const stale = al && al.words.length !== words;
  const hasKey = !!settings.anthropicKey;

  return (
    <div className="grid h-full grid-cols-[1fr_400px] gap-4 overflow-hidden p-5">
      <div className="flex min-h-0 flex-col gap-3">
        <input className="field !bg-transparent !px-0 !text-xl font-bold" value={episode.title} onChange={(e) => st.updateEpisode((x) => ({ ...x, title: e.target.value }), { history: false })} />
        <div className="relative min-h-0 flex-1">
          <textarea
            className="field h-full resize-none !p-4 !text-[15px] leading-7"
            placeholder="Dán kịch bản vào đây… (mỗi câu kết thúc bằng dấu chấm/hỏi/than để chia cảnh tốt hơn)"
            value={episode.script_text}
            onChange={(e) => st.updateEpisode((x) => ({ ...x, script_text: e.target.value }), { history: false })}
          />
          <div className="absolute right-3 bottom-2 font-mono text-[11px] text-mute">
            {words} từ · ước lượng ~{est.toFixed(0)}s {stale && <span className="text-warn">· kịch bản đã đổi, cần phân tích lại</span>}
          </div>
        </div>
        <Timeline height={118} />
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <section className="card p-4">
          <h3 className="mb-2 font-semibold">1 · Giọng đọc</h3>
          {audio && episode.audio ? (
            <div className="mb-3 flex flex-col gap-2">
              <audio controls src={audio.url} className="w-full" />
              <div className="flex items-center justify-between text-xs text-mute">
                <span>
                  {episode.audio.source === "say" ? "macOS say" : "File tải lên"} · {audio.duration.toFixed(1)}s
                </span>
                <button className="text-bad hover:underline" onClick={st.clearVoice}>
                  Bỏ giọng đọc
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-xs text-mute">Chưa có giọng đọc — thời lượng cảnh đang được ước lượng theo số âm tiết.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => void st.importVoice()}>
              ⬆ Nhập file giọng đọc
            </button>
            {backend?.say && (
              <button className="btn" onClick={() => void st.sayVoice()} disabled={!episode.script_text.trim()}>
                🗣 Đọc bằng giọng máy
              </button>
            )}
          </div>
          {backend?.say && (
            <div className="mt-2 grid grid-cols-[1fr_90px] gap-2">
              <select className="field" value={settings.sayVoice} onChange={(e) => void st.saveSettings({ ...settings, sayVoice: e.target.value })}>
                {(voices.length ? voices : [settings.sayVoice]).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <input className="field" type="number" min={120} max={260} value={settings.sayRate} onChange={(e) => void st.saveSettings({ ...settings, sayRate: +e.target.value })} title="Tốc độ (từ/phút)" />
            </div>
          )}
          {backend?.kind === "web" && <p className="mt-2 text-[11px] text-dim">Chạy app desktop (Tauri) để có giọng máy offline, whisper và xuất MP4.</p>}
        </section>

        <section className="card p-4">
          <h3 className="mb-2 font-semibold">2 · Dàn nhân vật</h3>
          <div className="flex flex-wrap gap-1.5">
            {[...library.characters.values()].map((c) => {
              const on = episode.cast.includes(c.id);
              return (
                <button key={c.id} className={`chip border ${on ? "border-acc bg-acc/15 text-acc" : "border-line text-mute"}`} onClick={() => st.updateEpisode((e) => ({ ...e, cast: on ? e.cast.filter((x) => x !== c.id) : [...e.cast, c.id] }))}>
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-dim">Bỏ trống = dùng toàn bộ thư viện. Nhân vật được nhận ra theo tên và biệt danh trong lời dẫn.</p>
        </section>

        <section className="card p-4">
          <h3 className="mb-1 font-semibold">3 · Khớp giọng + chia cảnh</h3>
          <p className="mb-3 text-xs text-mute">
            Căn thời gian từng từ ({caps?.whisper && settings.whisperModel ? "whisper.cpp" : audio ? "theo khoảng lặng trong giọng đọc" : "ước lượng"}), rồi chia cảnh 1.2–4.2s tại ranh giới ý nghĩa; điểm cắt nằm giữa khoảng lặng.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-acc justify-center" disabled={!hasKey || !episode.script_text.trim()} onClick={() => void st.analyze("llm")} title={hasKey ? "" : "Cần Anthropic API key trong Cài đặt"}>
              ✦ Phân tích bằng Claude
            </button>
            <button className="btn justify-center" disabled={!episode.script_text.trim()} onClick={() => void st.analyze("rule")}>
              ⚙ Phân tích offline (không cần API)
            </button>
            {episode.scenes.length > 0 && !stale && (
              <button className="btn justify-center" onClick={() => void st.realign()}>
                ↻ Chỉ khớp lại thời gian (giữ nội dung cảnh)
              </button>
            )}
          </div>
          {!hasKey && <p className="mt-2 text-[11px] text-dim">Thêm Anthropic API key trong Cài đặt để Claude chia cảnh, dịch và chọn tham số.</p>}
        </section>

        {al && (
          <section className="card p-4 text-xs">
            <h3 className="mb-2 text-[13px] font-semibold">Kết quả căn thời gian</h3>
            <div className="grid grid-cols-2 gap-y-1 text-mute">
              <span>Phương pháp</span>
              <span className="text-ink">{al.method}</span>
              <span>Số từ</span>
              <span className="text-ink">{al.words.length}</span>
              <span>Thời lượng</span>
              <span className="text-ink">{al.duration.toFixed(2)}s</span>
              <span>Khoảng lặng</span>
              <span className="text-ink">{al.silences.length}</span>
              <span>Số cảnh</span>
              <span className="text-ink">{episode.scenes.length}</span>
            </div>
            {al.mismatches.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 text-warn">Giọng đọc lệch kịch bản ({al.mismatches.length}):</div>
                <ul className="max-h-32 overflow-y-auto">
                  {al.mismatches.slice(0, 30).map((m, i) => (
                    <li key={i}>
                      “{m.expected}” → <span className="text-warn">{m.heard || "(bỏ qua)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
