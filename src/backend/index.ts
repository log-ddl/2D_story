// Lớp backend: Tauri (desktop, đầy đủ) hoặc Web (trình duyệt, để thử nhanh).

import { Episode, Project } from "../schema";

export interface AppSettings {
  /** CLI dùng làm bộ não */
  brainCli: "claude" | "codex" | "agy";
  claudeModel: string;
  codexModel: string;
  agyModel: string;
  brainTimeout: number;
  claudePath: string;
  codexPath: string;
  agyPath: string;
  ffmpeg: string;
  whisperCli: string;
  whisperModel: string;
  sayVoice: string;
  sayRate: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  brainCli: "claude",
  claudeModel: "claude-opus-5-5",
  codexModel: "",
  agyModel: "",
  brainTimeout: 600,
  claudePath: "",
  codexPath: "",
  agyPath: "",
  ffmpeg: "",
  whisperCli: "",
  whisperModel: "",
  sayVoice: "Daniel",
  sayRate: 185,
};

/** Gộp với mặc định, bỏ khóa cũ không còn dùng */
export function pickSettings(raw: object | null): AppSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in r && typeof r[k] === typeof out[k]) out[k] = r[k];
  return out as unknown as AppSettings;
}

export interface BrainTools {
  claude: string | null;
  codex: string | null;
  agy: string | null;
}

export interface ProjectMeta {
  id: string;
  name: string;
}

export interface Capabilities {
  ffmpeg: string | null;
  say: boolean;
  whisper: string | null;
  root: string;
}

export interface MediaInfo {
  file: string;
  duration: number;
}

export interface ExportParams {
  project: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  out: string;
  voice: string | null;
  sfx: string | null;
  music: string | null;
  music_volume: number;
  crf: number;
}

export interface Backend {
  kind: "tauri" | "web";
  listProjects(): Promise<ProjectMeta[]>;
  loadProject(id: string): Promise<Project | null>;
  saveProject(p: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  loadEpisode(pid: string, eid: string): Promise<Episode | null>;
  saveEpisode(pid: string, ep: Episode): Promise<void>;
  putMedia(pid: string, name: string, bytes: Uint8Array): Promise<void>;
  getMedia(pid: string, name: string): Promise<Uint8Array | null>;
  /** Chọn file audio từ máy và chép vào dự án (WAV 48k khi có ffmpeg) */
  importAudio(pid: string, prefix: string, settings: AppSettings): Promise<MediaInfo | null>;
  loadSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;
  capabilities(s: AppSettings): Promise<Capabilities>;
  // Chỉ có trên Tauri
  say?(pid: string, text: string, s: AppSettings): Promise<MediaInfo>;
  sayVoices?(): Promise<string[]>;
  whisper?(pid: string, media: string, s: AppSettings): Promise<unknown>;
  pickSavePath?(defaultName: string): Promise<string | null>;
  exportBegin?(p: ExportParams, s: AppSettings): Promise<void>;
  exportFrame?(rgba: Uint8Array): Promise<number>;
  exportEnd?(): Promise<string>;
  exportCancel?(): Promise<void>;
  reveal?(path: string): Promise<void>;
  brainDetect?(s: AppSettings): Promise<BrainTools>;
  brainRun?(prompt: string, schema: string, s: AppSettings): Promise<string>;
  brainCancel?(): Promise<void>;
  brainModels?(cli: string, s: AppSettings): Promise<{ id: string; label: string }[]>;
}

export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let instance: Promise<Backend> | null = null;
export function getBackend(): Promise<Backend> {
  if (!instance) instance = isTauri() ? import("./tauri").then((m) => m.createTauriBackend()) : import("./web").then((m) => m.createWebBackend());
  return instance;
}

export const parseProject = (raw: unknown) => Project.parse(raw);
export const parseEpisode = (raw: unknown) => Episode.parse(raw);

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
