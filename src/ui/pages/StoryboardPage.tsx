import { memo, useState } from "react";
import type { Scene } from "../../schema";
import { Inspector } from "../components/Inspector";
import { Stage } from "../components/Stage";
import { Timeline } from "../components/Timeline";
import { BEAT_COLOR, BEAT_LABEL } from "../components/labels";
import { useStore } from "../store";

const SceneCard = memo(function SceneCard({ scene, active, onClick }: { scene: Scene; active: boolean; onClick: () => void }) {
  const warn = scene.status === "warning";
  return (
    <div onClick={onClick} className={`card cursor-pointer overflow-hidden p-2 transition ${active ? "border-acc ring-1 ring-acc" : "hover:border-mute/50"}`}>
      <div className="relative overflow-hidden rounded-md">
        <Stage scene={scene} hoverPlay subtitles={false} />
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{scene.duration.toFixed(1)}s</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-mono text-[12px] font-bold">{scene.id}</span>
        <span className="chip" style={{ background: BEAT_COLOR[scene.beat] + "26", color: BEAT_COLOR[scene.beat] }}>
          {BEAT_LABEL[scene.beat]}
        </span>
        <span className={`chip ${warn ? "text-warn" : "text-ok"}`}>● {warn ? "Cảnh báo" : "Sẵn sàng"}</span>
        <span className="ml-auto flex gap-0.5">
          {scene.characters.slice(0, 4).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-mute/60" />
          ))}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">{scene.narration}</p>
    </div>
  );
});

export function StoryboardPage() {
  const episode = useStore((s) => s.episode);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const [filter, setFilter] = useState<"all" | "warn" | "nochar">("all");
  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const scenes = episode.scenes.filter((s) => (filter === "warn" ? s.status === "warning" : filter === "nochar" ? !s.characters.length : true));
  const warnCount = episode.scenes.filter((s) => s.status === "warning").length;

  return (
    <div className="grid h-full grid-cols-[1fr_420px] overflow-hidden">
      <div className="flex min-h-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-line bg-panel p-0.5">
            {(
              [
                ["all", `Tất cả ${episode.scenes.length}`],
                ["warn", `Có cảnh báo ${warnCount}`],
                ["nochar", "Không nhân vật"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={`rounded-md px-3 py-1 text-[12.5px] font-medium ${filter === k ? "bg-panel2 text-ink" : "text-mute hover:text-ink"}`} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-dim">Rê chuột lên thẻ để xem chuyển động · kéo ranh giới trên timeline để dời điểm cắt</span>
        </div>
        {episode.scenes.length === 0 ? (
          <div className="grid flex-1 place-items-center text-mute">Chưa có cảnh — vào bước 01 Kịch bản để phân tích.</div>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(168px,1fr))] content-start gap-3 overflow-y-auto pr-1">
            {scenes.map((s) => (
              <SceneCard key={s.id} scene={s} active={s.id === selected} onClick={() => select(s.id)} />
            ))}
          </div>
        )}
        <Timeline height={112} />
      </div>
      <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel">
        <Inspector />
      </aside>
    </div>
  );
}
