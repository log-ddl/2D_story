import { useCallback, useEffect, useState } from "react";
import { episodeDuration, sceneIndexAt } from "../../engine/render";
import { Inspector } from "../components/Inspector";
import { Stage } from "../components/Stage";
import { Timeline } from "../components/Timeline";
import { clock } from "../clock";
import { useStore } from "../store";

export function DirectorPage() {
  const episode = useStore((s) => s.episode);
  const select = useStore((s) => s.select);
  const [fps, setFps] = useState(0);
  const [safe, setSafe] = useState(false);
  const [playing, setPlaying] = useState(clock.playing);
  const [t, setT] = useState(clock.time);
  const onFps = useCallback((v: number) => setFps(v), []);

  useEffect(
    () =>
      clock.subscribe(() => {
        setPlaying(clock.playing);
        setT(clock.now());
        const ep = useStore.getState().episode;
        if (ep) {
          const i = sceneIndexAt(ep, clock.now());
          const id = ep.scenes[i]?.id;
          if (id && id !== useStore.getState().selected) select(id);
        }
      }),
    [select],
  );

  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const dur = episodeDuration(episode);
  const toggleSubs = () => useStore.getState().updateEpisode((e) => ({ ...e, subtitles: !e.subtitles }));

  return (
    <div className="grid h-full grid-cols-[1fr_420px] overflow-hidden">
      <div className="flex min-h-0 flex-col gap-3 p-4">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="h-full max-h-full" style={{ aspectRatio: "9/16" }}>
            <div className="overflow-hidden rounded-xl border border-line shadow-2xl shadow-black/50">
              <Stage live safeArea={safe} onFps={onFps} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-acc w-24 justify-center" onClick={() => clock.toggle()}>
            {playing ? "❚❚ Dừng" : "▶ Phát"}
          </button>
          <button className="btn" onClick={() => clock.seek(0)}>
            ⏮
          </button>
          <span className="font-mono text-[13px]">
            {t.toFixed(2)} / {dur.toFixed(2)}s
          </span>
          <label className="ml-4 flex items-center gap-1.5 text-xs text-mute">
            <input type="checkbox" checked={episode.subtitles} onChange={toggleSubs} /> Phụ đề
          </label>
          <label className="flex items-center gap-1.5 text-xs text-mute">
            <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Vùng an toàn Shorts
          </label>
          <span className={`ml-auto font-mono text-xs ${playing ? (fps >= 55 ? "text-ok" : fps >= 40 ? "text-warn" : "text-bad") : "text-dim"}`}>{playing ? `${fps.toFixed(0)} fps` : "— fps"}</span>
        </div>
        <Timeline height={128} />
      </div>
      <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel">
        <Inspector />
      </aside>
    </div>
  );
}
