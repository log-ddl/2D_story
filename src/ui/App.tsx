import { memo, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { AudioWaveform, Check, House, Languages, LibraryBig, Play, Settings, ShieldCheck, X } from "lucide-react";
import { episodeDuration } from "../engine/render";
import { clock } from "./clock";
import { DirectorPage } from "./pages/DirectorPage";
import { CastPage } from "./pages/CastPage";
import { LibraryPage } from "./pages/LibraryPage";
import { OverviewPage, SettingsPage } from "./pages/OtherPages";
import { RenderPage } from "./pages/RenderPage";
import { ScriptPage } from "./pages/ScriptPage";
import { StoryboardPage } from "./pages/StoryboardPage";
import { maybeSelfTest } from "./selftest";
import { useStore, type Page } from "./store";

const PIPELINE: [Page, string, string][] = [
  ["script", "01", "Kịch bản"],
  ["cast", "02", "Nhân vật & Bối cảnh"],
  ["storyboard", "03", "Phân cảnh"],
  ["director", "04", "Tinh chỉnh"],
  ["render", "05", "Xuất"],
];

const TITLES: Record<Page, string> = {
  overview: "Tổng quan",
  script: "Kịch bản & giọng đọc",
  cast: "Nhân vật, bối cảnh & phong cách",
  storyboard: "Phân cảnh",
  director: "Tinh chỉnh",
  render: "Xuất video",
  library: "Thư viện tài nguyên",
  settings: "Cài đặt",
};

function Sidebar() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const episode = useStore((s) => s.episode);
  const caps = useStore((s) => s.caps);
  const backend = useStore((s) => s.backend);
  const saving = useStore((s) => s.saving);
  const brains = useStore((s) => s.brains);
  const settings = useStore((s) => s.settings);
  const jobs = useStore((s) => s.jobs);
  const running = jobs.filter((j) => j.status === "running").length;
  const item = (p: Page, label: string, icon: ReactNode) => (
    <button key={p} onClick={() => setPage(p)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] ${page === p ? "bg-panel2 text-ink" : "text-mute hover:text-ink"}`}>
      <span className="flex w-4 justify-center opacity-80">{icon}</span>
      {label}
    </button>
  );
  return (
    <aside className="flex w-[232px] shrink-0 flex-col gap-3 border-r border-line bg-[#141216] p-3">
      <div className="flex items-center gap-2.5 px-1 py-1">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-acc text-lg font-black text-black">X</div>
        <div>
          <div className="text-[15px] leading-tight font-bold">fxcine</div>
          <div className="text-[10.5px] font-semibold tracking-wider text-acc">ANIM STUDIO</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {item("overview", "Tổng quan", <House className="h-4 w-4" />)}
      </nav>
      <div className="rounded-xl border border-acc/30 bg-gradient-to-b from-acc/10 to-transparent p-1.5">
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-acc">QUY TRÌNH SẢN XUẤT</div>
        {PIPELINE.map(([p, n, l]) => (
          <button key={p} onClick={() => setPage(p)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold tracking-wide ${page === p ? "bg-black/40 text-ink" : "text-ink/80 hover:text-ink"}`}>
            <span className="font-mono text-[11px] text-acc">{n}</span>
            {l.toUpperCase()}
            {p === "storyboard" && episode && <span className="ml-auto rounded bg-acc/20 px-1.5 font-mono text-[10.5px] text-acc">{episode.scenes.length}</span>}
            {p === "cast" && episode && episode.cast.length > 0 && <span className="ml-auto rounded bg-acc/20 px-1.5 font-mono text-[10.5px] text-acc">{episode.cast.length}·{episode.sets.length}</span>}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-line p-1.5">
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-mute">TÀI NGUYÊN &amp; HỆ THỐNG</div>
        {item("library", "Thư viện tài nguyên", <LibraryBig className="h-4 w-4" />)}
        {item("settings", "Cài đặt", <Settings className="h-4 w-4" />)}
      </div>
      <div className="mt-auto flex flex-col gap-2 text-[11.5px] text-mute">
        <div className="rounded-lg border border-line px-3 py-2">
          <span className={running ? "text-acc" : ""}><span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /></span> {running ? `${running} tác vụ đang chạy` : "Không có tác vụ nào đang chạy"}
        </div>
        <div className="rounded-lg border border-line px-3 py-2 leading-relaxed">
          <div>
            Engine <b className="font-mono text-ink">v0.2.0</b> · {backend?.kind === "tauri" ? "desktop" : "trình duyệt"}
          </div>
          <div className={brains?.[settings.brainCli] ? "text-ok" : "text-dim"}><span className="inline-flex items-center gap-1">bộ não: {settings.brainCli} {brains?.[settings.brainCli] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span></div>
          <div className={caps?.ffmpeg ? "text-ok" : "text-dim"}><span className="inline-flex items-center gap-1">ffmpeg {caps?.ffmpeg ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span></div>
          <div className="text-dim">{saving ? "Đang lưu…" : "Đã lưu"}</div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const page = useStore((s) => s.page);
  const project = useStore((s) => s.project);
  const episode = useStore((s) => s.episode);
  const st = useStore.getState();
  const brains = useStore((s) => s.brains);
  const backend = useStore((s) => s.backend);
  const settings = useStore((s) => s.settings);
  const dur = episode ? episodeDuration(episode) : 0;
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line px-5">
      <div className="min-w-0">
        <div className="truncate text-[11.5px] text-mute">
          {project?.name ?? "—"} · {episode ? `${episode.title} (${dur.toFixed(1)}s, khung ${episode.aspect})` : "chưa mở tập"}
        </div>
        <div className="text-[17px] font-bold">{TITLES[page]}</div>
      </div>
      {episode && (
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={st.qa} title="Rà lỗi từng cảnh: cảnh quá ngắn/dài, thiếu nhân vật hay bối cảnh, chữ quá dài, giọng đọc lệch kịch bản. Kết quả hiện ở bộ lọc “Có cảnh báo”.">
            <ShieldCheck className="h-3.5 w-3.5" /> Kiểm tra QA
          </button>
          {episode.scenes.length > 0 && (
            <button className="btn" onClick={() => void st.realign()} title="Căn lại thời lượng mọi cảnh theo giọng đọc hiện tại (dùng sau khi thay giọng đọc), giữ nguyên nội dung cảnh.">
              <AudioWaveform className="h-3.5 w-3.5" /> Khớp lại giọng
            </button>
          )}
          {backend?.kind === "tauri" && brains?.[settings.brainCli] && episode.scenes.length > 0 && (
            <button className="btn" onClick={() => void st.translate()} title="Bộ não dịch lời dẫn từng cảnh sang tiếng Việt (để bạn đọc hiểu khi chỉnh cảnh).">
              <Languages className="h-3.5 w-3.5" /> Dịch VI
            </button>
          )}
          <button
            className="btn-acc"
            title="Chuyển sang bước Tinh chỉnh và phát toàn tập từ đầu."
            onClick={() => {
              st.setPage("director");
              clock.seek(0);
              clock.play();
            }}
          >
            <Play className="h-3.5 w-3.5" /> Xem toàn tập
          </button>
        </div>
      )}
    </header>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[360px] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-lg border px-3 py-2 text-[12.5px] shadow-xl backdrop-blur ${t.kind === "error" ? "border-bad/40 bg-bad/15" : t.kind === "warn" ? "border-warn/40 bg-warn/15" : t.kind === "ok" ? "border-ok/40 bg-ok/15" : "border-line bg-panel/90"}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

interface Cmd {
  label: string;
  hint?: string;
  run: () => void;
}

function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const st = useStore.getState();
  const episode = useStore((s) => (s.paletteOpen ? s.episode : null));
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const cmds: Cmd[] = useMemo(() => {
    const go = (p: Page, l: string): Cmd => ({ label: `Đi tới: ${l}`, run: () => st.setPage(p) });
    const list: Cmd[] = [
      go("overview", "Tổng quan"),
      go("script", "01 Kịch bản"),
      go("cast", "02 Nhân vật & Bối cảnh"),
      go("storyboard", "03 Phân cảnh"),
      go("director", "04 Tinh chỉnh"),
      go("render", "05 Xuất"),
      go("library", "Thư viện"),
      go("settings", "Cài đặt"),
      { label: "Phát / dừng", hint: "Space", run: () => clock.toggle() },
      { label: "Bộ não: đề xuất nhân vật + bối cảnh", run: () => void st.proposeCast() },
      { label: "Bộ não: chia cảnh", run: () => void st.analyze("brain") },
      { label: "Chia cảnh nhanh (offline)", run: () => void st.analyze("rule") },
      { label: "Khớp lại thời gian theo giọng đọc", run: () => void st.realign() },
      { label: "Nhập file giọng đọc", run: () => void st.importVoice() },
      { label: "Kiểm tra QA", run: st.qa },
      { label: "Dịch lời dẫn sang tiếng Việt", run: () => void st.translate() },
      { label: "Xuất MP4 1080p", run: () => void st.exportVideo({ short: 1080, fps: 30, subtitles: useStore.getState().episode?.subtitles ?? true, sfx: true, crf: 18 }) },
      { label: "Hoàn tác", hint: "⌘Z", run: st.undo },
      { label: "Làm lại", hint: "⇧⌘Z", run: st.redo },
    ];
    for (const s of episode?.scenes ?? []) list.push({ label: `Cảnh ${s.id}: ${s.narration.slice(0, 50)}`, run: () => (st.select(s.id), clock.seek(s.start + 0.01), useStore.getState().page === "overview" && st.setPage("storyboard")) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode]);
  if (!open) return null;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = cmds.filter((c) => words.every((w) => c.label.toLowerCase().includes(w))).slice(0, 12);
  const close = () => {
    st.setPalette(false);
    setQ("");
    setIdx(0);
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-start justify-center bg-black/50 pt-[14vh]" onClick={close}>
      <div className="w-[560px] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="w-full border-b border-line bg-transparent px-4 py-3 text-[15px] outline-none"
          placeholder="Gõ lệnh hoặc tên cảnh…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setIdx((i) => Math.min(shown.length - 1, i + 1));
            else if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
            else if (e.key === "Enter" && shown[idx]) {
              shown[idx].run();
              close();
            } else if (e.key === "Escape") close();
          }}
        />
        <div className="max-h-[380px] overflow-y-auto py-1">
          {shown.map((c, i) => (
            <button
              key={c.label}
              className={`flex w-full items-center px-4 py-2 text-left text-[13px] ${i === idx ? "bg-acc/15 text-ink" : "text-mute"}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                c.run();
                close();
              }}
            >
              {c.label}
              {c.hint && <span className="ml-auto font-mono text-[11px] text-dim">{c.hint}</span>}
            </button>
          ))}
          {!shown.length && <div className="px-4 py-3 text-mute">Không có lệnh phù hợp</div>}
        </div>
      </div>
    </div>
  );
}

// memo: đổi trang chỉ ẩn/hiện, không render lại các trang khác
const PAGES: Record<Page, () => ReactElement> = {
  overview: memo(OverviewPage),
  script: memo(ScriptPage),
  cast: memo(CastPage),
  storyboard: memo(StoryboardPage),
  director: memo(DirectorPage),
  render: memo(RenderPage),
  library: memo(LibraryPage),
  settings: memo(SettingsPage),
} as unknown as Record<Page, () => ReactElement>;

/**
 * Giữ các trang đã mở trong DOM (ẩn đi) để chuyển bước tức thì — không dựng lại,
 * không vẽ lại canvas. Canvas trong trang ẩn tự bỏ qua việc vẽ.
 */
function KeepAlive({ page }: { page: Page }) {
  const [visited, setVisited] = useState<Page[]>([page]);
  useEffect(() => setVisited((v) => (v.includes(page) ? v : [...v, page])), [page]);
  return (
    <>
      {visited.map((p) => {
        const C = PAGES[p];
        return (
          <div key={p} className="h-full" style={{ display: p === page ? undefined : "none" }}>
            <C />
          </div>
        );
      })}
    </>
  );
}

export function App() {
  const page = useStore((s) => s.page);
  const init = useStore((s) => s.init);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init()
      .then(() => {
        setReady(true);
        if (useStore.getState().backend?.kind === "tauri") void maybeSelfTest();
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const typing = e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        st.setPalette(!st.paletteOpen);
        return;
      }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (e.key === " ") {
        e.preventDefault();
        clock.toggle();
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && st.episode) {
        const sc = st.episode.scenes;
        const i = sc.findIndex((s) => s.id === st.selected);
        const n = sc[Math.max(0, Math.min(sc.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))];
        if (n) {
          st.select(n.id);
          clock.seek(n.start + 0.01);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <div className="p-8 text-bad">Không khởi động được: {error}</div>;
  if (!ready) return <div className="grid h-full place-items-center text-mute">Đang mở fxcine…</div>;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="min-h-0 flex-1">
          <KeepAlive page={page} />
        </div>
      </main>
      <CommandPalette />
      <Toasts />
    </div>
  );
}
