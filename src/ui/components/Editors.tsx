// Trình sửa nhân vật và bối cảnh — dùng chung cho bước 2 (Nhân vật & Bối cảnh) và Thư viện.
import { ArrowLeftRight, Speech, X } from "lucide-react";

import { useState } from "react";
import { BEARD_STYLES, HAIR_STYLES, OUTFITS } from "../../brain";
import { EXPRESSIONS, POSES } from "../../engine/character";
import type { Library } from "../../engine/library";
import { CharacterSpec, LIGHTINGS, SettingSpec } from "../../schema";
import { useStore } from "../store";
import { LIGHT_LABEL } from "./labels";
import { CharacterPreview, SettingPreview } from "./Previews";

const HAIR_LABEL: Record<string, string> = { short: "Ngắn", bowl: "Mái bằng", curly: "Xoăn", spiky: "Dựng", long: "Dài", fringe: "Hói 2 bên", bald: "Trọc" };
const BEARD_LABEL: Record<string, string> = { none: "Không", full: "Rậm", long: "Dài", goatee: "Dê", mustache: "Ria mép", stubble: "Lún phún" };
const OUTFIT_LABEL: Record<string, string> = { tunic: "Áo chẽn", toga: "Toga", armor: "Giáp", robe: "Áo dài", royal: "Hoàng gia" };

/** Lưu nhân vật vào dự án (nhân vật có sẵn sẽ thành bản riêng của dự án) */
export function useSaveCharacter() {
  const updateProject = useStore((s) => s.updateProject);
  return (spec: CharacterSpec) => updateProject((p) => ({ ...p, characters: [...p.characters.filter((c) => c.id !== spec.id), CharacterSpec.parse(spec)] }));
}

export function useSaveSetting() {
  const updateProject = useStore((s) => s.updateProject);
  return (spec: SettingSpec) => updateProject((p) => ({ ...p, settings: [...p.settings.filter((c) => c.id !== spec.id), SettingSpec.parse(spec)] }));
}

