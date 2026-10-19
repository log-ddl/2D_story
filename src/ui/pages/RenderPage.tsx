import { useState } from "react";
import { Download, TriangleAlert, X } from "lucide-react";
import { outputSize } from "../../engine/frame";
import { episodeDuration } from "../../engine/render";
import { sfxEvents } from "../../pipeline/audio";
import { useStore } from "../store";

export function RenderPage() {
  const episode = useStore((s) => s.episode);
  const backend = useStore((s) => s.backend);
  const caps = useStore((s) => s.caps);
  const jobs = useStore((s) => s.jobs);
  const st = useStore.getState();
  const [short, setShort] = useState(1080);
  const [fps, setFps] = useState(30);
  const [crf, setCrf] = useState(18);
  const [sfx, setSfx] = useState(true);
  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const dur = episodeDuration(episode);
  const frames = Math.ceil(dur * fps);
  const tauri = backend?.kind === "tauri";
  const warn = episode.scenes.filter((s) => s.status === "warning").length;
  const running = jobs.some((j) => j.status === "running" && j.label.startsWith("Xuất"));

  const downloadSrt = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([st.exportSrt()], { type: "text/plain" }));
    a.download = `${episode.title}.srt`;
    a.click();
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 p-6">
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-bold">Xuất video</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Độ phân giải</label>
            <select className="field" value={short} onChange={(e) => setShort(+e.target.value)}>
              {[720, 1080, 2160].map((v) => {
                const [w, h] = outputSize(episode.aspect, v);
                return (
                  <option key={v} value={v}>
                    {w} × {h} {v === 2160 ? "(4K)" : v === 720 ? "(nháp)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="label">Khung hình/giây</label>
            <select className="field" value={fps} onChange={(e) => setFps(+e.target.value)}>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>
          <div>
            <label className="label">Chất lượng (CRF)</label>
            <select className="field" value={crf} onChange={(e) => setCrf(+e.target.value)}>
              <option value={14}>Rất cao (14)</option>
              <option value={18}>Cao (18)</option>
              <option value={23}>Vừa (23)</option>
            </select>
          </div>
          <div>
            <label className="label">Nhạc nền</label>
            <div className="flex gap-1.5">
              <button className="btn flex-1 justify-center truncate" onClick={() => void st.importMusic()}>
                {episode.music ? "Đổi nhạc" : "+ Chọn file"}
              </button>
              {episode.music && (
                <button className="btn" onClick={() => st.updateEpisode((e) => ({ ...e, music: null }))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        {episode.music && (
          <div>
            <label className="label">Âm lượng nhạc (tự giảm khi có giọng đọc): {(episode.music.volume * 100).toFixed(0)}%</label>
            <input type="range" min={0} max={1} step={0.05} value={episode.music.volume} className="w-full accent-[var(--color-acc)]" onChange={(e) => st.updateEpisode((x) => ({ ...x, music: x.music && { ...x.music, volume: +e.target.value } }), { history: false })} />
          </div>
        )}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={episode.subtitles} onChange={() => st.updateEpisode((e) => ({ ...e, subtitles: !e.subtitles }))} /> Phụ đề in vào hình (highlight từng từ)
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} /> Hiệu ứng âm thanh tự sinh ({sfxEvents(episode).length} tiếng pop/whoosh/ding)
        </label>
        <div className="rounded-lg bg-panel2 p-3 font-mono text-[12px] text-mute">
          khung {episode.aspect} · {dur.toFixed(2)}s · {frames} frame · {episode.scenes.length} cảnh · giọng: {episode.audio ? "có" : "không"} · nhạc: {episode.music ? "có" : "không"}
        </div>
        {warn > 0 && <div className="flex items-center gap-1.5 text-xs text-warn"><TriangleAlert className="h-3.5 w-3.5" /> {warn} cảnh còn cảnh báo QA — vẫn xuất được.</div>}
        <button className="btn-acc justify-center !py-2.5" disabled={!dur || running || (tauri && !caps?.ffmpeg)} onClick={() => void st.exportVideo({ short, fps, subtitles: episode.subtitles, sfx, crf })}>
          <Download className="h-4 w-4" /> {tauri ? "Xuất MP4 (H.264 + AAC)" : "Ghi WebM realtime (bản xem thử)"}
        </button>
        {tauri && !caps?.ffmpeg && <div className="text-xs text-bad">Không tìm thấy ffmpeg — cài bằng `brew install ffmpeg` hoặc chỉ đường dẫn trong Cài đặt.</div>}
        <button className="btn justify-center" disabled={!episode.alignment} onClick={downloadSrt}>
          Tải phụ đề .srt
        </button>
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-bold">Tác vụ</h2>
        {jobs.length === 0 && <p className="text-mute">Chưa có tác vụ nào.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="rounded-lg border border-line bg-panel2 p-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium">{j.label}</span>
              <span className={j.status === "error" ? "text-bad" : j.status === "done" ? "text-ok" : "text-acc"}>{j.status === "running" ? `${Math.round(j.progress * 100)}%` : j.status === "done" ? "Xong" : "Lỗi"}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-line">
              <div className={`h-full ${j.status === "error" ? "bg-bad" : "bg-acc"}`} style={{ width: `${j.progress * 100}%` }} />
            </div>
            {j.detail && <div className="mt-1 text-[11px] break-all text-mute">{j.detail}</div>}
            {j.status === "running" && j.label.startsWith("Xuất") && (
              <button className="mt-2 text-xs text-bad hover:underline" onClick={() => void backend?.exportCancel?.()}>
                Hủy
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
