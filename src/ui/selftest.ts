// Tự kiểm tra toàn bộ đường desktop khi mở app với FXCINE_SELFTEST=/tmp/out.mp4:
// giọng máy (say) → đọc audio → khớp giọng + chia cảnh → xuất MP4 qua ffmpeg → ghi log → thoát.
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store";

export async function maybeSelfTest() {
  const target = await invoke<string | null>("selftest_target").catch(() => null);
  if (!target) return;
  const log: string[] = [];
  const write = () => invoke("fs_write_text", { rel: "selftest.log", text: log.join("\n") });
  const t0 = performance.now();
  const step = (m: string) => log.push(`${((performance.now() - t0) / 1000).toFixed(2)}s ${m}`);
  try {
    const st = useStore.getState();
    step(`caps ${JSON.stringify(st.caps ?? (await st.backend!.capabilities(st.settings)))}`);
    await st.createProject("Selftest", true);
    step(`project ${useStore.getState().project?.id}`);
    await useStore.getState().sayVoice();
    const a = useStore.getState().audio;
    step(`say audio ${a?.duration.toFixed(2)}s rate=${a?.rate}`);
    await useStore.getState().analyze("rule");
    const ep = useStore.getState().episode!;
    step(`analyze ${ep.alignment?.method} words=${ep.alignment?.words.length} scenes=${ep.scenes.length} end=${ep.scenes.at(-1)?.end}`);
    const backend = useStore.getState().backend!;
    backend.pickSavePath = async () => target;
    backend.reveal = async () => {};
    await useStore.getState().exportVideo({ height: 1280, fps: 30, subtitles: true, sfx: true, crf: 20 });
    const jobs = useStore.getState().jobs;
    step(`export ${jobs[0]?.status} ${jobs[0]?.detail ?? ""}`);
    await useStore.getState().deleteProject(useStore.getState().project!.id);
    step("cleanup ok");
  } catch (e) {
    step(`ERROR ${(e as Error).message}`);
  }
  await write();
  await invoke("quit");
}
