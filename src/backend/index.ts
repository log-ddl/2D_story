// Lớp backend: Tauri (desktop, đầy đủ) hoặc Web (trình duyệt, để thử nhanh).

import { Episode, Project } from "../schema";

export interface AppSettings {
  anthropicKey: string;
  model: string;
  ffmpeg: string;
  whisperCli: string;
  whisperModel: string;
  sayVoice: string;
  sayRate: number;
  elevenKey: string;
  elevenVoice: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  anthropicKey: "",
  model: "claude-opus-5-5",
  ffmpeg: "",
  whisperCli: "",
  whisperModel: "",
  sayVoice: "Daniel",
  sayRate: 185,
  elevenKey: "",
  elevenVoice: "",
};

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
