import { create } from "zustand";
import { getBackend, newId, DEFAULT_SETTINGS, type AppSettings, type Backend, type Capabilities, type ProjectMeta } from "../backend";
import { llmSegment, llmSvg, llmTranslate, llmVisionQa } from "../backend/llm";
import { EXPRESSIONS, POSES } from "../engine/character";
import { Library } from "../engine/library";
import { episodeDuration, renderFrame, renderScene } from "../engine/render";
import { lintModule } from "../engine/svg";
import { subtitleChunks } from "../engine/text";
import { DEMO_CAST, DEMO_SCRIPT, DEMO_TITLE } from "../library/demo";
import { BUILTIN_MODULES } from "../library/modules";
import { alignScriptToAsr, envelopeFromPcm, estimateAlignment, heuristicAlign, parseWhisperJson } from "../pipeline/align";
import { buildSfxTrack, buildSrt, encodeWav, waveformPeaks } from "../pipeline/audio";
import { runQa } from "../pipeline/qa";
import { buildSegmentPrompt, LlmResult, retime, ruleSegment, scenesFromLlm, scriptWordCount } from "../pipeline/segment";
import { Episode, Project, type Scene } from "../schema";
import { clock } from "./clock";

export type Page = "overview" | "script" | "storyboard" | "director" | "render" | "library" | "settings";

export interface Job {
  id: string;
  label: string;
  progress: number;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface AudioState {
  url: string;
  pcm: Float32Array;
  rate: number;
  envelope: Float32Array;
  peaks: Float32Array;
  duration: number;
}

export interface Toast {
  id: number;
  kind: "ok" | "warn" | "error" | "info";
  text: string;
}

interface State {
  backend: Backend | null;
  settings: AppSettings;
  caps: Capabilities | null;
  projects: ProjectMeta[];
  project: Project | null;
  episode: Episode | null;
  library: Library;
  page: Page;
  selected: string | null;
  audio: AudioState | null;
  jobs: Job[];
  toasts: Toast[];
  history: Episode[];
  future: Episode[];
  paletteOpen: boolean;
  saving: boolean;

  init(): Promise<void>;
  setPage(p: Page): void;
  select(id: string | null): void;
  toast(kind: Toast["kind"], text: string): void;
  setPalette(open: boolean): void;
  saveSettings(s: AppSettings): Promise<void>;

  createProject(name: string, demo?: boolean): Promise<void>;
  openProject(id: string, episodeId?: string): Promise<void>;
  deleteProject(id: string): Promise<void>;
  newEpisode(title: string): Promise<void>;
  openEpisode(eid: string): Promise<void>;
  updateProject(fn: (p: Project) => Project): void;
  updateEpisode(fn: (e: Episode) => Episode, opts?: { history?: boolean }): void;
  updateScene(id: string, fn: (s: Scene) => Scene): void;
  undo(): void;
  redo(): void;

