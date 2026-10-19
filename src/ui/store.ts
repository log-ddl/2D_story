import { create } from "zustand";
import { getBackend, newId, DEFAULT_SETTINGS, type AppSettings, type Backend, type BrainTools, type Capabilities, type ProjectMeta } from "../backend";
import { applyCast, drawCharacterSvg, drawModuleSvg, proposeCast, scopedLibrary, segmentScenes, translateLines, type BrainRunner } from "../brain";
import { lintRig } from "../engine/character";
import { compileModule } from "../engine/svg";
import { outputSize } from "../engine/frame";
import { EXPRESSIONS, POSES } from "../engine/character";
import { Library } from "../engine/library";
import { episodeDuration, renderFrame } from "../engine/render";
import { subtitleChunks } from "../engine/text";
import { DEMO_CAST, DEMO_SCRIPT, DEMO_TITLE } from "../library/demo";
import { alignScriptToAsr, envelopeFromPcm, estimateAlignment, heuristicAlign, parseWhisperJson } from "../pipeline/align";
import { buildSfxTrack, buildSrt, encodeWav, waveformPeaks } from "../pipeline/audio";
import { runQa } from "../pipeline/qa";
import { retime, ruleSegment, scenesFromLlm, scriptWordCount } from "../pipeline/segment";
import { CharacterSpec, Episode, Project, type Scene } from "../schema";
import { clock } from "./clock";

