// Tự kiểm tra toàn bộ đường desktop khi mở app với FXCINE_SELFTEST=/tmp/out.mp4:
// giọng máy (say) → đọc audio → khớp giọng + chia cảnh → xuất MP4 qua ffmpeg → ghi log → thoát.
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store";

export async function maybeSelfTest() {
  const raw = await invoke<string | null>("selftest_target").catch(() => null);
  if (!raw) return;
  // FXCINE_SELFTEST=/tmp/x.mp4+brain → chạy thêm bộ não qua CLI
  const withBrain = raw.includes("+brain");
  const perf = raw.includes("+perf");
  const target = raw.replace(/\+(brain|perf)/g, "");
  const log: string[] = [];
  const write = () => invoke("fs_write_text", { rel: "selftest.log", text: log.join("\n") });
  const t0 = performance.now();
  const step = (m: string) => log.push(`${((performance.now() - t0) / 1000).toFixed(2)}s ${m}`);
  try {
    const st = useStore.getState();
    step(`caps ${JSON.stringify(st.caps ?? (await st.backend!.capabilities(st.settings)))}`);
    await st.createProject("Selftest", true);
    step(`project ${useStore.getState().project?.id}`);
    if (withBrain) {
      const s0 = useStore.getState();
      step(`brains ${JSON.stringify(s0.brains)} cli=${s0.settings.brainCli}`);
      useStore.getState().updateEpisode((e) => ({ ...e, aspect: "16:9" }));
      await useStore.getState().proposeCast();
      const e1 = useStore.getState().episode!;
      step(`brain cast=${e1.cast.join(",")} sets=${e1.sets.join(",")} style=${e1.style.grade}/${e1.style.subtitle} job=${useStore.getState().jobs[0]?.status} ${useStore.getState().jobs[0]?.detail ?? ""}`);
    }
    if (perf) {
      // đo thời gian luồng chính bận sau khi chuyển bước (gồm vẽ canvas)
      // thời gian từ lúc đổi bước tới khi luồng chính rảnh (MessageChannel không bị kẹp như setTimeout)
      const yieldTask = () => new Promise<void>((r) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = () => r();
        ch.port2.postMessage(0);
      });
      const busy = async () => {
        const t0 = performance.now();
        await yieldTask();
        await yieldTask();
        const t1 = performance.now();
        await new Promise((r) => setTimeout(r, 600));
        return Math.round(t1 - t0);
      };
      await useStore.getState().analyze("rule");
      const res: string[] = [];
      for (const pg of ["script", "cast", "storyboard", "director", "render", "storyboard", "cast", "director", "script"] as const) {
        useStore.getState().setPage(pg);
        res.push(`${pg}=${await busy()}ms`);
      }
      step(`perf ${res.join(" ")} dpr=${devicePixelRatio}`);
      const st2 = useStore.getState();
      for (const cli of ["claude", "agy"] as const) {
        const list = (await st2.backend!.brainModels?.(cli, st2.settings)) ?? [];
        step(`models ${cli}: ${list.slice(0, 4).map((m) => m.id).join(", ")}${list.length > 4 ? "…" : ""}`);
      }
      step(`settings models claude=${useStore.getState().settings.claudeModel} agy=${useStore.getState().settings.agyModel}`);
      if (!target.endsWith(".mp4")) {
        await useStore.getState().deleteProject(useStore.getState().project!.id);
        await write();
        return void (await invoke("quit"));
      }
    }
    await useStore.getState().sayVoice();
    const a = useStore.getState().audio;
    step(`say audio ${a?.duration.toFixed(2)}s rate=${a?.rate}`);
    await useStore.getState().analyze("rule");
    const ep = useStore.getState().episode!;
    step(`analyze ${ep.alignment?.method} words=${ep.alignment?.words.length} scenes=${ep.scenes.length} end=${ep.scenes.at(-1)?.end}`);
    const backend = useStore.getState().backend!;
    backend.pickSavePath = async () => target;
    backend.reveal = async () => {};
    await useStore.getState().exportVideo({ short: 720, fps: 30, subtitles: true, sfx: true, crf: 20 });
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