  importVoice(): Promise<void>;
  sayVoice(): Promise<void>;
  clearVoice(): void;
  importMusic(): Promise<void>;
  analyze(method: "rule" | "llm"): Promise<void>;
  realign(): Promise<void>;
  translate(): Promise<void>;
  qa(): void;
  visionQa(sceneId: string): Promise<void>;
  exportVideo(opts: { height: number; fps: number; subtitles: boolean; sfx: boolean; crf: number }): Promise<void>;
  exportSrt(): string;
  generateModule(prompt: string): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initOnce: Promise<void> | null = null;
let jobSeq = 0;
let toastSeq = 0;

export const useStore = create<State>((set, get) => {
  const job = (label: string) => {
    const id = `job${++jobSeq}`;
    set((s) => ({ jobs: [{ id, label, progress: 0, status: "running" as const }, ...s.jobs].slice(0, 12) }));
    return {
      progress: (p: number, detail?: string) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, progress: p, detail: detail ?? j.detail } : j)) })),
      done: (detail?: string) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, progress: 1, status: "done" as const, detail } : j)) })),
      fail: (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "error" as const, detail: msg } : j)) }));
        get().toast("error", `${label}: ${msg}`);
      },
    };
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { backend, project, episode } = get();
      if (!backend || !project) return;
      set({ saving: true });
      try {
        await backend.saveProject(project);
        if (episode) await backend.saveEpisode(project.id, { ...episode, updated_at: Date.now() });
      } catch (e) {
        get().toast("error", `Lưu thất bại: ${(e as Error).message}`);
      }
      set({ saving: false });
    }, 500);
  };

  const loadAudio = async (pid: string, file: string | undefined | null) => {
    const { backend, audio } = get();
    if (audio) URL.revokeObjectURL(audio.url);
    if (!backend || !file) {
      set({ audio: null });
      clock.setAudio(null);
      return null;
    }
    const bytes = await backend.getMedia(pid, file);
    if (!bytes) {
      set({ audio: null });
      clock.setAudio(null);
      return null;
    }
    const type = file.endsWith(".mp3") ? "audio/mpeg" : file.endsWith(".m4a") ? "audio/mp4" : "audio/wav";
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(bytes.slice().buffer);
    void ctx.close();
    const pcm = buf.getChannelData(0).slice();
    const st: AudioState = { url, pcm, rate: buf.sampleRate, envelope: envelopeFromPcm(pcm, buf.sampleRate), peaks: waveformPeaks(pcm, 4000), duration: buf.duration };
    set({ audio: st });
    clock.setAudio(url);
    return st;
  };

  const syncClock = () => {
    const ep = get().episode;
    clock.duration = ep ? episodeDuration(ep) : 0;
  };

  const settingsOk = () => {
    const s = get().settings;
    return { apiKey: s.anthropicKey, model: s.model };
  };

  return {
    backend: null,
    settings: DEFAULT_SETTINGS,
    caps: null,
    projects: [],
    project: null,
    episode: null,
    library: new Library(),
    page: "overview",
    selected: null,
    audio: null,
    jobs: [],
    toasts: [],
    history: [],
    future: [],
    paletteOpen: false,
    saving: false,

    init() {
      // StrictMode gọi effect 2 lần — chỉ khởi tạo một lần
      return (initOnce ??= (async () => {
      const backend = await getBackend();
      const settings = await backend.loadSettings();
      set({ backend, settings });
      backend.capabilities(settings).then((caps) => set({ caps })).catch(() => {});
      let projects = await backend.listProjects();
      if (!projects.length) {
        await get().createProject("Lịch sử La Mã", true);
        projects = await backend.listProjects();
        set({ projects });
        return;
      }
      set({ projects });
      const last = localStorage.getItem("fxcine:last");
      const [pid, eid] = (last ?? "").split("/");
      if (pid && projects.some((p) => p.id === pid)) await get().openProject(pid, eid);
      else await get().openProject(projects[0].id);
      })());
    },

    setPage: (page) => set({ page }),
    select: (selected) => set({ selected }),
    setPalette: (paletteOpen) => set({ paletteOpen }),
    toast(kind, text) {
      const id = ++toastSeq;
      set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 7000 : 3500);
    },
    async saveSettings(s) {
      const { backend } = get();
      set({ settings: s });
      await backend?.saveSettings(s);
      backend?.capabilities(s).then((caps) => set({ caps }));
    },

    async createProject(name, demo = false) {
      const { backend } = get();
      if (!backend) return;
      const pid = newId("p");
      const eid = newId("e");
      const ep = Episode.parse({ id: eid, title: demo ? DEMO_TITLE : "Tập 1", script_text: demo ? DEMO_SCRIPT : "", cast: demo ? DEMO_CAST : [] });
      const project = Project.parse({ id: pid, name, episodes: [{ id: eid, title: ep.title }] });
      if (demo) {
        // Tập mẫu: thời lượng ước lượng + chia cảnh bằng luật để có ngay thứ để xem
        const lib = new Library(project);
        ep.alignment = estimateAlignment(ep.script_text);
        ep.scenes = ruleSegment(ep, ep.alignment, lib);
        Object.assign(ep, runQa(ep, lib));
      }
      await backend.saveProject(project);
      await backend.saveEpisode(pid, ep);
      set({ projects: await backend.listProjects() });
      await get().openProject(pid, eid);
      set({ page: demo ? "storyboard" : "script" });
    },

    async openProject(id, episodeId) {
      const { backend } = get();
      if (!backend) return;
      const project = await backend.loadProject(id);
      if (!project) return;
      set({ project, library: new Library(project), episode: null, selected: null, history: [], future: [] });
      const eid = episodeId && project.episodes.some((e) => e.id === episodeId) ? episodeId : project.episodes[0]?.id;
      if (eid) await get().openEpisode(eid);
      else if (get().page === "overview") set({ page: "overview" });
    },

    async deleteProject(id) {
      const { backend, project } = get();
      if (!backend) return;
      await backend.deleteProject(id);
      if (project?.id === id) set({ project: null, episode: null, audio: null });
      set({ projects: await backend.listProjects() });
    },

    async newEpisode(title) {
      const { backend, project } = get();
      if (!backend || !project) return;
      const ep = Episode.parse({ id: newId("e"), title, script_text: "" });
      const p = { ...project, episodes: [...project.episodes, { id: ep.id, title }] };
      await backend.saveProject(p);
      await backend.saveEpisode(p.id, ep);
      set({ project: p });
      await get().openEpisode(ep.id);
      set({ page: "script" });
    },

    async openEpisode(eid) {
      const { backend, project } = get();
      if (!backend || !project) return;
      const episode = await backend.loadEpisode(project.id, eid);
      if (!episode) return;
      clock.pause();
      clock.seek(0);
      set({ episode, selected: episode.scenes[0]?.id ?? null, history: [], future: [] });
      localStorage.setItem("fxcine:last", `${project.id}/${eid}`);
      syncClock();
      const a = await loadAudio(project.id, episode.audio?.file).catch((e) => {
        get().toast("warn", `Không đọc được audio: ${(e as Error).message}`);
        return null;
      });
      // thời lượng thật lấy từ audio đã giải mã
      if (a && episode.audio && Math.abs(a.duration - episode.audio.duration) > 0.05) get().updateEpisode((e) => ({ ...e, audio: e.audio && { ...e.audio, duration: a.duration } }), { history: false });
    },

    updateProject(fn) {
      const p = get().project;
      if (!p) return;
      const next = fn(p);
      set({ project: next, library: new Library(next) });
      scheduleSave();
    },

    updateEpisode(fn, opts = {}) {
      const ep = get().episode;
      if (!ep) return;
      const next = fn(ep);
      set((s) => ({
        episode: next,
        history: opts.history === false ? s.history : [...s.history, ep].slice(-60),
        future: opts.history === false ? s.future : [],
        project: s.project && next.title !== ep.title ? { ...s.project, episodes: s.project.episodes.map((e) => (e.id === next.id ? { ...e, title: next.title } : e)) } : s.project,
      }));
      syncClock();
      scheduleSave();
    },

    updateScene(id, fn) {
      get().updateEpisode((e) => runQa({ ...e, scenes: e.scenes.map((s) => (s.id === id ? fn(s) : s)) }, get().library));
    },

    undo() {
      const { history, episode } = get();
      const prev = history[history.length - 1];
      if (!prev || !episode) return;
      set((s) => ({ episode: prev, history: s.history.slice(0, -1), future: [episode, ...s.future] }));
      syncClock();
      scheduleSave();
    },
    redo() {
      const { future, episode } = get();
      const next = future[0];
      if (!next || !episode) return;
      set((s) => ({ episode: next, future: s.future.slice(1), history: [...s.history, episode] }));
      syncClock();
      scheduleSave();
    },

    async importVoice() {
      const { backend, project, settings } = get();
      if (!backend || !project) return;
      const j = job("Nhập giọng đọc");
      try {
        const info = await backend.importAudio(project.id, "voice", settings);
        if (!info) return j.done("Đã hủy");
        get().updateEpisode((e) => ({ ...e, audio: { file: info.file, source: "upload", duration: info.duration } }));
        await loadAudio(project.id, info.file);
        j.done(`${info.duration.toFixed(1)}s`);
        get().toast("ok", "Đã nhập giọng đọc — bấm “Phân tích” để khớp và chia cảnh");
      } catch (e) {
        j.fail(e);
      }
    },

    async sayVoice() {
      const { backend, project, settings, episode } = get();
      if (!backend?.say || !project || !episode) return get().toast("warn", "Giọng đọc offline (say) chỉ có trên app desktop macOS");
      if (!episode.script_text.trim()) return get().toast("warn", "Chưa có kịch bản");
      const j = job("Tạo giọng đọc (macOS say)");
      try {
        const info = await backend.say(project.id, episode.script_text, settings);
        get().updateEpisode((e) => ({ ...e, audio: { file: info.file, source: "say", duration: info.duration } }));
        await loadAudio(project.id, info.file);
        j.done(`${info.duration.toFixed(1)}s`);
      } catch (e) {
        j.fail(e);
      }
    },

    clearVoice() {
      get().updateEpisode((e) => ({ ...e, audio: null }));
      void loadAudio("", null);
    },

    async importMusic() {
      const { backend, project, settings } = get();
      if (!backend || !project) return;
      const info = await backend.importAudio(project.id, "music", settings);
      if (info) get().updateEpisode((e) => ({ ...e, music: { file: info.file, volume: e.music?.volume ?? 0.25 } }));
    },

    async analyze(method) {
      const { episode, library, audio, backend, project, settings } = get();
      if (!episode || !project) return;
      if (!episode.script_text.trim()) return get().toast("warn", "Hãy nhập kịch bản trước");
      const j = job(method === "llm" ? "Khớp giọng + chia cảnh (Claude)" : "Khớp giọng + chia cảnh (offline)");
      try {
        j.progress(0.1, "Căn thời gian từng từ…");
        let alignment;
        if (audio && backend?.whisper && settings.whisperModel && get().caps?.whisper && episode.audio) {
          try {
            const json = await backend.whisper(project.id, episode.audio.file, settings);
            alignment = alignScriptToAsr(episode.script_text, parseWhisperJson(json), audio.duration);
          } catch (e) {
            get().toast("warn", `whisper lỗi, dùng heuristic: ${(e as Error).message}`);
          }
        }
        if (!alignment) alignment = audio ? heuristicAlign(episode.script_text, audio.envelope, audio.duration) : estimateAlignment(episode.script_text);
        j.progress(0.35, `${alignment.words.length} từ · ${alignment.method}`);
        let scenes: Scene[];
        if (method === "llm") {
          const { system, user } = buildSegmentPrompt(alignment.words, library, Object.keys(POSES), Object.keys(EXPRESSIONS));
          try {
            const raw = await llmSegment(settingsOk(), system, user, (n) => j.progress(Math.min(0.9, 0.35 + n / 40000), `Claude đang viết… ${n} ký tự`));
            const res = scenesFromLlm(LlmResult.parse(raw), alignment, episode.fps, library, Object.keys(POSES), Object.keys(EXPRESSIONS));
            scenes = res.scenes;
            if (res.warnings.length) get().toast("warn", res.warnings.slice(0, 3).join(" · "));
          } catch (e) {
            get().toast("warn", `Claude lỗi (${(e as Error).message}) — dùng chia cảnh offline`);
            scenes = ruleSegment(episode, alignment, library);
          }
        } else scenes = ruleSegment(episode, alignment, library);
        get().updateEpisode((e) => runQa({ ...e, alignment, scenes }, library));
        set({ selected: scenes[0]?.id ?? null });
        j.done(`${scenes.length} cảnh · ${episodeDuration(get().episode!).toFixed(1)}s`);
        get().toast("ok", `Đã chia ${scenes.length} cảnh khớp giọng đọc`);
      } catch (e) {
        j.fail(e);
      }
    },

    async realign() {
      const { episode, audio, library } = get();
      if (!episode) return;
      if (!episode.scenes.length) return get().analyze("rule");
      if (episode.alignment && scriptWordCount(episode.script_text) !== episode.alignment.words.length) {
        get().toast("warn", "Kịch bản đã đổi số từ — hãy chạy lại Phân tích");
        return;
      }
      const alignment = audio ? heuristicAlign(episode.script_text, audio.envelope, audio.duration) : estimateAlignment(episode.script_text);
      get().updateEpisode((e) => runQa({ ...e, alignment, scenes: retime(e.scenes, alignment, e.fps) }, library));
      get().toast("ok", audio ? "Đã khớp lại thời gian theo giọng đọc" : "Chưa có giọng đọc — dùng thời lượng ước lượng");
    },

    async translate() {
      const { episode } = get();
      if (!episode?.scenes.length) return;
      const j = job("Dịch lời dẫn sang tiếng Việt");
      try {
        const vi = await llmTranslate(settingsOk(), episode.scenes.map((s) => s.narration));
        get().updateEpisode((e) => ({ ...e, scenes: e.scenes.map((s, i) => ({ ...s, narration_vi: vi[i] ?? s.narration_vi })) }));
        j.done();
      } catch (e) {
        j.fail(e);
      }
    },

    qa() {
      const { episode, library } = get();
      if (!episode) return;
      const next = runQa(episode, library);
      get().updateEpisode(() => next);
      const n = next.scenes.filter((s) => s.status === "warning").length;
      get().toast(n ? "warn" : "ok", n ? `${n} cảnh có cảnh báo` : "Tất cả cảnh đều ổn");
    },

    async visionQa(sceneId) {
      const { episode, library, audio } = get();
      const scene = episode?.scenes.find((s) => s.id === sceneId);
      if (!episode || !scene) return;
      const j = job(`Claude soi khung hình ${scene.id}`);
      try {
        const c = document.createElement("canvas");
        c.width = 540;
        c.height = 960;
        renderScene(c.getContext("2d")!, { library, episode, envelope: audio?.envelope }, scene, scene.duration * 0.6, { width: 540, height: 960, subtitles: true });
        const b64 = c.toDataURL("image/png").split(",")[1];
        const r = await llmVisionQa(settingsOk(), b64, scene.description, scene.narration);
        get().updateScene(sceneId, (s) => ({
          ...s,
          qa_issues: [...s.qa_issues.filter((q) => !q.message.startsWith("Claude:")), ...r.issues.map((m) => ({ level: "warn" as const, message: `Claude: ${m}` }))],
          status: r.ok ? s.status : "warning",
        }));
        j.done(r.ok ? "Ổn" : `${r.issues.length} vấn đề`);
      } catch (e) {
        j.fail(e);
      }
    },

    async exportVideo(opts) {
      const { episode, library, audio, backend, project, settings } = get();
      if (!episode || !project || !backend) return;
      const duration = episodeDuration(episode);
      if (!duration) return get().toast("warn", "Tập chưa có cảnh");
      const height = opts.height;
      const width = Math.round((height * 9) / 16 / 2) * 2;
      const env = { library, episode, envelope: audio?.envelope, createCanvas: (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h }) };
      const canvas = Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const total = Math.ceil(duration * opts.fps);
      clock.pause();

      if (backend.kind === "tauri" && backend.exportBegin) {
        const out = await backend.pickSavePath!(`${episode.title.replace(/[^\p{L}\p{N} _-]/gu, "")}.mp4`);
        if (!out) return;
        const j = job(`Xuất MP4 ${width}×${height} @${opts.fps}`);
        const started = performance.now();
        try {
          let sfx: string | null = null;
          if (opts.sfx) {
            sfx = "sfx-export.wav";
            await backend.putMedia(project.id, sfx, encodeWav(buildSfxTrack(episode, duration)));
          }
          await backend.exportBegin({ project: project.id, width, height, fps: opts.fps, duration, out, voice: episode.audio?.file ?? null, sfx, music: episode.music?.file ?? null, music_volume: episode.music?.volume ?? 0.25, crf: opts.crf }, settings);
          for (let f = 0; f < total; f++) {
            renderFrame(ctx, env, f / opts.fps, { width, height, subtitles: opts.subtitles });
            const data = ctx.getImageData(0, 0, width, height).data;
            await backend.exportFrame!(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            if (f % 10 === 0) {
              const el = (performance.now() - started) / 1000;
              const eta = (el / (f + 1)) * (total - f - 1);
              j.progress(f / total, `${f}/${total} frame · còn ~${Math.ceil(eta)}s`);
              await new Promise((r) => setTimeout(r, 0));
            }
          }
          const path = await backend.exportEnd!();
          const secs = ((performance.now() - started) / 1000).toFixed(1);
          j.done(`${path} · ${secs}s`);
          get().toast("ok", `Đã xuất video (${secs}s)`);
          void backend.reveal?.(path);
        } catch (e) {
          await backend.exportCancel?.();
          j.fail(e);
        }
        return;
      }

      // Trình duyệt: ghi WebM realtime bằng MediaRecorder (bản xem thử)
      const j = job(`Ghi WebM realtime ${width}×${height}`);
      try {
        const stream = canvas.captureStream(opts.fps);
        let audioEl: HTMLAudioElement | null = null;
        if (audio) {
          audioEl = new Audio(audio.url);
          const actx = new AudioContext();
          const src = actx.createMediaElementSource(audioEl);
          const dest = actx.createMediaStreamDestination();
          src.connect(dest);
          dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        }
        const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        const done = new Promise<void>((r) => (rec.onstop = () => r()));
        rec.start(250);
        const t0 = performance.now();
        void audioEl?.play();
        await new Promise<void>((resolve) => {
          const step = () => {
            const t = (performance.now() - t0) / 1000;
            if (t >= duration) return resolve();
            renderFrame(ctx, env, t, { width, height, subtitles: opts.subtitles });
            j.progress(t / duration);
            requestAnimationFrame(step);
          };
          step();
        });
        rec.stop();
        audioEl?.pause();
        await done;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
        a.download = `${episode.title}.webm`;
        a.click();
        j.done();
      } catch (e) {
        j.fail(e);
      }
    },

    exportSrt() {
      const ep = get().episode;
      if (!ep?.alignment) return "";
      return buildSrt(ep, subtitleChunks(ep.alignment.words, 0, ep.alignment.words.length - 1));
    },

    async generateModule(prompt) {
      const { project } = get();
      if (!project) return;
      const j = job(`AI vẽ module: ${prompt.slice(0, 30)}`);
      const examples = BUILTIN_MODULES.filter((m) => ["coin_pile", "tent", "amphora", "chest"].includes(m.id))
        .map((m) => `<!-- ${m.id} -->\n${m.svg}`)
        .join("\n\n");
      const system = `Bạn là họa sĩ vector vẽ module SVG cho thư viện hoạt hình chibi.
QUY ƯỚC BẮT BUỘC:
- Chỉ dùng <svg>, <g>, <path>, <rect>, <circle>, <ellipse>, <polygon>, <polyline>, <line>. Không <text>, <image>, gradient, filter, script.
- Viền ngoài stroke="#2b2233", stroke-width 5–7, stroke-linejoin="round". Màu phẳng, tươi, 3–6 màu.
- viewBox quanh vật thể, gốc đặt ở đáy giữa (vật đứng trên mặt đất) hoặc khai báo data-anchor="x y".
- Kích thước cỡ 150–600 đơn vị; ít hơn 120 phần tử; hình khối tròn trịa, dễ thương.
- id: snake_case tiếng Anh. tags: 3–6 từ khóa (Anh + Việt).
Trả về JSON {id, tags, svg, notes}.`;
      let user = `Vẽ: ${prompt}\n\nVí dụ module đúng style:\n${examples}`;
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await llmSvg(settingsOk(), system, user, (n) => j.progress(Math.min(0.9, n / 6000), `${n} ký tự`));
          const issues = lintModule(r.svg);
          const errors = issues.filter((i) => i.level === "error");
          if (errors.length && attempt === 0) {
            user += `\n\nBản trước lỗi: ${errors.map((e) => e.message).join("; ")}. Sửa lại.`;
            continue;
          }
          const id = project.modules.some((m) => m.id === r.id) ? `${r.id}_${Date.now().toString(36).slice(-3)}` : r.id;
          get().updateProject((p) => ({ ...p, modules: [...p.modules, { id, svg: r.svg, tags: r.tags, status: "draft" }] }));
          j.done(issues.length ? `${issues.length} lưu ý style` : "Sạch lỗi");
          get().toast(errors.length ? "warn" : "ok", errors.length ? `Module ${id} còn lỗi — xem trước khi duyệt` : `Đã vẽ module ${id} — chờ duyệt`);
          return;
        }
      } catch (e) {
        j.fail(e);
      }
    },
  };
});

// Cho phép soi state khi phát triển (console: __fx.getState())
if (import.meta.env?.DEV && typeof window !== "undefined") (window as unknown as { __fx: typeof useStore }).__fx = useStore;
