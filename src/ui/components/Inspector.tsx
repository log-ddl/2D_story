import { useState } from "react";
import { ArrowLeftRight, Dices, Merge, Pause, Play, Scissors, Speech, X } from "lucide-react";
import { EXPRESSIONS, POSES } from "../../engine/character";
import { hash } from "../../engine/math";
import { runQa } from "../../pipeline/qa";
import { retime } from "../../pipeline/segment";
import { BEATS, LIGHTINGS, MOVES, OVERLAY_STYLES, SHOTS, TRANSITIONS, VERBS, WEATHERS, type Episode, type Scene } from "../../schema";
import { clock } from "../clock";
import { useStore } from "../store";
import { Stage } from "./Stage";
import { BEAT_COLOR, BEAT_LABEL, LIGHT_LABEL, MOVE_LABEL, OVERLAY_HINT, OVERLAY_LABEL, SHOT_LABEL, TRANSITION_LABEL, VERB_LABEL, WEATHER_LABEL } from "./labels";

function Sel<T extends string>({ value, options, onChange, labels }: { value: T; options: readonly T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

const renumber = (scenes: Scene[]) => scenes.map((s, i) => ({ ...s, id: `s${String(i + 1).padStart(3, "0")}` }));

export function splitScene(ep: Episode, id: string, t: number): Episode {
  const k = ep.scenes.findIndex((s) => s.id === id);
  const s = ep.scenes[k];
  const words = ep.alignment?.words ?? [];
  let w = s.word_start + 1;
  for (let i = s.word_start + 1; i <= s.word_end; i++) if (words[i].start <= t) w = i;
  if (w <= s.word_start || w > s.word_end) return ep;
  const txt = (a: number, b: number) => words.slice(a, b + 1).map((x) => x.text).join(" ");
  const a = { ...s, word_end: w - 1, narration: txt(s.word_start, w - 1), overlays: s.overlays.filter((o) => o.at_word == null || o.at_word < w) };
  const b = { ...s, word_start: w, narration: txt(w, s.word_end), narration_vi: "", overlays: s.overlays.filter((o) => o.at_word != null && o.at_word >= w), seed: hash(s.seed, "split") % 10000, transition: "cut" as const };
  const scenes = renumber([...ep.scenes.slice(0, k), a, b, ...ep.scenes.slice(k + 1)]);
  return { ...ep, scenes: retime(scenes, ep.alignment!, ep.fps) };
}

export function mergeNext(ep: Episode, id: string): Episode {
  const k = ep.scenes.findIndex((s) => s.id === id);
  const a = ep.scenes[k];
  const b = ep.scenes[k + 1];
  if (!b) return ep;
  const merged = { ...a, word_end: b.word_end, narration: `${a.narration} ${b.narration}`, narration_vi: [a.narration_vi, b.narration_vi].filter(Boolean).join(" "), overlays: [...a.overlays, ...b.overlays] };
  const scenes = renumber([...ep.scenes.slice(0, k), merged, ...ep.scenes.slice(k + 2)]);
  return { ...ep, scenes: retime(scenes, ep.alignment!, ep.fps) };
}

export function Inspector() {
  const episode = useStore((s) => s.episode);
  const selected = useStore((s) => s.selected);
  const library = useStore((s) => s.library);
  const updateScene = useStore((s) => s.updateScene);
  const updateEpisode = useStore((s) => s.updateEpisode);
  const select = useStore((s) => s.select);
  const [playing, setPlaying] = useState(false);
  const scene = episode?.scenes.find((s) => s.id === selected);
  if (!episode || !scene) return <div className="p-6 text-mute">Chọn một cảnh để chỉnh</div>;
  const setting = library.getSetting(scene.background.setting);
  const words = episode.alignment?.words ?? [];
  const up = (fn: (s: Scene) => Scene) => updateScene(scene.id, fn);
  const marks = Object.keys(setting.marks);
  const characters = [...library.characters.values()];
  const modules = library.moduleDefs.filter((m) => m.kind === "prop" || m.kind === "scenery" || m.kind === "map" || m.kind === "hand");
  const sceneWords = words.slice(scene.word_start, scene.word_end + 1).map((w, i) => ({ i: scene.word_start + i, text: w.text }));
  // đích của hành động: nhân vật (romulus, romulus#2…) và đạo cụ (prop:module)
  const seen = new Map<string, number>();
  const targets: string[] = [];
  const targetLabels: Record<string, string> = {};
  for (const c of scene.characters) {
    const n = (seen.get(c.character) ?? 0) + 1;
    seen.set(c.character, n);
    const id = n === 1 ? c.character : `${c.character}#${n}`;
    targets.push(id);
    targetLabels[id] = `${library.getCharacter(c.character)?.name ?? c.character}${n > 1 ? ` (${n})` : ""}`;
  }
  for (const p of scene.props) {
    const id = `prop:${p.module}`;
    if (!targets.includes(id)) {
      targets.push(id);
      targetLabels[id] = `Đạo cụ: ${library.moduleDefs.find((m) => m.id === p.module)?.label ?? p.module}`;
    }
  }

  const togglePlay = () => {
    if (clock.playing) {
      clock.pause();
      setPlaying(false);
    } else {
      clock.seek(scene.start);
      clock.play([scene.start, scene.end]);
      setPlaying(true);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="relative overflow-hidden rounded-lg border border-line">
        <Stage scene={scene} live={playing} at={scene.duration * 0.55} safeArea={false} />
        <button className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur" onClick={togglePlay}>
          {playing ? <><Pause className="h-3 w-3" /> Dừng</> : <><Play className="h-3 w-3" /> Phát cảnh</>}
        </button>
        <span className="absolute top-2 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white">{scene.duration.toFixed(2)}s</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-base font-bold">{scene.id}</span>
        <select className="chip cursor-pointer border-0 outline-none" style={{ background: BEAT_COLOR[scene.beat] + "33", color: BEAT_COLOR[scene.beat] }} value={scene.beat} onChange={(e) => up((s) => ({ ...s, beat: e.target.value as Scene["beat"] }))}>
          {BEATS.map((b) => (
            <option key={b} value={b}>
              {BEAT_LABEL[b]}
            </option>
          ))}
        </select>
        <span className={`chip inline-flex items-center gap-1 ${scene.status === "warning" ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok"}`}><span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /> {scene.status === "warning" ? "Cảnh báo" : "Sẵn sàng"}</span>
        <span className="ml-auto font-mono text-[11px] text-mute">
          {scene.start.toFixed(2)}–{scene.end.toFixed(2)}s · seed {scene.seed}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <label className="label">Bối cảnh</label>
          <Sel value={scene.background.setting} options={[...library.settings.keys()]} labels={Object.fromEntries([...library.settings.values()].map((s) => [s.id, s.name]))} onChange={(v) => up((s) => ({ ...s, background: { ...s.background, setting: v } }))} />
        </div>
        <div>
          <label className="label">Thời tiết</label>
          <Sel value={scene.background.weather} options={WEATHERS} labels={WEATHER_LABEL} onChange={(v) => up((s) => ({ ...s, background: { ...s.background, weather: v } }))} />
        </div>
        <div>
          <label className="label">Camera</label>
          <Sel value={scene.camera.shot} options={SHOTS} labels={SHOT_LABEL} onChange={(v) => up((s) => ({ ...s, camera: { ...s.camera, shot: v } }))} />
        </div>
        <div>
          <label className="label">Chuyển động</label>
          <Sel value={scene.camera.move} options={MOVES} labels={MOVE_LABEL} onChange={(v) => up((s) => ({ ...s, camera: { ...s.camera, move: v } }))} />
        </div>
        <div>
          <label className="label">Ánh sáng</label>
          <Sel value={scene.background.lighting} options={LIGHTINGS} labels={LIGHT_LABEL} onChange={(v) => up((s) => ({ ...s, background: { ...s.background, lighting: v } }))} />
        </div>
        <div>
          <label className="label">Camera nhắm vào</label>
          <Sel value={scene.camera.focus} options={["auto", ...new Set(scene.characters.map((c) => c.character))]} labels={{ auto: "Tự động", ...Object.fromEntries(characters.map((c) => [c.id, c.name])) }} onChange={(v) => up((s) => ({ ...s, camera: { ...s.camera, focus: v } }))} />
        </div>
      </div>

      <div>
        <label className="label">Nhân vật (mark · tư thế · nét mặt)</label>
        <div className="flex flex-col gap-1.5">
          {scene.characters.map((c, i) => {
            const set = (patch: Partial<typeof c>) => up((s) => ({ ...s, characters: s.characters.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
            return (
              <div key={i} className="grid grid-cols-[1.4fr_0.6fr_1fr_1fr_auto] items-center gap-1">
                <Sel value={c.character} options={characters.map((x) => x.id)} labels={Object.fromEntries(characters.map((x) => [x.id, x.name]))} onChange={(v) => set({ character: v })} />
                <Sel value={c.mark} options={marks.includes(c.mark) ? marks : [c.mark, ...marks]} onChange={(v) => set({ mark: v })} />
                <Sel value={c.pose} options={Object.keys(POSES)} labels={Object.fromEntries(Object.entries(POSES).map(([k, v]) => [k, v.label]))} onChange={(v) => set({ pose: v })} />
                <Sel value={c.expression} options={Object.keys(EXPRESSIONS)} labels={Object.fromEntries(Object.entries(EXPRESSIONS).map(([k, v]) => [k, v.label]))} onChange={(v) => set({ expression: v })} />
                <div className="flex gap-0.5">
                  <button title="Đang nói (nhép miệng theo giọng)" className={`rounded px-1.5 py-1 text-xs ${c.speaking ? "bg-acc/25 text-acc" : "text-dim hover:text-ink"}`} onClick={() => set({ speaking: !c.speaking })}>
                    <Speech className="h-3.5 w-3.5" />
                  </button>
                  <button title="Lật ngang" className={`rounded px-1.5 py-1 text-xs ${c.flip ? "bg-blue/25 text-blue" : "text-dim hover:text-ink"}`} onClick={() => set({ flip: !c.flip })}>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                  <button title="Xóa" className="rounded px-1.5 py-1 text-xs text-dim hover:text-bad" onClick={() => up((s) => ({ ...s, characters: s.characters.filter((_, j) => j !== i) }))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          <button className="self-start text-xs text-acc hover:underline" onClick={() => up((s) => ({ ...s, characters: [...s.characters, { character: characters[0].id, mark: marks.find((m) => !s.characters.some((c) => c.mark === m)) ?? "A", pose: "stand", expression: "neutral", speaking: false, flip: false }] }))}>
            + Thêm nhân vật
          </button>
        </div>
      </div>

      <div>
        <label className="label">Chữ trên màn hình</label>
        <div className="flex flex-col gap-1.5">
          {scene.overlays.map((o, i) => {
            const set = (patch: Partial<typeof o>) => up((s) => ({ ...s, overlays: s.overlays.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
            return (
              <div key={i} className="grid grid-cols-[1.6fr_0.9fr_1fr_auto] gap-1">
                <input className="field" value={o.text} placeholder={OVERLAY_HINT[o.style]} title={OVERLAY_HINT[o.style] ? `Định dạng: ${OVERLAY_HINT[o.style]}` : undefined} onChange={(e) => set({ text: e.target.value })} />
                <Sel value={o.style} options={OVERLAY_STYLES} labels={OVERLAY_LABEL} onChange={(v) => set({ style: v })} />
                <select className="field" value={o.at_word ?? ""} onChange={(e) => set({ at_word: e.target.value === "" ? null : +e.target.value })}>
                  <option value="">Đầu cảnh</option>
                  {sceneWords.map((w) => (
                    <option key={w.i} value={w.i}>
                      khi đọc “{w.text}”
                    </option>
                  ))}
                </select>
                <button className="px-1.5 text-xs text-dim hover:text-bad" onClick={() => up((s) => ({ ...s, overlays: s.overlays.filter((_, j) => j !== i) }))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button className="self-start text-xs text-acc hover:underline" onClick={() => up((s) => ({ ...s, overlays: [...s.overlays, { text: "CHỮ MỚI", style: "title", at_word: null }] }))}>
            + Thêm chữ
          </button>
        </div>
      </div>

      <div>
        <label className="label">Hành động (diễn theo lời dẫn)</label>
        <div className="flex flex-col gap-1.5">
          {scene.actions.map((a, i) => {
            const set = (patch: Partial<typeof a>) => up((s) => ({ ...s, actions: s.actions.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
            const needsTo = ["move", "approach", "look", "point_at"].includes(a.verb);
            const needsValue = ["pose", "emote", "enter", "exit", "grow", "shrink"].includes(a.verb);
            const toOptions = a.verb === "move" ? marks : targets.filter((t) => t !== a.target);
            const valueOptions =
              a.verb === "pose" ? Object.keys(POSES) : a.verb === "emote" ? Object.keys(EXPRESSIONS) : a.verb === "enter" || a.verb === "exit" ? ["left", "right"] : ["1.3", "1.6", "0.7", "0.5"];
            const valueLabels: Record<string, string> = { ...Object.fromEntries(Object.entries(POSES).map(([k, v]) => [k, v.label])), ...Object.fromEntries(Object.entries(EXPRESSIONS).map(([k, v]) => [k, v.label])), left: "từ trái", right: "từ phải" };
            return (
              <div key={i} className="rounded-md border border-line p-1.5">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                  <Sel value={a.target} options={targets.includes(a.target) ? targets : [a.target, ...targets]} labels={targetLabels} onChange={(v) => set({ target: v })} />
                  <Sel value={a.verb} options={VERBS} labels={VERB_LABEL} onChange={(v) => set({ verb: v, to: null, value: null })} />
                  <button className="px-1.5 text-dim hover:text-bad" onClick={() => up((s) => ({ ...s, actions: s.actions.filter((_, j) => j !== i) }))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-[1.3fr_0.7fr_1fr] gap-1">
                  <select className="field" value={a.at_word ?? ""} onChange={(e) => set({ at_word: e.target.value === "" ? null : +e.target.value })}>
                    <option value="">Đầu cảnh</option>
                    {sceneWords.map((w) => (
                      <option key={w.i} value={w.i}>
                        khi đọc “{w.text}”
                      </option>
                    ))}
                  </select>
                  <input className="field" type="number" step={0.1} min={0.1} max={6} value={a.duration} title="Thời lượng (giây)" onChange={(e) => set({ duration: +e.target.value })} />
                  {needsTo ? (
                    <select className="field" value={a.to ?? ""} onChange={(e) => set({ to: e.target.value || null })}>
                      <option value="">— đích —</option>
                      {toOptions.map((t) => (
                        <option key={t} value={t}>
                          {a.verb === "move" ? `mark ${t}` : (targetLabels[t] ?? t)}
                        </option>
                      ))}
                    </select>
                  ) : needsValue ? (
                    <select className="field" value={a.value ?? ""} onChange={(e) => set({ value: e.target.value || null })}>
                      <option value="">—</option>
                      {valueOptions.map((t) => (
                        <option key={t} value={t}>
                          {valueLabels[t] ?? `×${t}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            );
          })}
          <button
            className="self-start text-xs text-acc hover:underline"
            disabled={!targets.length}
            onClick={() => up((s) => ({ ...s, actions: [...s.actions, { target: targets[0], verb: "hop", at_word: scene.word_start, delay: 0, duration: 0.8, to: null, value: null }] }))}
          >
            + Thêm hành động
          </button>
        </div>
      </div>

      <div>
        <label className="label">Đạo cụ</label>
        <div className="flex flex-col gap-1.5">
          {scene.props.map((p, i) => {
            const set = (patch: Partial<typeof p>) => up((s) => ({ ...s, props: s.props.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
            return (
              <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] items-center gap-1">
                <Sel value={p.module} options={modules.map((m) => m.id)} labels={Object.fromEntries(modules.map((m) => [m.id, m.label]))} onChange={(v) => set({ module: v })} />
                <input type="range" min={0} max={1080} value={p.x} onChange={(e) => set({ x: +e.target.value })} title="x" className="accent-[var(--color-acc)]" />
                <input type="range" min={300} max={1920} value={p.y} onChange={(e) => set({ y: +e.target.value })} title="y" className="accent-[var(--color-acc)]" />
                <input type="range" min={0.2} max={3} step={0.05} value={p.scale} onChange={(e) => set({ scale: +e.target.value })} title="tỉ lệ" className="accent-[var(--color-acc)]" />
                <button className="px-1.5 text-xs text-dim hover:text-bad" onClick={() => up((s) => ({ ...s, props: s.props.filter((_, j) => j !== i) }))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button className="self-start text-xs text-acc hover:underline" onClick={() => up((s) => ({ ...s, props: [...s.props, { module: "coin_pile", x: 760, y: 1650, scale: 1, rot: 0, flip: false }] }))}>
            + Thêm đạo cụ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Chuyển cảnh vào</label>
          <Sel value={scene.transition} options={TRANSITIONS} labels={TRANSITION_LABEL} onChange={(v) => up((s) => ({ ...s, transition: v }))} />
        </div>
        <div className="flex items-end gap-1">
          <button className="btn flex-1 justify-center" onClick={() => up((s) => ({ ...s, seed: Math.floor(Math.random() * 9999) }))}>
            <Dices className="h-3.5 w-3.5" /> Seed mới
          </button>
        </div>
      </div>

      <div>
        <label className="label">Lời dẫn</label>
        <div className="rounded-md border border-line bg-panel2 px-2.5 py-2 text-[13px] leading-relaxed">
          {sceneWords.map((w) => (
            <span key={w.i} className="cursor-pointer rounded px-0.5 hover:bg-acc/20" title={`${words[w.i].start.toFixed(2)}s`} onClick={() => clock.seek(words[w.i].start)}>
              {w.text}{" "}
            </span>
          ))}
        </div>
        <textarea className="field mt-1.5 italic" rows={2} placeholder="Bản dịch tiếng Việt" value={scene.narration_vi} onChange={(e) => up((s) => ({ ...s, narration_vi: e.target.value }))} />
        <textarea className="field mt-1.5" rows={2} placeholder="Mô tả cảnh" value={scene.description} onChange={(e) => up((s) => ({ ...s, description: e.target.value }))} />
      </div>

      <div>
        <label className="label">Kiểm tra QA</label>
        {scene.qa_issues.length ? (
          <ul className="flex flex-col gap-1">
            {scene.qa_issues.map((q, i) => (
              <li key={i} className={`rounded px-2 py-1 text-xs ${q.level === "error" ? "bg-bad/10 text-bad" : q.level === "warn" ? "bg-warn/10 text-warn" : "bg-panel2 text-mute"}`}>
                {q.message}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-ok">Không có vấn đề</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button className="btn" onClick={() => updateEpisode((e) => runQa(splitScene(e, scene.id, clock.now()), library))} title="Tách tại vị trí đầu phát">
          <Scissors className="h-3.5 w-3.5" /> Tách tại đầu phát
        </button>
        <button
          className="btn"
          disabled={episode.scenes[episode.scenes.length - 1].id === scene.id}
          onClick={() => {
            updateEpisode((e) => runQa(mergeNext(e, scene.id), library));
            select(scene.id);
          }}
        >
          <Merge className="h-3.5 w-3.5" /> Gộp với cảnh sau
        </button>
      </div>
    </div>
  );
}
