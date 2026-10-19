import { useState } from "react";
import { EXPRESSIONS, POSES } from "../../engine/character";
import { lintModule } from "../../engine/svg";
import { newId } from "../../backend";
import { CharacterSpec } from "../../schema";
import { CharacterPreview, ModulePreview, SettingPreview } from "../components/Previews";
import { useStore } from "../store";

const HAIR = ["short", "bowl", "curly", "spiky", "long", "fringe", "bald"];
const BEARD = ["none", "full", "long", "goatee", "mustache", "stubble"];

function CharactersTab() {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const updateProject = useStore((s) => s.updateProject);
  const chars = [...library.characters.values()];
  const [sel, setSel] = useState(chars[0]?.id);
  const [pose, setPose] = useState("stand");
  const [expr, setExpr] = useState("neutral");
  const [talk, setTalk] = useState(false);
  const spec = library.getCharacter(sel ?? "") ?? chars[0];
  const own = project?.characters.some((c) => c.id === spec?.id);
  const headwear = library.moduleDefs.filter((m) => m.kind === "headwear");
  const hand = library.moduleDefs.filter((m) => m.kind === "hand");

  const edit = (patch: Partial<CharacterSpec>) => {
    if (!spec) return;
    const next = CharacterSpec.parse({ ...spec, ...patch });
    updateProject((p) => ({ ...p, characters: [...p.characters.filter((c) => c.id !== next.id), next] }));
  };
  const create = () => {
    const c = CharacterSpec.parse({ id: newId("char"), name: "Nhân vật mới" });
    updateProject((p) => ({ ...p, characters: [...p.characters, c] }));
    setSel(c.id);
  };
  if (!spec) return null;

  return (
    <div className="grid h-full grid-cols-[220px_1fr_340px] gap-4 overflow-hidden">
      <div className="flex flex-col gap-1 overflow-y-auto">
        {chars.map((c) => (
          <button key={c.id} className={`rounded-lg px-3 py-2 text-left ${c.id === spec.id ? "bg-panel2 text-ink" : "text-mute hover:bg-panel"}`} onClick={() => setSel(c.id)}>
            <div className="font-medium">{c.name}</div>
            <div className="font-mono text-[10.5px] text-dim">
              {c.id}
              {c.generator ? " · sinh biến thể" : ""}
            </div>
          </button>
        ))}
        <button className="btn mt-2 justify-center" onClick={create}>
          + Nhân vật mới
        </button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="card w-full flex-1 bg-[radial-gradient(circle_at_50%_70%,#2a2533,#151318)]">
          <CharacterPreview spec={spec} pose={pose} expression={expr} talk={talk} library={library} className="h-full w-full" />
        </div>
        <div className="flex w-full flex-wrap gap-1">
          {Object.entries(POSES).map(([k, v]) => (
            <button key={k} className={`chip border ${pose === k ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setPose(k)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-1">
          {Object.entries(EXPRESSIONS).map(([k, v]) => (
            <button key={k} className={`chip border ${expr === k ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setExpr(k)}>
              {v.label}
            </button>
          ))}
          <button className={`chip border ${talk ? "border-acc text-acc" : "border-line text-mute"}`} onClick={() => setTalk(!talk)}>
            🗣 nhép miệng
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
        {!own && <div className="rounded-md bg-panel2 p-2 text-[11px] text-mute">Nhân vật có sẵn — chỉnh sửa sẽ tạo bản riêng trong dự án.</div>}
        <div>
          <label className="label">Tên</label>
          <input className="field" value={spec.name} onChange={(e) => edit({ name: e.target.value })} />
        </div>
        <div>
          <label className="label">Biệt danh (để nhận ra trong lời dẫn, cách nhau dấu phẩy)</label>
          <input className="field" value={spec.aliases.join(", ")} onChange={(e) => edit({ aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Tuổi</label>
            <select className="field" value={spec.age} onChange={(e) => edit({ age: e.target.value as CharacterSpec["age"] })}>
              <option value="kid">Trẻ em</option>
              <option value="adult">Người lớn</option>
              <option value="old">Già</option>
            </select>
          </div>
          <div>
            <label className="label">Vóc dáng</label>
            <select className="field" value={spec.build} onChange={(e) => edit({ build: e.target.value as CharacterSpec["build"] })}>
              <option value="slim">Gầy</option>
              <option value="normal">Vừa</option>
              <option value="stocky">Vạm vỡ</option>
            </select>
          </div>
          <div>
            <label className="label">Kiểu tóc</label>
            <select className="field" value={spec.hair.style} onChange={(e) => edit({ hair: { ...spec.hair, style: e.target.value } })}>
              {HAIR.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Râu</label>
            <select className="field" value={spec.beard.style} onChange={(e) => edit({ beard: { ...spec.beard, style: e.target.value } })}>
              {BEARD.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Trang phục</label>
            <select className="field" value={spec.outfit.type} onChange={(e) => edit({ outfit: { ...spec.outfit, type: e.target.value as CharacterSpec["outfit"]["type"] } })}>
              {["tunic", "toga", "armor", "robe", "royal"].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Đồ đội đầu</label>
            <select className="field" value={spec.headwear} onChange={(e) => edit({ headwear: e.target.value })}>
              <option value="none">Không</option>
              {headwear.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cầm tay</label>
            <select className="field" value={spec.hand_prop ?? ""} onChange={(e) => edit({ hand_prop: e.target.value || null })}>
              <option value="">Không</option>
              {hand.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Áo choàng</label>
            <div className="flex gap-1">
              <input type="checkbox" checked={!!spec.cape} onChange={(e) => edit({ cape: e.target.checked ? "#8f2d56" : null })} />
              {spec.cape && <input type="color" value={spec.cape} onChange={(e) => edit({ cape: e.target.value })} />}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
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
          <input type="checkbox" checked={spec.generator} onChange={(e) => edit({ generator: e.target.checked })} /> Sinh biến thể theo seed (lính, đám đông)
        </label>
      </div>
    </div>
  );
}

function ModulesTab() {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const updateProject = useStore((s) => s.updateProject);
  const generateModule = useStore((s) => s.generateModule);
  const settings = useStore((s) => s.settings);
  const [prompt, setPrompt] = useState("");
  const [paste, setPaste] = useState("");
  const drafts = project?.modules ?? [];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <section className="card flex flex-col gap-2 p-4">
        <h3 className="font-semibold">✦ AI vẽ module SVG mới</h3>
        <p className="text-xs text-mute">Claude vẽ theo quy ước style (viền #2b2233, màu phẳng, không chữ/ảnh raster). Bản vẽ qua linter tự động và chờ bạn duyệt trước khi dùng trong cảnh.</p>
        <div className="flex gap-2">
          <input className="field" placeholder="vd: chiếc thuyền buồm La Mã nhỏ có mái chèo" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && prompt.trim() && void generateModule(prompt.trim())} />
          <button className="btn-acc" disabled={!prompt.trim() || !settings.anthropicKey} onClick={() => void generateModule(prompt.trim())}>
            Vẽ
          </button>
        </div>
        {!settings.anthropicKey && <p className="text-[11px] text-dim">Cần Anthropic API key trong Cài đặt.</p>}
        <details className="text-xs text-mute">
          <summary className="cursor-pointer">Hoặc dán SVG có sẵn</summary>
          <textarea className="field mt-2 font-mono text-[11px]" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='<svg viewBox="..."> ... </svg>' />
          <button
            className="btn mt-2"
            disabled={!paste.trim()}
            onClick={() => {
              updateProject((p) => ({ ...p, modules: [...p.modules, { id: newId("mod"), svg: paste, tags: [], status: "draft" }] }));
              setPaste("");
            }}
          >
            Thêm vào bản nháp
          </button>
        </details>
      </section>

      {drafts.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Module của dự án</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {drafts.map((m) => {
              const issues = lintModule(m.svg);
              return (
                <div key={m.id} className="card flex flex-col gap-2 p-2">
                  <ModulePreview svg={m.svg} className="h-36 w-full rounded bg-[#efe6d6]" />
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-[11px]">{m.id}</span>
                    <span className={`chip ${m.status === "approved" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{m.status === "approved" ? "Đã duyệt" : "Nháp"}</span>
                  </div>
                  {issues.length > 0 && (
                    <ul className="text-[10.5px]">
                      {issues.slice(0, 3).map((i, k) => (
                        <li key={k} className={i.level === "error" ? "text-bad" : "text-warn"}>
                          • {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-1">
                    {m.status === "draft" ? (
                      <button className="btn flex-1 justify-center !py-1" disabled={issues.some((i) => i.level === "error")} onClick={() => updateProject((p) => ({ ...p, modules: p.modules.map((x) => (x.id === m.id ? { ...x, status: "approved" } : x)) }))}>
                        ✓ Duyệt
                      </button>
                    ) : (
                      <button className="btn flex-1 justify-center !py-1" onClick={() => updateProject((p) => ({ ...p, modules: p.modules.map((x) => (x.id === m.id ? { ...x, status: "draft" } : x)) }))}>
                        Bỏ duyệt
                      </button>
                    )}
                    <button className="btn !py-1 text-bad" onClick={() => updateProject((p) => ({ ...p, modules: p.modules.filter((x) => x.id !== m.id) }))}>
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 font-semibold">Thư viện gốc ({library.moduleDefs.length})</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {library.moduleDefs.map((m) => {
            const mod = library.getModule(m.id);
            return (
              <div key={m.id} className="card p-2" title={m.tags.join(", ")}>
                {mod && <ModulePreview module={mod} className="h-24 w-full rounded bg-[#efe6d6]" />}
                <div className="mt-1 truncate text-[12px]">{m.label}</div>
                <div className="truncate font-mono text-[10px] text-dim">
                  {m.id} · {m.kind}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SettingsTab() {
  const library = useStore((s) => s.library);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto">
      {[...library.settings.values()].map((s) => (
        <div key={s.id} className="card overflow-hidden p-2">
          <SettingPreview settingId={s.id} library={library} className="w-full rounded" />
          <div className="mt-1.5 text-[13px] font-medium">{s.name}</div>
          <div className="font-mono text-[10.5px] text-dim">
            {s.id} · mark {Object.keys(s.marks).join("/")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const [tab, setTab] = useState<"chars" | "modules" | "settings">("chars");
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-5">
      <div className="flex rounded-lg border border-line bg-panel p-0.5 self-start">
        {(
          [
            ["chars", "Nhân vật"],
            ["modules", "Module SVG"],
            ["settings", "Bối cảnh"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={`rounded-md px-4 py-1.5 text-[13px] font-medium ${tab === k ? "bg-panel2 text-ink" : "text-mute"}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{tab === "chars" ? <CharactersTab /> : tab === "modules" ? <ModulesTab /> : <SettingsTab />}</div>
    </div>
  );
}
