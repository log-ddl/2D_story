import { useCallback, useEffect, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";
import { ASPECTS, type Aspect } from "../../engine/frame";
import { episodeDuration, sceneIndexAt } from "../../engine/render";
import { FitBox } from "../components/FitBox";
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
  const [aw, ah] = ASPECTS[episode.aspect as Aspect];
  const toggleSubs = () => useStore.getState().updateEpisode((e) => ({ ...e, subtitles: !e.subtitles }));

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-col gap-3 p-4">
        <FitBox ratio={aw / ah}>
          <div className="overflow-hidden rounded-xl border border-line shadow-2xl shadow-black/50">
            <Stage live safeArea={safe} onFps={onFps} />
          </div>
        </FitBox>
        <div className="flex items-center gap-3">
          <button className="btn-acc w-24 justify-center" onClick={() => clock.toggle()}>
            {playing ? <><Pause className="h-3.5 w-3.5" /> Dừng</> : <><Play className="h-3.5 w-3.5" /> Phát</>}
          </button>
          <button className="btn" onClick={() => clock.seek(0)}>
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[13px]">
            {t.toFixed(2)} / {dur.toFixed(2)}s
          </span>
          <label className="ml-4 flex items-center gap-1.5 text-xs text-mute">
            <input type="checkbox" checked={episode.subtitles} onChange={toggleSubs} /> Phụ đề
          </label>
          <label className="flex items-center gap-1.5 text-xs text-mute">
            <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Vùng an toàn
          </label>
          <span className={`ml-auto font-mono text-xs ${playing ? (fps >= 55 ? "text-ok" : fps >= 40 ? "text-warn" : "text-bad") : "text-dim"}`}>{playing ? `${fps.toFixed(0)} fps` : "— fps"}</span>
        </div>
        <Timeline />
      </div>
      <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel">
        <Inspector />
      </aside>
    </div>
  );
}
