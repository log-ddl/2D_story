// Backend chạy trong trình duyệt: dữ liệu lưu trong IndexedDB. Không có ffmpeg/say/whisper.

import { pickSettings, parseEpisode, parseProject, type Backend } from "./index";

const DB = "fxcine";
const STORE = "kv";

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const get = <T,>(k: string) => tx<T | undefined>("readonly", (s) => s.get(k) as IDBRequest<T | undefined>);
const put = (k: string, v: unknown) => tx("readwrite", (s) => s.put(v, k)).then(() => undefined);
const del = (k: string) => tx("readwrite", (s) => s.delete(k)).then(() => undefined);
const keys = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export function createWebBackend(): Backend {
  return {
    kind: "web",
    async listProjects() {
      const ks = (await keys()).map(String).filter((k) => /^project:[^:]+$/.test(k));
      const out = [];
      for (const k of ks) {
        const p = await get<{ id: string; name: string }>(k);
        if (p) out.push({ id: p.id, name: p.name });
      }
      return out;
    },
    async loadProject(id) {
      const p = await get(`project:${id}`);
      return p ? parseProject(p) : null;
    },
    saveProject: (p) => put(`project:${p.id}`, p),
    async deleteProject(id) {
      for (const k of (await keys()).map(String)) if (k === `project:${id}` || k.startsWith(`ep:${id}:`) || k.startsWith(`media:${id}:`)) await del(k);
    },
    async loadEpisode(pid, eid) {
      const e = await get(`ep:${pid}:${eid}`);
      return e ? parseEpisode(e) : null;
    },
    saveEpisode: (pid, ep) => put(`ep:${pid}:${ep.id}`, ep),
    putMedia: (pid, name, bytes) => put(`media:${pid}:${name}`, bytes),
    async getMedia(pid, name) {
      return (await get<Uint8Array>(`media:${pid}:${name}`)) ?? null;
    },
    importAudio(pid, prefix) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return resolve(null);
          const bytes = new Uint8Array(await f.arrayBuffer());
          const ext = f.name.split(".").pop() ?? "bin";
          const name = `${prefix}-${Date.now()}.${ext}`;
          await put(`media:${pid}:${name}`, bytes);
          const ctx = new AudioContext();
          const buf = await ctx.decodeAudioData(bytes.slice().buffer);
          resolve({ file: name, duration: buf.duration });
        };
        input.click();
      });
    },
    async loadSettings() {
      return pickSettings((await get<object>("settings")) ?? {});
    },
    saveSettings: (s) => put("settings", s),
    async capabilities() {
      return { ffmpeg: null, say: false, whisper: null, root: "IndexedDB (trình duyệt)" };
    },
  };
}
