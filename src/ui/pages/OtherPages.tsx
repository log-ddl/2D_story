import { useEffect, useState } from "react";
import { episodeDuration } from "../../engine/render";
import { useStore } from "../store";

export function OverviewPage() {
  const projects = useStore((s) => s.projects);
  const project = useStore((s) => s.project);
  const episode = useStore((s) => s.episode);
  const st = useStore.getState();
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
            <b className="text-ink">Kịch bản</b>: dán kịch bản, chọn khung hình (9:16, 16:9, 1:1, 4:5), nhập giọng đọc hoặc đọc bằng giọng máy.
          </li>
          <li>
            <b className="text-ink">Nhân vật &amp; Bối cảnh</b>: bộ não (CLI claude / codex / agy) đọc kịch bản, chọn hoặc tạo nhân vật, bối cảnh, tông màu, kiểu phụ đề. Lưu vào dự án để tập sau dùng lại.
          </li>
          <li>
            <b className="text-ink">Phân cảnh</b>: khớp giọng từng từ, chia cảnh theo nghĩa, chỉnh từng cảnh.
          </li>
          <li>
            <b className="text-ink">Tinh chỉnh</b>: xem toàn tập, kéo điểm cắt trên timeline.
          </li>
          <li>
            <b className="text-ink">Xuất</b>: MP4 kèm phụ đề, hiệu ứng âm thanh, nhạc nền.
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
  const brains = useStore((s) => s.brains);
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const modelKey = `${draft.brainCli}Model` as "claudeModel" | "codexModel" | "agyModel";
  useEffect(() => {
    setModels([]);
    backend?.brainModels?.(draft.brainCli, draft).then((list) => {
      setModels(list);
      // chưa chọn model → chọn sẵn model mới nhất
      if (list.length) setDraft((d) => (d[`${d.brainCli}Model` as typeof modelKey] ? d : { ...d, [`${d.brainCli}Model`]: list[0].id }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.brainCli, backend]);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const testBrain = async () => {
    setTesting(true);
    setTestResult(null);
    await saveSettings(draft);
    const t0 = performance.now();
    try {
      const out = await backend!.brainRun!('Trả về JSON {"ok": true, "who": "<tên model của bạn>"}.', JSON.stringify({ type: "object", properties: { ok: { type: "boolean" }, who: { type: "string" } }, required: ["ok", "who"], additionalProperties: false }), draft);
      const v = JSON.parse(out);
      setTestResult({ ok: true, text: `OK: ${draft.brainCli} trả lời sau ${((performance.now() - t0) / 1000).toFixed(1)}s (${v.who})` });
    } catch (e) {
      setTestResult({ ok: false, text: String((e as Error)?.message ?? e).slice(0, 220) });
    }
    setTesting(false);
  };
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
        <h2 className="text-lg font-bold">Bộ não (CLI AI)</h2>
        <p className="text-[12px] text-mute">fxcine gọi CLI đã cài và đăng nhập trên máy bạn ở chế độ không tương tác — không cần API key trong app. Bộ não lập dàn nhân vật/bối cảnh, chia cảnh, vẽ module SVG và dịch.</p>
        <div className="grid grid-cols-3 gap-2">
          {(["claude", "codex", "agy"] as const).map((c) => (
            <button key={c} onClick={() => setDraft({ ...draft, brainCli: c })} className={`rounded-lg border p-3 text-left ${draft.brainCli === c ? "border-acc bg-acc/10" : "border-line"}`}>
              <div className="font-semibold">{c === "claude" ? "Claude Code" : c === "codex" ? "Codex" : "Antigravity (agy)"}</div>
              <div className={`mt-1 truncate font-mono text-[10.5px] ${brains?.[c] ? "text-ok" : "text-dim"}`}>{brains?.[c] ?? "chưa tìm thấy"}</div>
            </button>
          ))}
        </div>
        {field("claudePath", "Đường dẫn claude (bỏ trống = tự dò)", { placeholder: "~/.local/bin/claude" })}
        {field("codexPath", "Đường dẫn codex (bỏ trống = tự dò)", { placeholder: "/opt/homebrew/bin/codex" })}
        {field("agyPath", "Đường dẫn agy (bỏ trống = tự dò)", { placeholder: "~/.local/bin/agy" })}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Model của {draft.brainCli}</label>
            {models.length ? (
              <select className="field" value={draft[modelKey]} onChange={(e) => setDraft({ ...draft, [modelKey]: e.target.value })}>
                {!models.some((m) => m.id === draft[modelKey]) && <option value={draft[modelKey]}>{draft[modelKey] || "Mặc định của CLI"}</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <input className="field" placeholder="để trống = mặc định của CLI" value={draft[modelKey]} onChange={(e) => setDraft({ ...draft, [modelKey]: e.target.value })} />
            )}
          </div>
          {field("brainTimeout", "Giới hạn thời gian (giây)", { type: "number" })}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" disabled={testing || backend?.kind !== "tauri"} onClick={() => void testBrain()}>
            {testing ? "Đang thử…" : "Thử bộ não"}
          </button>
          {testResult && <span className={`text-xs ${testResult.ok ? "text-ok" : "text-bad"}`}>{testResult.text}</span>}
        </div>
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