export function CharacterEditor({ spec, library }: { spec: CharacterSpec; library: Library }) {
  const save = useSaveCharacter();
  const project = useStore((s) => s.project);
  const [pose, setPose] = useState("stand");
  const [expr, setExpr] = useState("neutral");
  const [talk, setTalk] = useState(false);
  const own = project?.characters.some((c) => c.id === spec.id);
  const headwear = library.moduleDefs.filter((m) => m.kind === "headwear");
  const hand = library.moduleDefs.filter((m) => m.kind === "hand");
  const edit = (patch: Partial<CharacterSpec>) => save({ ...spec, ...patch });
  const generateCharacter = useStore((s) => s.generateCharacter);
  const [redraw, setRedraw] = useState("");
  const isSvg = spec.kind === "svg";

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_330px] gap-4">
      <div className="flex min-h-0 flex-col gap-2">
        <div className="card min-h-0 flex-1 bg-[radial-gradient(circle_at_50%_70%,#2a2533,#151318)]">
          <CharacterPreview spec={spec} pose={pose} expression={expr} talk={talk} library={library} className="h-full w-full" />
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(POSES).map(([k, v]) => (
            <button key={k} className={`chip border ${pose === k ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setPose(k)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(EXPRESSIONS).map(([k, v]) => (
            <button key={k} className={`chip border ${expr === k ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setExpr(k)}>
              {v.label}
            </button>
          ))}
          <button className={`chip border ${talk ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setTalk(!talk)}>
            <Speech className="inline h-3 w-3" /> nhép miệng
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-1">
        {!own && <div className="rounded-md bg-panel2 p-2 text-[11px] text-mute">Nhân vật gốc của thư viện — sửa sẽ tạo bản riêng trong dự án.</div>}
        <div>
          <label className="label">Tên</label>
          <input className="field" value={spec.name} onChange={(e) => edit({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Cách gọi trong lời dẫn (phẩy ngăn cách)</label>
          <input className="field" value={spec.aliases.join(", ")} onChange={(e) => edit({ aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </div>
        {isSvg && (
          <div className="flex flex-col gap-2 rounded-md bg-panel2 p-2.5 text-[12px] text-mute">
            <div>
              Nhân vật SVG có khung xương (<span className="font-mono text-ink">{spec.rig}</span>). Engine tự cử động tay, chân, đầu, chớp mắt, nhép miệng theo tư thế và hành động.
            </div>
            <textarea className="field" rows={3} placeholder="Mô tả để bộ não vẽ lại, vd: mèo cam mập đội mũ phi công" value={redraw} onChange={(e) => setRedraw(e.target.value)} />
            <button className="btn justify-center" disabled={!redraw.trim()} onClick={() => void generateCharacter(redraw.trim(), spec.id)}>
              Vẽ lại bằng bộ não
            </button>
          </div>
        )}
        <div className={`grid grid-cols-2 gap-2 ${isSvg ? "hidden" : ""}`}>
          <Pick label="Tuổi" value={spec.age} options={{ kid: "Trẻ em", adult: "Người lớn", old: "Già" }} onChange={(v) => edit({ age: v as CharacterSpec["age"] })} />
          <Pick label="Vóc dáng" value={spec.build} options={{ slim: "Gầy", normal: "Vừa", stocky: "Vạm vỡ" }} onChange={(v) => edit({ build: v as CharacterSpec["build"] })} />
          <Pick label="Kiểu tóc" value={spec.hair.style} options={Object.fromEntries(HAIR_STYLES.map((h) => [h, HAIR_LABEL[h]]))} onChange={(v) => edit({ hair: { ...spec.hair, style: v } })} />
          <Pick label="Râu" value={spec.beard.style} options={Object.fromEntries(BEARD_STYLES.map((h) => [h, BEARD_LABEL[h]]))} onChange={(v) => edit({ beard: { ...spec.beard, style: v } })} />
          <Pick label="Trang phục" value={spec.outfit.type} options={Object.fromEntries(OUTFITS.map((h) => [h, OUTFIT_LABEL[h]]))} onChange={(v) => edit({ outfit: { ...spec.outfit, type: v as CharacterSpec["outfit"]["type"] } })} />
          <Pick label="Đồ đội đầu" value={spec.headwear} options={{ none: "Không", ...Object.fromEntries(headwear.map((h) => [h.id, h.label])) }} onChange={(v) => edit({ headwear: v })} />
          <Pick label="Cầm tay" value={spec.hand_prop ?? ""} options={{ "": "Không", ...Object.fromEntries(hand.map((h) => [h.id, h.label])) }} onChange={(v) => edit({ hand_prop: v || null })} />
          <div>
            <label className="label">Áo choàng</label>
            <div className="flex h-[30px] items-center gap-2">
              <input type="checkbox" checked={!!spec.cape} onChange={(e) => edit({ cape: e.target.checked ? "#8f2d56" : null })} />
              {spec.cape && <input type="color" value={spec.cape} onChange={(e) => edit({ cape: e.target.value })} />}
            </div>
          </div>
        </div>
        <div className={`grid grid-cols-5 gap-2 ${isSvg ? "hidden" : ""}`}>
          {(
            [
              ["Da", spec.skin, (v: string) => edit({ skin: v })],
              ["Tóc", spec.hair.color, (v: string) => edit({ hair: { ...spec.hair, color: v } })],
              ["Râu", spec.beard.color, (v: string) => edit({ beard: { ...spec.beard, color: v } })],
              ["Áo", spec.outfit.color, (v: string) => edit({ outfit: { ...spec.outfit, color: v } })],
              ["Viền", spec.outfit.trim, (v: string) => edit({ outfit: { ...spec.outfit, trim: v } })],
            ] as const
          ).map(([l, v, f]) => (
            <label key={l} className="flex flex-col items-center gap-1 text-[11px] text-mute">
              <input type="color" value={v} onChange={(e) => f(e.target.value)} className="h-8 w-full cursor-pointer rounded border-0 bg-transparent" />
              {l}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-mute">
          <input type="checkbox" checked={spec.generator} onChange={(e) => edit({ generator: e.target.checked })} /> Nhân vật đám đông (mỗi lần xuất hiện một biến thể)
        </label>
      </div>
    </div>
  );
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Sửa bối cảnh: tên, tag, màu nền/mặt đất, ánh sáng, danh sách đạo cụ trên sân khấu */
export function SettingEditor({ spec, library, aspect }: { spec: SettingSpec; library: Library; aspect: string }) {
  const save = useSaveSetting();
  const project = useStore((s) => s.project);
  const own = project?.settings.some((s) => s.id === spec.id);
  const edit = (patch: Partial<SettingSpec>) => save({ ...spec, ...patch });
  const back = spec.layers[0];
  const groundIdx = spec.layers.findIndex((l) => l.ground);
  const stage = spec.layers.length - 1;
  const items = spec.layers[stage].items;
  const mods = library.moduleDefs.filter((m) => m.kind !== "headwear" && m.kind !== "hand" && m.kind !== "rig");
  const setLayer = (i: number, patch: Partial<SettingSpec["layers"][number]>) => edit({ layers: spec.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setItem = (k: number, patch: Partial<(typeof items)[number]>) => setLayer(stage, { items: items.map((it, j) => (j === k ? { ...it, ...patch } : it)) });

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
        <SettingPreview settingId={spec.id} library={library} aspect={aspect} className={`max-h-full max-w-full rounded-lg border border-line ${aspect === "9:16" || aspect === "4:5" ? "h-full" : "w-full"}`} />
      </div>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-1">
        {!own && <div className="rounded-md bg-panel2 p-2 text-[11px] text-mute">Bối cảnh gốc của thư viện — sửa sẽ tạo bản riêng trong dự án.</div>}
        <div>
          <label className="label">Tên</label>
          <input className="field" value={spec.name} onChange={(e) => edit({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Tag (để chia cảnh tự tìm, phẩy ngăn cách)</label>
          <input className="field" value={spec.tags.join(", ")} onChange={(e) => edit({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </div>
        {spec.description && <p className="text-[12px] text-mute italic">{spec.description}</p>}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">{back.sky ? "Trời" : "Tường"}</label>
            <input
              type="color"
              className="h-8 w-full cursor-pointer rounded border-0 bg-transparent"
              value={back.sky?.[0] ?? back.fill ?? "#888888"}
              onChange={(e) => setLayer(0, back.sky ? { sky: [e.target.value, back.sky[1]] } : { fill: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mặt đất</label>
            {groundIdx >= 0 ? (
              <input type="color" className="h-8 w-full cursor-pointer rounded border-0 bg-transparent" value={spec.layers[groundIdx].ground!.color} onChange={(e) => setLayer(groundIdx, { ground: { ...spec.layers[groundIdx].ground!, color: e.target.value } })} />
            ) : (
              <div className="text-xs text-dim">—</div>
            )}
          </div>
          <Pick label="Ánh sáng" value={spec.base_lighting} options={Object.fromEntries(LIGHTINGS.filter((l) => l !== "auto").map((l) => [l, LIGHT_LABEL[l]]))} onChange={(v) => edit({ base_lighting: v as SettingSpec["base_lighting"] })} />
        </div>
        <div>
          <label className="label">Vật thể trên sân khấu ({items.length})</label>
          <div className="flex flex-col gap-1.5">
            {items.map((it, k) => (
              <div key={k} className="rounded-md border border-line p-1.5">
                <div className="flex gap-1">
                  <select className="field" value={it.module} onChange={(e) => setItem(k, { module: e.target.value })}>
                    {it.module.startsWith("label:") && <option value={it.module}>Nhãn: {it.module.slice(6)}</option>}
                    {mods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button className="px-1.5 text-xs text-dim hover:text-ink" title="Lật" onClick={() => setItem(k, { flip: !it.flip })}>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                  <button className="px-1.5 text-xs text-dim hover:text-bad" onClick={() => setLayer(stage, { items: items.filter((_, j) => j !== k) })}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-dim">
                  <label>
                    ngang
                    <input type="range" min={-100} max={1180} value={it.x} onChange={(e) => setItem(k, { x: +e.target.value })} className="w-full accent-[var(--color-acc)]" />
                  </label>
                  <label>
                    dọc
                    <input type="range" min={200} max={1920} value={it.y} onChange={(e) => setItem(k, { y: +e.target.value })} className="w-full accent-[var(--color-acc)]" />
                  </label>
                  <label>
                    cỡ
                    <input type="range" min={0.2} max={2.5} step={0.05} value={it.scale} onChange={(e) => setItem(k, { scale: +e.target.value })} className="w-full accent-[var(--color-acc)]" />
                  </label>
                </div>
              </div>
            ))}
            <button className="self-start text-xs text-acc hover:underline" onClick={() => setLayer(stage, { items: [...items, { module: "bush", x: 540, y: 1450, scale: 1, flip: false, rot: 0 }] })}>
              + Thêm vật thể
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
