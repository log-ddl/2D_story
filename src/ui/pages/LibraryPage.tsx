import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { lintModule } from "../../engine/svg";
import { newId } from "../../backend";
import { CharacterSpec } from "../../schema";
import { CharacterEditor } from "../components/Editors";
import { ModulePreview, SettingPreview } from "../components/Previews";
import { useStore } from "../store";

function CharactersTab() {
  const library = useStore((s) => s.library);
  const updateProject = useStore((s) => s.updateProject);
  const chars = [...library.characters.values()];
  const [sel, setSel] = useState(chars[0]?.id);
  const spec = library.getCharacter(sel ?? "") ?? chars[0];
  const [desc, setDesc] = useState("");
  const generateCharacter = useStore((s) => s.generateCharacter);
  const brains = useStore((s) => s.brains);
  const backend = useStore((s) => s.backend);
  const brainCli = useStore((s) => s.settings.brainCli);
  const cliOk = backend?.kind === "tauri" && !!brains?.[brainCli];
  const create = () => {
    const c = CharacterSpec.parse({ id: newId("char"), name: "Nhân vật mới" });
    updateProject((p) => ({ ...p, characters: [...p.characters, c] }));
    setSel(c.id);
  };
  if (!spec) return null;
  return (
    <div className="grid h-full grid-cols-[220px_1fr] gap-4 overflow-hidden">
      <div className="flex flex-col gap-1 overflow-y-auto">
        {chars.map((c) => (
          <button key={c.id} className={`rounded-lg px-3 py-2 text-left ${c.id === spec.id ? "bg-panel2 text-ink" : "text-mute hover:bg-panel"}`} onClick={() => setSel(c.id)}>
            <div className="font-medium">{c.name}</div>
            <div className="font-mono text-[10.5px] text-dim">
              {c.id}
              {c.generator ? " · đám đông" : ""}
            </div>
          </button>
        ))}
        <button className="btn mt-2 justify-center" onClick={create}>
          + Nhân vật (tham số)
        </button>
        <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-line p-2">
          <div className="text-[11.5px] text-mute">Bộ não vẽ nhân vật SVG có khung xương (con vật, robot, nhân vật mọi phong cách)</div>
          <textarea className="field" rows={3} placeholder="vd: chú mèo cam mập đội mũ phi công" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <button className="btn-acc justify-center" disabled={!desc.trim() || !cliOk} onClick={() => void generateCharacter(desc.trim()).then((id) => id && (setSel(id), setDesc("")))}>
            Vẽ bằng bộ não
          </button>
        </div>
      </div>
      <CharacterEditor spec={spec} library={library} />
    </div>
  );
}

function ModulesTab() {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const updateProject = useStore((s) => s.updateProject);
  const generateModule = useStore((s) => s.generateModule);
  const settings = useStore((s) => s.settings);
  const brains = useStore((s) => s.brains);
  const backend = useStore((s) => s.backend);
  const cliOk = backend?.kind === "tauri" && !!brains?.[settings.brainCli];
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"prop" | "headwear" | "hand">("prop");
  const [paste, setPaste] = useState("");
  const drafts = project?.modules ?? [];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <section className="card flex flex-col gap-2 p-4">
        <h3 className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-4 w-4 text-acc" /> Bộ não vẽ module SVG mới ({settings.brainCli})</h3>
        <p className="text-xs text-mute">Vẽ theo quy ước style (viền #2b2233, màu phẳng, không chữ/ảnh raster). Bản vẽ qua linter tự động và chờ bạn duyệt trước khi dùng trong cảnh.</p>
        <div className="flex gap-2">
          <input className="field" placeholder="vd: chiếc thuyền buồm La Mã nhỏ có mái chèo" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && prompt.trim() && void generateModule(prompt.trim(), kind)} />
          <select className="field !w-40" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="prop">Đạo cụ / cảnh vật</option>
            <option value="headwear">Đồ đội đầu</option>
            <option value="hand">Đồ cầm tay</option>
          </select>
          <button className="btn-acc" disabled={!prompt.trim() || !cliOk} onClick={() => void generateModule(prompt.trim(), kind)}>
            Vẽ
          </button>
        </div>
        {!cliOk && <p className="text-[11px] text-dim">Cần app desktop và CLI bộ não (xem Cài đặt).</p>}
        <details className="text-xs text-mute">
          <summary className="cursor-pointer">Hoặc dán SVG có sẵn</summary>
          <textarea className="field mt-2 font-mono text-[11px]" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='<svg viewBox="..."> ... </svg>' />
          <button
            className="btn mt-2"
            disabled={!paste.trim()}
            onClick={() => {
              updateProject((p) => ({ ...p, modules: [...p.modules, { id: newId("mod"), svg: paste, tags: [], status: "draft", kind: "prop" }] }));
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
                        <Check className="h-3.5 w-3.5" /> Duyệt
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
  const aspect = useStore((s) => s.episode?.aspect ?? "9:16");
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto">
      {[...library.settings.values()].map((s) => (
        <div key={s.id} className="card overflow-hidden p-2">
          <SettingPreview settingId={s.id} library={library} aspect={aspect} className="w-full rounded" />
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
