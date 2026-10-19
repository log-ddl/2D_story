import { memo, useState } from "react";
import { ArrowRight, Sparkles, Square, Zap } from "lucide-react";
import type { Scene } from "../../schema";
import { Inspector } from "../components/Inspector";
import { Stage } from "../components/Stage";
import { BEAT_COLOR, BEAT_LABEL } from "../components/labels";
import { useStore } from "../store";

const SceneCard = memo(function SceneCard({ scene, active, onClick }: { scene: Scene; active: boolean; onClick: () => void }) {
  const warn = scene.status === "warning";
  return (
    <div onClick={onClick} className={`card cursor-pointer overflow-hidden p-2 transition ${active ? "border-acc ring-1 ring-acc" : "hover:border-mute/50"}`}>
      <div className="relative overflow-hidden rounded-md">
        <Stage scene={scene} thumb subtitles={false} />
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{scene.duration.toFixed(1)}s</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="font-mono text-[12px] font-bold">{scene.id}</span>
        <span className="chip" style={{ background: BEAT_COLOR[scene.beat] + "26", color: BEAT_COLOR[scene.beat] }}>
          {BEAT_LABEL[scene.beat]}
        </span>
        {warn && <span className="chip inline-flex items-center gap-1 text-warn"><span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /> Cảnh báo</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">{scene.narration}</p>
    </div>
  );
});

export function StoryboardPage() {
  const episode = useStore((s) => s.episode);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const backend = useStore((s) => s.backend);
  const settings = useStore((s) => s.settings);
  const brains = useStore((s) => s.brains);
  const audio = useStore((s) => s.audio);
  const jobs = useStore((s) => s.jobs);
  const st = useStore.getState();
  const [filter, setFilter] = useState<"all" | "warn" | "nochar">("all");
  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;
  const scenes = episode.scenes.filter((s) => (filter === "warn" ? s.status === "warning" : filter === "nochar" ? !s.characters.length : true));
  const warnCount = episode.scenes.filter((s) => s.status === "warning").length;
  const cliOk = backend?.kind === "tauri" && !!brains?.[settings.brainCli];
  const running = jobs.some((j) => j.status === "running" && j.label.startsWith("Khớp giọng"));
  const grid = episode.aspect === "16:9" ? "minmax(250px,1fr)" : episode.aspect === "9:16" ? "minmax(160px,1fr)" : "minmax(200px,1fr)";

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
      <div className="flex min-h-0 flex-col gap-3 p-4">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <div className="mr-auto text-[12.5px] text-mute">
            {episode.alignment ? (
              <>
                {episode.scenes.length} cảnh · căn thời gian: <b className="text-ink">{episode.alignment.method === "estimate" ? "ước lượng (chưa có giọng)" : episode.alignment.method}</b>
                {episode.cast.length ? ` · ${episode.cast.length} nhân vật` : ""}
                {episode.sets.length ? ` · ${episode.sets.length} bối cảnh` : ""}
              </>
            ) : (
              "Chưa chia cảnh"
            )}
            {!audio && <span className="text-warn"> · chưa có giọng đọc</span>}
          </div>
          {running ? (
            <button className="btn text-bad" onClick={() => void st.cancelBrain()}>
              <Square className="h-3.5 w-3.5" /> Dừng
            </button>
          ) : (
            <>
              <button className="btn-acc" disabled={!cliOk || !episode.script_text.trim()} onClick={() => void st.analyze("brain")} title={cliOk ? "" : "Cần CLI bộ não (xem Cài đặt)"}>
                <Sparkles className="h-3.5 w-3.5" /> Chia cảnh bằng {settings.brainCli}
              </button>
              <button className="btn" disabled={!episode.script_text.trim()} onClick={() => void st.analyze("rule")}>
                <Zap className="h-3.5 w-3.5" /> Chia nhanh (offline)
              </button>
            </>
          )}
        </div>

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
          <span className="text-[12px] text-dim">Rê chuột lên thẻ để xem chuyển động</span>
          {episode.scenes.length > 0 && (
            <button className="btn ml-auto" onClick={() => st.setPage("director")}>
              Tiếp: Tinh chỉnh <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {episode.scenes.length === 0 ? (
          <div className="grid flex-1 place-items-center text-center text-mute">
            Chưa có cảnh — bấm “Chia cảnh” ở trên.
            <br />
            Bộ não dùng dàn nhân vật và bối cảnh của bước 2.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-3 overflow-y-auto pr-1" style={{ gridTemplateColumns: `repeat(auto-fill, ${grid})` }}>
            {scenes.map((s) => (
              <SceneCard key={s.id} scene={s} active={s.id === selected} onClick={() => select(s.id)} />
            ))}
          </div>
        )}
      </div>
      <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel">
        <Inspector />
      </aside>
    </div>
  );
}