export type Page = "overview" | "script" | "cast" | "storyboard" | "director" | "render" | "library" | "settings";

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
  brains: BrainTools | null;
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
  analyze(method: "rule" | "brain"): Promise<void>;
  proposeCast(): Promise<void>;
  cancelBrain(): Promise<void>;
  realign(): Promise<void>;
  translate(): Promise<void>;
  qa(): void;
  exportVideo(opts: { short: number; fps: number; subtitles: boolean; sfx: boolean; crf: number }): Promise<void>;
  exportSrt(): string;
  generateModule(prompt: string, kind?: "prop" | "headwear" | "hand"): Promise<void>;
  generateCharacter(description: string, existingId?: string): Promise<string | null>;
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

  /** Chạy một lượt bộ não qua CLI đang chọn */
  const runner = (): BrainRunner => {
    const { backend, settings } = get();
    if (!backend?.brainRun) throw new Error("Bộ não (CLI) chỉ có trên app desktop");
    return (prompt, schema) => backend.brainRun!(prompt, schema, settings);
  };
  const brainName = () => get().settings.brainCli;

  return {
    backend: null,
    settings: DEFAULT_SETTINGS,
    caps: null,
    brains: null,
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
      backend.brainDetect?.(settings).then((brains) => {
        set({ brains });
        // CLI đang chọn không có mà CLI khác có → tự chuyển
        const cur = get().settings;
        if (!brains[cur.brainCli]) {
          const alt = (["claude", "agy", "codex"] as const).find((c) => brains[c]);
          if (alt) void get().saveSettings({ ...cur, brainCli: alt });
        }
        // chọn sẵn model mới nhất cho CLI chưa đặt model (agy/codex liệt kê động)
        for (const cli of ["agy", "codex"] as const) {
          const key = `${cli}Model` as const;
          if (!brains[cli] || get().settings[key]) continue;
          backend.brainModels?.(cli, get().settings).then((list) => {
            if (list.length && !get().settings[key]) void get().saveSettings({ ...get().settings, [key]: list[0].id });
          }).catch(() => {});
        }
      }).catch(() => {});
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
      backend?.brainDetect?.(s).then((brains) => set({ brains }));
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
      const j = job(method === "brain" ? `Khớp giọng + chia cảnh (${brainName()})` : "Khớp giọng + chia cảnh (offline)");
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
        j.progress(0.3, `${alignment.words.length} từ · ${alignment.method}`);
        const scoped = scopedLibrary(library, episode);
        let scenes: Scene[];
        if (method === "brain") {
          try {
            j.progress(0.4, `${brainName()} đang chia cảnh… (có thể mất 1–3 phút)`);
            const res = scenesFromLlm(await segmentScenes(runner(), alignment.words, library, episode), alignment, episode.fps, scoped, Object.keys(POSES), Object.keys(EXPRESSIONS));
            scenes = res.scenes;
            if (res.warnings.length) get().toast("warn", res.warnings.slice(0, 3).join(" · "));
          } catch (e) {
            get().toast("warn", `Bộ não lỗi (${(e as Error).message}) — dùng chia cảnh offline`);
            scenes = ruleSegment(episode, alignment, scoped);
          }
        } else scenes = ruleSegment(episode, alignment, scoped);
        get().updateEpisode((e) => runQa({ ...e, alignment, scenes }, library));
        set({ selected: scenes[0]?.id ?? null });
        j.done(`${scenes.length} cảnh · ${episodeDuration(get().episode!).toFixed(1)}s`);
        get().toast("ok", `Đã chia ${scenes.length} cảnh khớp giọng đọc`);
      } catch (e) {
        j.fail(e);
      }
    },

    async proposeCast() {
      const { episode, project, library } = get();
      if (!episode || !project) return;
      if (!episode.script_text.trim()) return get().toast("warn", "Hãy nhập kịch bản trước");
      const j = job(`${brainName()} lập dàn nhân vật + bối cảnh`);
      try {
        j.progress(0.2, "Đang đọc kịch bản… (có thể mất 1–3 phút)");
        const proposal = await proposeCast(runner(), episode.script_text, library, episode.aspect, episode.brief);
        const r = applyCast(proposal, project, episode, library);
        get().updateProject(() => r.project);
        get().updateEpisode(() => r.episode);
        // nhân vật không dựng được bằng tham số (con vật, robot…) → bộ não vẽ SVG có khung xương
        for (const d of r.toDraw) {
          j.progress(0.8, `Vẽ nhân vật ${d.id}…`);
          await get().generateCharacter(d.visual, d.id);
        }
        j.done(`${r.episode.cast.length} nhân vật (${r.created.characters} mới) · ${r.episode.sets.length} bối cảnh (${r.created.settings} mới)`);
        get().toast("ok", `Đề xuất xong: ${r.episode.cast.length} nhân vật, ${r.episode.sets.length} bối cảnh — xem và chỉnh trước khi chia cảnh`);
      } catch (e) {
        j.fail(e);
      }
    },

    async cancelBrain() {
      await get().backend?.brainCancel?.();
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
        const vi = await translateLines(runner(), episode.scenes.map((s) => s.narration));
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

    async exportVideo(opts) {
      const { episode, library, audio, backend, project, settings } = get();
      if (!episode || !project || !backend) return;
      const duration = episodeDuration(episode);
      if (!duration) return get().toast("warn", "Tập chưa có cảnh");
      const [width, height] = outputSize(episode.aspect, opts.short);
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

    async generateCharacter(description, existingId) {
      const { project } = get();
      if (!project) return null;
      const j = job(`${brainName()} vẽ nhân vật: ${description.slice(0, 30)}`);
      try {
        j.progress(0.3, "Đang vẽ nhân vật có khung xương… (1–2 phút)");
        const check = (svg: string) => {
          try {
            return lintRig(compileModule("check", svg));
          } catch (e) {
            return [(e as Error).message];
          }
        };
        const r = await drawCharacterSvg(runner(), description, check);
        const ok = r.errors.length === 0;
        const modId = `${(existingId ?? r.id).replace(/[^a-z0-9_]/gi, "_").toLowerCase()}_rig`;
        const charId = existingId ?? r.id.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
        get().updateProject((p) => {
          const prev = p.characters.find((c) => c.id === charId);
          const spec = CharacterSpec.parse({ ...(prev ?? {}), id: charId, name: prev?.name ?? r.name, aliases: [...new Set([...(prev?.aliases ?? []), ...r.aliases.map((a) => a.toLowerCase())])], kind: "svg", rig: modId });
          return {
            ...p,
            modules: [...p.modules.filter((m) => m.id !== modId), { id: modId, svg: r.svg, tags: ["rig", charId], status: ok ? "approved" : "draft", kind: "rig" }],
            characters: [...p.characters.filter((c) => c.id !== charId), spec],
          };
        });
        j.done(ok ? "Khung xương hợp lệ" : `Còn lỗi: ${r.errors.slice(0, 2).join("; ")}`);
        get().toast(ok ? "ok" : "warn", ok ? `Đã vẽ nhân vật ${charId}` : `Nhân vật ${charId} còn lỗi khung xương — xem ở Thư viện › Module`);
        return charId;
      } catch (e) {
        j.fail(e);
        return null;
      }
    },

    async generateModule(prompt, kind = "prop") {
      const { project } = get();
      if (!project) return;
      const j = job(`${brainName()} vẽ module: ${prompt.slice(0, 30)}`);
      try {
        j.progress(0.3, "Đang vẽ…");
        const r = await drawModuleSvg(runner(), prompt, kind);
        const id = project.modules.some((m) => m.id === r.id) ? `${r.id}_${Date.now().toString(36).slice(-3)}` : r.id;
        get().updateProject((p) => ({ ...p, modules: [...p.modules, { id, svg: r.svg, tags: r.tags, status: "draft", kind }] }));
        j.done(r.errors.length ? `${r.errors.length} lỗi linter` : "Sạch lỗi");
        get().toast(r.errors.length ? "warn" : "ok", r.errors.length ? `Module ${id} còn lỗi — xem trước khi duyệt` : `Đã vẽ module ${id} — chờ duyệt`);
      } catch (e) {
        j.fail(e);
      }
    },
  };
});

// Cho phép soi state khi phát triển (console: __fx.getState())
if (import.meta.env?.DEV && typeof window !== "undefined") (window as unknown as { __fx: typeof useStore }).__fx = useStore;
