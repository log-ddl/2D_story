import { useEffect, useRef, useState } from "react";
import { episodeDuration } from "../../engine/render";
import { retime } from "../../pipeline/segment";
import { runQa } from "../../pipeline/qa";
import { clock } from "../clock";
import { useStore } from "../store";
import { BEAT_COLOR } from "./labels";

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/**
 * Timeline: sóng âm + khối cảnh + từ. Kéo ranh giới giữa hai cảnh để dời điểm cắt —
 * ranh giới luôn "hít" vào ranh giới từ gần nhất, thời gian tính lại theo khoảng lặng.
 */
export function Timeline({ height = 132 }: { height?: number }) {
  const episode = useStore((s) => s.episode);
  const audio = useStore((s) => s.audio);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const updateEpisode = useStore((s) => s.updateEpisode);
  const library = useStore((s) => s.library);
  const wrap = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ k: number; word: number } | null>(null);
  const duration = episode ? Math.max(0.1, episodeDuration(episode)) : 1;
  const words = episode?.alignment?.words ?? [];

  // sóng âm
  useEffect(() => {
    const c = wave.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth * dpr;
    const h = c.clientHeight * dpr;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    if (!audio) return;
    ctx.fillStyle = "rgba(255,122,26,0.45)";
    const cols = Math.floor(w / 2);
    for (let i = 0; i < cols; i++) {
      const t = (i / cols) * duration;
      const idx = Math.floor((t / audio.duration) * audio.peaks.length);
      const v = audio.peaks[idx] ?? 0;
      const bh = Math.max(1, v * h * 0.9);
      ctx.fillRect(i * 2, (h - bh) / 2, 1.4, bh);
    }
  }, [audio, duration, zoom]);

  // đầu phát
  useEffect(() => {
    const upd = () => {
      if (head.current) head.current.style.left = `${(clock.now() / duration) * 100}%`;
    };
    upd();
    return clock.subscribe(upd);
  }, [duration]);

  if (!episode) return null;

  const timeAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };

  const nearestWord = (t: number, lo: number, hi: number) => {
    let best = lo;
    let bd = Infinity;
    for (let i = lo; i <= hi; i++) {
      const d = Math.abs(words[i].start - t);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  const onBoundaryDown = (k: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ k, word: episode.scenes[k].word_start });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const prev = episode.scenes[drag.k - 1];
    const cur = episode.scenes[drag.k];
    const w = nearestWord(timeAt(e.clientX), prev.word_start + 1, cur.word_end);
    if (w !== drag.word) setDrag({ ...drag, word: w });
  };
  const onUp = () => {
    if (!drag) return;
    const { k, word } = drag;
    setDrag(null);
    if (word === episode.scenes[k].word_start) return;
    updateEpisode((e) => {
      const scenes = e.scenes.map((s, i) => {
        if (i === k - 1) return { ...s, word_end: word - 1, narration: words.slice(s.word_start, word).map((x) => x.text).join(" ") };
        if (i === k) return { ...s, word_start: word, narration: words.slice(word, s.word_end + 1).map((x) => x.text).join(" ") };
        return s;
      });
      return runQa({ ...e, scenes: retime(scenes, e.alignment!, e.fps) }, library);
    });
  };

  return (
    <div className="flex flex-col gap-1 select-none">
      <div className="flex items-center justify-between text-[11px] text-mute">
        <span className="font-mono">
          {episode.scenes.length} cảnh · {fmt(duration)} · {episode.alignment ? `căn: ${episode.alignment.method}` : "chưa căn thời gian"}
        </span>
        <div className="flex items-center gap-2">
          <span>Thu phóng</span>
          <input type="range" min={1} max={6} step={0.5} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-24 accent-[var(--color-acc)]" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel2">
        <div ref={wrap} className="relative" style={{ width: `${zoom * 100}%`, height }} onPointerMove={onMove} onPointerUp={onUp} onPointerDown={(e) => !drag && clock.seek(timeAt(e.clientX))}>
          <canvas ref={wave} className="absolute inset-x-0 top-6 h-[52px] w-full" />
          {/* khối cảnh */}
          {episode.scenes.map((s, k) => {
            const start = drag && drag.k === k ? words[drag.word]?.start ?? s.start : s.start;
            const end = drag && drag.k === k + 1 ? words[drag.word]?.start ?? s.end : s.end;
            return (
              <div
                key={s.id}
                className={`absolute top-0 h-6 cursor-pointer overflow-hidden border-r border-bg px-1 text-[10px] leading-6 font-semibold ${selected === s.id ? "ring-2 ring-acc ring-inset" : ""}`}
                style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%`, background: BEAT_COLOR[s.beat] + (selected === s.id ? "" : "aa"), color: "#18141b" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(s.id);
                  clock.seek(s.start + 0.01);
                }}
                title={`${s.id} · ${s.duration.toFixed(2)}s · ${s.narration}`}
              >
                {s.id} · {s.duration.toFixed(1)}s
              </div>
            );
          })}
          {/* ranh giới kéo được */}
          {episode.scenes.slice(1).map((s, i) => {
            const k = i + 1;
            const t = drag && drag.k === k ? words[drag.word]?.start ?? s.start : s.start;
            return <div key={s.id} onPointerDown={onBoundaryDown(k)} className="absolute top-0 z-10 h-full w-2 -translate-x-1 cursor-ew-resize hover:bg-acc/40" style={{ left: `${(t / duration) * 100}%` }} title="Kéo để dời điểm cắt" />;
          })}
          {/* từ */}
          <div className="absolute inset-x-0 bottom-0 h-[38px]">
            {words.map((w, i) => (
              <div key={i} className="absolute top-1 truncate border-l border-line pl-0.5 text-[9.5px] text-mute" style={{ left: `${(w.start / duration) * 100}%`, width: `${(Math.max(0.05, w.end - w.start) / duration) * 100}%`, opacity: w.conf < 0.35 ? 0.5 : 1 }}>
                {w.text}
              </div>
            ))}
            {episode.alignment?.silences.map(([a, b], i) => (
              <div key={`s${i}`} className="absolute bottom-0 h-1 bg-blue/50" style={{ left: `${(a / duration) * 100}%`, width: `${((b - a) / duration) * 100}%` }} />
            ))}
          </div>
          <div ref={head} className="pointer-events-none absolute top-0 z-20 h-full w-px bg-white">
            <div className="absolute -top-0.5 -left-1 h-2 w-2 rotate-45 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
