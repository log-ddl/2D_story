import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { episodeDuration } from "../../engine/render";
import { runQa } from "../../pipeline/qa";
import { retime } from "../../pipeline/segment";
import { clock } from "../clock";
import { useStore } from "../store";
import { actionStart } from "../../engine/actions";
import { BEAT_COLOR, BEAT_LABEL, VERB_LABEL } from "./labels";

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const PX_PER_CHAR = 6.4;

/**
 * Timeline (bước Tinh chỉnh): thước thời gian · khối cảnh · sóng âm · từng từ.
 * Kéo ranh giới giữa hai cảnh để dời điểm cắt — ranh giới "hít" vào đầu từ gần nhất.
 */
export function Timeline() {
  const episode = useStore((s) => s.episode);
  const audio = useStore((s) => s.audio);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const updateEpisode = useStore((s) => s.updateEpisode);
  const library = useStore((s) => s.library);
  const scroller = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const headLabel = useRef<HTMLSpanElement>(null);
  const [viewW, setViewW] = useState(1000);
  const [pxPerSec, setPxPerSec] = useState(60);
  const [drag, setDrag] = useState<{ k: number; word: number } | null>(null);
  const duration = episode ? Math.max(0.1, episodeDuration(episode)) : 1;
  const words = episode?.alignment?.words ?? [];
  const width = Math.max(viewW, duration * pxPerSec);
  const px = width / duration;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // sóng âm
  useEffect(() => {
    const c = wave.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(52 * dpr);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!audio) return;
    ctx.fillStyle = "rgba(255,122,26,0.55)";
    const cols = Math.floor(c.width / 3);
    for (let i = 0; i < cols; i++) {
      const t = (i / cols) * duration;
      const v = audio.peaks[Math.floor((t / audio.duration) * audio.peaks.length)] ?? 0;
      const bh = Math.max(1, v * c.height * 0.92);
      ctx.fillRect(i * 3, (c.height - bh) / 2, 2, bh);
    }
  }, [audio, duration, width]);

  // đầu phát + tự cuộn theo
  useEffect(() => {
    const upd = () => {
      const t = clock.now();
      if (head.current) head.current.style.left = `${t * px}px`;
      if (headLabel.current) headLabel.current.textContent = fmt(t);
      const sc = scroller.current;
      if (sc && clock.playing && (t * px > sc.scrollLeft + sc.clientWidth * 0.85 || t * px < sc.scrollLeft)) sc.scrollLeft = t * px - sc.clientWidth * 0.15;
    };
    upd();
    return clock.subscribe(upd);
  }, [px]);

  if (!episode) return null;

  const timeAt = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - r.left) / px));
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

  // vạch thước: chọn bước sao cho khoảng cách ≥ 70px
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * px >= 70) ?? 60;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(t);
  const sel = episode.scenes.find((s) => s.id === selected);
  const ROW = { ruler: 0, scenes: 20, wave: 56, words: 112 };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 select-none">
      <div className="flex items-center gap-3 text-[11.5px] text-mute">
        <span className="font-mono text-ink" ref={headLabel}>
          0:00.0
        </span>
        <span className="font-mono">/ {fmt(duration)}</span>
        <span>· {episode.scenes.length} cảnh</span>
        {!audio && <span className="text-warn">· chưa có giọng đọc — thời lượng đang ước lượng</span>}
        <div className="ml-auto flex items-center gap-2">
          <button className="btn !px-2 !py-0.5" onClick={() => setPxPerSec(Math.max(viewW / duration, pxPerSec / 1.5))}>
            <Minus className="h-3 w-3" />
          </button>
          <button className="btn !px-2 !py-0.5" onClick={() => setPxPerSec(viewW / duration)} title="Vừa khung">
            <Maximize2 className="h-3 w-3" />
          </button>
          <button className="btn !px-2 !py-0.5" onClick={() => setPxPerSec(Math.min(400, pxPerSec * 1.5))}>
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div ref={scroller} className="shrink-0 overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-panel2">
        <div ref={wrap} className="relative" style={{ width, height: 148 }} onPointerMove={onMove} onPointerUp={onUp} onPointerDown={(e) => !drag && clock.seek(timeAt(e.clientX))}>
          {/* thước */}
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 h-[148px] border-l border-line/60" style={{ left: t * px }}>
              <span className="ml-1 font-mono text-[10px] text-dim">{fmt(t)}</span>
            </div>
          ))}
          {/* cảnh */}
          {episode.scenes.map((s, k) => {
            const start = drag && drag.k === k ? (words[drag.word]?.start ?? s.start) : s.start;
            const end = drag && drag.k === k + 1 ? (words[drag.word]?.start ?? s.end) : s.end;
            const w = (end - start) * px;
            const label = w > 150 ? `${s.id} · ${BEAT_LABEL[s.beat]} · ${(end - start).toFixed(1)}s` : w > 70 ? `${s.id} · ${(end - start).toFixed(1)}s` : w > 34 ? s.id : "";
            return (
              <div
                key={s.id}
                className={`absolute h-8 cursor-pointer overflow-hidden rounded-[3px] border-r-2 border-panel2 px-1.5 text-[11px] leading-8 font-semibold whitespace-nowrap ${selected === s.id ? "ring-2 ring-white ring-inset" : ""}`}
                style={{ top: ROW.scenes, left: start * px, width: w, background: BEAT_COLOR[s.beat] + (selected === s.id ? "" : "c0"), color: "#16121a" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(s.id);
                  clock.seek(s.start + 0.01);
                }}
                title={`${s.id} · ${s.duration.toFixed(2)}s · ${s.narration}`}
              >
                {label}
              </div>
            );
          })}
          {/* mốc hành động */}
          {episode.scenes.flatMap((s) =>
            s.actions.map((a, i) => {
              const t = s.start + actionStart(a, s, words);
              return <div key={`${s.id}a${i}`} className="pointer-events-auto absolute z-[5] h-2.5 w-2.5 rotate-45 border border-panel2 bg-white" style={{ top: ROW.scenes + 26, left: t * px - 5 }} title={`${s.id} · ${a.target} · ${VERB_LABEL[a.verb]} · ${t.toFixed(2)}s`} />;
            }),
          )}
          {/* ranh giới kéo được */}
          {episode.scenes.slice(1).map((s, i) => {
            const k = i + 1;
            const t = drag && drag.k === k ? (words[drag.word]?.start ?? s.start) : s.start;
            return <div key={s.id} onPointerDown={onBoundaryDown(k)} className="absolute z-10 w-2.5 -translate-x-1 cursor-ew-resize rounded hover:bg-white/50" style={{ top: ROW.scenes, height: 32, left: t * px }} title="Kéo để dời điểm cắt" />;
          })}
          {/* sóng âm */}
          <canvas ref={wave} className="absolute left-0" style={{ top: ROW.wave, width, height: 52 }} />
          {!audio && (
            <div className="absolute left-3 text-[11px] text-dim" style={{ top: ROW.wave + 18 }}>
              Chưa có giọng đọc — nhập ở bước 1 để căn thời gian theo giọng thật
            </div>
          )}
          {episode.alignment?.silences.map(([a, b], i) => (
            <div key={`s${i}`} className="absolute h-1 rounded bg-blue/60" style={{ top: ROW.wave + 50, left: a * px, width: (b - a) * px }} title="Khoảng lặng" />
          ))}
          {/* từ: chỉ hiện chữ khi đủ chỗ, còn lại là vạch */}
          {words.map((w, i) => {
            const ww = Math.max(2, (w.end - w.start) * px);
            const fits = ww >= w.text.length * PX_PER_CHAR + 4;
            return (
              <div
                key={i}
                className={`absolute h-6 overflow-hidden border-l text-[10.5px] leading-6 whitespace-nowrap ${fits ? "border-mute/40 pl-1 text-mute" : "border-mute/25"}`}
                style={{ top: ROW.words, left: w.start * px, width: ww, opacity: w.conf < 0.35 ? 0.55 : 1 }}
                title={`${w.text} · ${w.start.toFixed(2)}–${w.end.toFixed(2)}s`}
              >
                {fits ? w.text : ""}
              </div>
            );
          })}
          <div ref={head} className="pointer-events-none absolute top-0 z-20 h-full w-px bg-white">
            <div className="absolute -top-0.5 -left-1 h-2 w-2 rotate-45 bg-white" />
          </div>
        </div>
      </div>
      {sel && (
        <div className="truncate text-[12px] text-mute">
          <b className="font-mono text-ink">{sel.id}</b> {sel.start.toFixed(2)}–{sel.end.toFixed(2)}s · “{sel.narration}”
        </div>
      )}
    </div>
  );
}
