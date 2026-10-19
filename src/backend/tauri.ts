import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DEFAULT_SETTINGS, parseEpisode, parseProject, type AppSettings, type Backend, type Capabilities, type ExportParams, type MediaInfo } from "./index";

const P = (pid: string) => `projects/${pid}`;

export function createTauriBackend(): Backend {
  const readJson = async (rel: string) => {
    const t = await invoke<string | null>("fs_read_text", { rel });
    return t ? JSON.parse(t) : null;
  };
  const writeJson = (rel: string, v: unknown) => invoke("fs_write_text", { rel, text: JSON.stringify(v, null, 1) });

  return {
    kind: "tauri",
    async listProjects() {
      const ids = await invoke<string[]>("fs_list", { rel: "projects" });
      const out = [];
      for (const id of ids) {
        const p = await readJson(`${P(id)}/project.json`);
        if (p) out.push({ id: p.id, name: p.name });
      }
      return out;
    },
    async loadProject(id) {
      const p = await readJson(`${P(id)}/project.json`);
      return p ? parseProject(p) : null;
    },
    saveProject: (p) => writeJson(`${P(p.id)}/project.json`, p).then(() => undefined),
    deleteProject: (id) => invoke("fs_remove", { rel: P(id) }),
    async loadEpisode(pid, eid) {
      const e = await readJson(`${P(pid)}/episodes/${eid}.json`);
      return e ? parseEpisode(e) : null;
    },
    saveEpisode: (pid, ep) => writeJson(`${P(pid)}/episodes/${ep.id}.json`, ep).then(() => undefined),
    putMedia: (pid, name, bytes) => invoke("fs_write_bytes", bytes, { headers: { "x-rel": `${P(pid)}/media/${name}` } }),
    async getMedia(pid, name) {
      try {
        const buf = await invoke<ArrayBuffer>("fs_read_bytes", { rel: `${P(pid)}/media/${name}` });
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    },
    async importAudio(pid, prefix, s) {
      const src = await open({ multiple: false, filters: [{ name: "Âm thanh", extensions: ["wav", "mp3", "m4a", "aac", "aiff", "flac", "ogg"] }] });
      if (!src || Array.isArray(src)) return null;
      return invoke<MediaInfo>("import_audio", { project: pid, src, prefix, ffmpeg: s.ffmpeg });
    },
    async loadSettings() {
      return { ...DEFAULT_SETTINGS, ...((await readJson("settings.json")) ?? {}) };
    },
    saveSettings: (s: AppSettings) => writeJson("settings.json", s).then(() => undefined),
    capabilities: (s) => invoke<Capabilities>("capabilities", { ffmpeg: s.ffmpeg, whisper: s.whisperCli }),
    say: (pid, text, s) => invoke<MediaInfo>("say_tts", { project: pid, text, voice: s.sayVoice, rate: s.sayRate, ffmpeg: s.ffmpeg }),
    sayVoices: () => invoke<string[]>("list_say_voices"),
    whisper: async (pid, media, s) => JSON.parse(await invoke<string>("whisper", { project: pid, media, cli: s.whisperCli, model: s.whisperModel, ffmpeg: s.ffmpeg })),
    pickSavePath: (defaultName) => save({ defaultPath: defaultName, filters: [{ name: "Video MP4", extensions: ["mp4"] }] }),
    exportBegin: (p: ExportParams, s) => invoke("export_begin", { p: { ...p, ffmpeg: s.ffmpeg } }),
    exportFrame: (rgba) => invoke<number>("export_frame", rgba),
    exportEnd: () => invoke<string>("export_end"),
    exportCancel: () => invoke("export_cancel"),
    reveal: (path) => invoke("reveal", { path }),
  };
}
