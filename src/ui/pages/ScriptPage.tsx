import { useEffect, useState } from "react";
import { ArrowRight, Speech, Upload } from "lucide-react";
import { DEFAULT_BRIEF } from "../../brain";
import { ASPECT_LIST } from "../../engine/frame";
import { estimateAlignment } from "../../pipeline/align";
import { tokenize } from "../../pipeline/text";
import { useStore } from "../store";

const ASPECT_HINT: Record<string, string> = { "9:16": "Shorts · TikTok · Reels", "16:9": "YouTube ngang", "1:1": "Vuông · Facebook", "4:5": "Instagram feed" };

export function ScriptPage() {
  const episode = useStore((s) => s.episode);
  const audio = useStore((s) => s.audio);
  const backend = useStore((s) => s.backend);
  const settings = useStore((s) => s.settings);
  const st = useStore.getState();
  const [voices, setVoices] = useState<string[]>([]);

  useEffect(() => {
    backend?.sayVoices?.().then(setVoices).catch(() => {});
  }, [backend]);

  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const words = tokenize(episode.script_text).length;
  const est = episode.script_text.trim() ? estimateAlignment(episode.script_text).duration : 0;
  const custom = episode.brief.trim().length > 0;

  return (
    <div className="grid h-full grid-cols-[1fr_380px] gap-4 overflow-hidden p-5">
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
            {words} từ · ước lượng ~{est.toFixed(0)}s
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <section className="card p-4">
          <h3 className="mb-2 font-semibold">Khung hình</h3>
          <div className="grid grid-cols-4 gap-2">
            {ASPECT_LIST.map((a) => {
              const [w, h] = a.split(":").map(Number);
              const on = episode.aspect === a;
              return (
                <button key={a} title={ASPECT_HINT[a]} onClick={() => st.updateEpisode((e) => ({ ...e, aspect: a }))} className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 ${on ? "border-acc bg-acc/10 text-acc" : "border-line text-mute hover:text-ink"}`}>
                  <span className="block rounded-sm border-2 border-current" style={{ width: (w / Math.max(w, h)) * 30, height: (h / Math.max(w, h)) * 30 }} />
                  <span className="font-mono text-[12px]">{a}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-dim">{ASPECT_HINT[episode.aspect]} — đổi lúc nào cũng được, bối cảnh tự dàn lại.</p>
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-semibold">Hướng dẫn phân tích</h3>
            <div className="ml-auto flex rounded-md border border-line p-0.5 text-[11.5px]">
              <button className={`rounded px-2 py-0.5 ${!custom ? "bg-panel2 text-ink" : "text-mute"}`} onClick={() => st.updateEpisode((e) => ({ ...e, brief: "" }))}>
                Mặc định
              </button>
              <button className={`rounded px-2 py-0.5 ${custom ? "bg-panel2 text-ink" : "text-mute"}`} onClick={() => !custom && st.updateEpisode((e) => ({ ...e, brief: DEFAULT_BRIEF }))}>
                Tùy chỉnh
              </button>
            </div>
          </div>
          <textarea
            className={`field resize-y text-[12.5px] leading-relaxed ${custom ? "" : "text-mute"}`}
            rows={7}
            readOnly={!custom}
            value={custom ? episode.brief : DEFAULT_BRIEF}
            onChange={(e) => st.updateEpisode((x) => ({ ...x, brief: e.target.value }), { history: false })}
          />
          <p className="mt-1.5 text-[11px] text-dim">Bộ não dùng hướng dẫn này khi lập dàn nhân vật/bối cảnh và khi chia cảnh. Ví dụ: “giọng hài, nhiều cận mặt”, “mỗi cảnh ≤ 3 giây”, “không dùng bản đồ”.</p>
        </section>

        <section className="card p-4">
          <h3 className="mb-2 font-semibold">Giọng đọc</h3>
          {audio && episode.audio ? (
            <div className="mb-3 flex flex-col gap-2">
              <audio controls src={audio.url} className="w-full" />
              <div className="flex items-center justify-between text-xs text-mute">
                <span>
                  {episode.audio.source === "say" ? "Giọng máy macOS" : "File tải lên"} · {audio.duration.toFixed(1)}s
                </span>
                <button className="text-bad hover:underline" onClick={st.clearVoice}>
                  Bỏ giọng đọc
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-xs text-mute">Chưa có giọng đọc — thời lượng cảnh sẽ được ước lượng. Có giọng đọc thì mỗi cảnh khớp đúng từng từ.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => void st.importVoice()}>
              <Upload className="h-3.5 w-3.5" /> Nhập file giọng đọc
            </button>
            {backend?.say && (
              <button className="btn" onClick={() => void st.sayVoice()} disabled={!episode.script_text.trim()} title="Tạo giọng đọc tạm bằng giọng máy có sẵn của macOS (offline) để thử nhịp và chia cảnh trước khi có giọng thật.">
                <Speech className="h-3.5 w-3.5" /> Đọc bằng giọng máy
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
          {backend?.kind === "web" && <p className="mt-2 text-[11px] text-dim">Chạy app desktop để có giọng máy, bộ não CLI và xuất MP4.</p>}
        </section>

        <button className="btn-acc justify-center !py-2.5" disabled={!episode.script_text.trim()} onClick={() => st.setPage("cast")}>
          Tiếp: Nhân vật & Bối cảnh <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
