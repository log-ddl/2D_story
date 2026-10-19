import { useState } from "react";
import { episodeDuration } from "../../engine/render";
import { useStore } from "../store";

export function OverviewPage() {
  const projects = useStore((s) => s.projects);
  const project = useStore((s) => s.project);
  const episode = useStore((s) => s.episode);
  const st = useStore();
  const [name, setName] = useState("");
  const [epTitle, setEpTitle] = useState("");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <section>
        <h2 className="mb-3 text-lg font-bold">Dự án</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {projects.map((p) => (
            <div key={p.id} className={`card flex flex-col gap-2 p-4 ${project?.id === p.id ? "border-acc" : ""}`}>
              <div className="font-semibold">{p.name}</div>
              <div className="font-mono text-[10.5px] text-dim">{p.id}</div>
              <div className="mt-auto flex gap-2">
                <button className="btn" onClick={() => void st.openProject(p.id).then(() => st.setPage("storyboard"))}>
                  Mở
                </button>
                <button className="btn text-bad" onClick={() => confirm(`Xóa dự án "${p.name}"? Không hoàn tác được.`) && void st.deleteProject(p.id)}>
                  Xóa
                </button>
              </div>
            </div>
          ))}
          <div className="card flex flex-col gap-2 border-dashed p-4">
            <input className="field" placeholder="Tên dự án mới" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-acc" disabled={!name.trim()} onClick={() => void st.createProject(name.trim()).then(() => setName(""))}>
                Tạo
              </button>
              <button className="btn" onClick={() => void st.createProject("Demo La Mã", true)}>
                Tạo từ mẫu
              </button>
            </div>
          </div>
        </div>
      </section>

      {project && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Các tập của “{project.name}”</h2>
          <div className="flex flex-col gap-2">
            {project.episodes.map((e) => (
              <button key={e.id} className={`card flex items-center gap-3 p-3 text-left hover:border-mute/50 ${episode?.id === e.id ? "border-acc" : ""}`} onClick={() => void st.openEpisode(e.id).then(() => st.setPage("storyboard"))}>
                <span className="font-medium">{e.title}</span>
                {episode?.id === e.id && (
                  <span className="ml-auto font-mono text-xs text-mute">
                    {episode.scenes.length} cảnh · {episodeDuration(episode).toFixed(1)}s
                  </span>
                )}
              </button>
            ))}
            <div className="flex gap-2">
              <input className="field max-w-xs" placeholder="Tên tập mới" value={epTitle} onChange={(e) => setEpTitle(e.target.value)} />
              <button className="btn" disabled={!epTitle.trim()} onClick={() => void st.newEpisode(epTitle.trim()).then(() => setEpTitle(""))}>
                + Tập mới
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card p-5 text-[13px] leading-relaxed text-mute">
        <h3 className="mb-2 font-semibold text-ink">Quy trình</h3>
        <ol className="list-decimal pl-5">
          <li>
            <b className="text-ink">Kịch bản</b>: dán kịch bản, nhập file giọng đọc (hoặc đọc bằng giọng máy), bấm Phân tích.
          </li>
          <li>
            <b className="text-ink">Phân cảnh</b>: xem lưới cảnh, chỉnh bối cảnh/nhân vật/camera/chữ; kéo ranh giới trên timeline để dời điểm cắt.
          </li>
          <li>
            <b className="text-ink">Đạo diễn</b>: xem toàn tập 60fps khớp giọng đọc.
          </li>
          <li>
            <b className="text-ink">Dựng &amp; Xuất</b>: xuất MP4 9:16 kèm phụ đề, SFX, nhạc nền.
          </li>
        </ol>
        <p className="mt-2">Phím tắt: ⌘K bảng lệnh · Space phát/dừng · ⌘Z / ⇧⌘Z hoàn tác · ←/→ đổi cảnh.</p>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const caps = useStore((s) => s.caps);
  const backend = useStore((s) => s.backend);
  const saveSettings = useStore((s) => s.saveSettings);
  const [draft, setDraft] = useState(settings);
  const field = (k: keyof typeof draft, label: string, opts: { type?: string; placeholder?: string; hint?: string } = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="field" type={opts.type ?? "text"} placeholder={opts.placeholder} value={String(draft[k])} onChange={(e) => setDraft({ ...draft, [k]: opts.type === "number" ? +e.target.value : e.target.value })} />
      {opts.hint && <p className="mt-1 text-[11px] text-dim">{opts.hint}</p>}
    </div>
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-bold">Claude (Anthropic)</h2>
        {field("anthropicKey", "API key", { type: "password", placeholder: "sk-ant-…", hint: "Lưu cục bộ trên máy này. Dùng để chia cảnh, dịch, vẽ module SVG và soi khung hình." })}
        {field("model", "Model", { hint: "Mặc định claude-opus-5-5." })}
      </section>
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg font-bold">Công cụ cục bộ</h2>
        {field("ffmpeg", "Đường dẫn ffmpeg (bỏ trống = tự dò)", { placeholder: "/opt/homebrew/bin/ffmpeg" })}
        {field("whisperCli", "Đường dẫn whisper-cli (tùy chọn)", { placeholder: "/opt/homebrew/bin/whisper-cli" })}
        {field("whisperModel", "File model whisper .bin (tùy chọn)", { placeholder: "~/models/ggml-base.en.bin", hint: "Có whisper thì căn thời gian theo nhận dạng giọng nói và báo chỗ đọc lệch kịch bản; không có thì dùng thuật toán khoảng lặng." })}
        <div className="rounded-lg bg-panel2 p-3 font-mono text-[12px]">
          <div>backend: {backend?.kind}</div>
          <div className={caps?.ffmpeg ? "text-ok" : "text-bad"}>ffmpeg: {caps?.ffmpeg ?? "không có"}</div>
          <div className={caps?.say ? "text-ok" : "text-mute"}>macOS say: {caps?.say ? "có" : "không"}</div>
          <div className={caps?.whisper ? "text-ok" : "text-mute"}>whisper-cli: {caps?.whisper ?? "không có"}</div>
          <div className="text-mute">dữ liệu: {caps?.root}</div>
        </div>
      </section>
      <button className="btn-acc self-start" onClick={() => void saveSettings(draft)}>
        Lưu cài đặt
      </button>
    </div>
  );
}
