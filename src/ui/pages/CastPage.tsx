import { useState } from "react";
import { ArrowRight, Copy, Sparkles, Square, X } from "lucide-react";
import { newId } from "../../backend";
import { CharacterSpec, SettingSpec } from "../../schema";
import { CharacterEditor, SettingEditor, useSaveCharacter, useSaveSetting } from "../components/Editors";
import { CharacterPreview, SettingPreview } from "../components/Previews";
import { useStore } from "../store";

const GRADE_LABEL = { none: "Tự nhiên", warm: "Ấm", cool: "Lạnh", pastel: "Pastel", noir: "Đen trắng", vintage: "Cổ điển" } as const;
const SUB_LABEL = { karaoke: "Karaoke (tô từng từ)", clean: "Gọn (hộp tối)", pop: "Bật từng từ" } as const;

export function CastPage() {
  const episode = useStore((s) => s.episode);
  const library = useStore((s) => s.library);
  const backend = useStore((s) => s.backend);
  const settings = useStore((s) => s.settings);
  const brains = useStore((s) => s.brains);
  const jobs = useStore((s) => s.jobs);
  const st = useStore.getState();
  const saveChar = useSaveCharacter();
  const saveSet = useSaveSetting();
  const [edit, setEdit] = useState<{ kind: "char" | "set"; id: string } | null>(null);
  if (!episode) return <div className="p-8 text-mute">Chưa mở tập nào</div>;

  const chars = [...library.characters.values()];
  const sets = [...library.settings.values()].filter((s) => s.id !== "title_card");
  const inCast = (id: string) => episode.cast.includes(id);
  const inSets = (id: string) => episode.sets.includes(id);
  const castList = episode.cast.length ? chars.filter((c) => inCast(c.id)) : [];
  const setList = episode.sets.length ? sets.filter((s) => inSets(s.id)) : [];
  const toggleCast = (id: string) => st.updateEpisode((e) => ({ ...e, cast: e.cast.includes(id) ? e.cast.filter((x) => x !== id) : [...e.cast, id] }));
  const toggleSet = (id: string) => st.updateEpisode((e) => ({ ...e, sets: e.sets.includes(id) ? e.sets.filter((x) => x !== id) : [...e.sets, id] }));
  const running = jobs.some((j) => j.status === "running" && j.label.includes("lập dàn"));
  const cliOk = brains?.[settings.brainCli];
  const desktop = backend?.kind === "tauri";

  const newChar = () => {
    const c = CharacterSpec.parse({ id: newId("char"), name: "Nhân vật mới" });
    saveChar(c);
    st.updateEpisode((e) => ({ ...e, cast: [...e.cast, c.id] }));
    setEdit({ kind: "char", id: c.id });
  };
  const cloneSet = (from: string) => {
    const base = library.getSetting(from);
    const s = SettingSpec.parse({ ...structuredClone(base), id: newId("set"), name: `${base.name} (bản sao)` });
    saveSet(s);
    st.updateEpisode((e) => ({ ...e, sets: [...e.sets, s.id] }));
    setEdit({ kind: "set", id: s.id });
  };

  const editing = edit && (edit.kind === "char" ? library.getCharacter(edit.id) : library.settings.get(edit.id));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <section className="card flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-4 w-4 text-acc" /> Bộ não lập dàn nhân vật, bối cảnh và phong cách</h3>
          <p className="mt-0.5 text-xs text-mute">
            Đọc kịch bản → chọn nhân vật/bối cảnh có sẵn để dùng lại, tạo mới phần còn thiếu, chọn tông màu và kiểu phụ đề. Mọi thứ lưu vào dự án để các tập sau dùng lại.
            {" "}Đang dùng: <b className="text-ink">{settings.brainCli}</b>{" "}
            {desktop ? cliOk ? <span className="text-ok">({cliOk})</span> : <span className="text-bad">(chưa tìm thấy — xem Cài đặt)</span> : <span className="text-warn">(chỉ có trên app desktop)</span>}
          </p>
        </div>
        {running ? (
          <button className="btn text-bad" onClick={() => void st.cancelBrain()}>
            <Square className="h-3.5 w-3.5" /> Dừng
          </button>
        ) : (
          <button className="btn-acc" disabled={!desktop || !cliOk || !episode.script_text.trim()} onClick={() => void st.proposeCast()}>
            <Sparkles className="h-3.5 w-3.5" /> Đề xuất từ kịch bản
          </button>
        )}
      </section>

      <section className="card grid grid-cols-[180px_220px_1fr] items-end gap-3 p-4">
        <div>
          <label className="label">Tông màu</label>
          <select className="field" value={episode.style.grade} onChange={(e) => st.updateEpisode((x) => ({ ...x, style: { ...x.style, grade: e.target.value as typeof x.style.grade } }))}>
            {Object.entries(GRADE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Kiểu phụ đề</label>
          <select className="field" value={episode.style.subtitle} onChange={(e) => st.updateEpisode((x) => ({ ...x, style: { ...x.style, subtitle: e.target.value as typeof x.style.subtitle } }))}>
            {Object.entries(SUB_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ghi chú phong cách (bộ não dùng khi chia cảnh)</label>
          <input className="field" placeholder="vd: hài hước, nhịp nhanh, nhiều cận mặt khi có cảm xúc" value={episode.style.note} onChange={(e) => st.updateEpisode((x) => ({ ...x, style: { ...x.style, note: e.target.value } }), { history: false })} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[15px] font-bold">Nhân vật trong tập</h3>
          <span className="text-xs text-mute">{castList.length ? `${castList.length} nhân vật` : "chưa chọn — chia cảnh sẽ dùng cả thư viện"}</span>
          <button className="btn ml-auto" onClick={newChar}>
            + Tạo nhân vật
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {castList.map((c) => (
            <div key={c.id} className="card cursor-pointer overflow-hidden p-2 hover:border-mute/50" onClick={() => setEdit({ kind: "char", id: c.id })}>
              <div className="h-40 rounded-md bg-[radial-gradient(circle_at_50%_75%,#2a2533,#151318)]">
                <CharacterPreview spec={c} pose="stand" expression="neutral" library={library} animate={false} className="h-full w-full" />
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="truncate text-[13px] font-medium">{c.name}</span>
                <button className="ml-auto text-xs text-dim hover:text-bad" title="Bỏ khỏi tập" onClick={(e) => (e.stopPropagation(), toggleCast(c.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="truncate text-[10.5px] text-dim">{c.aliases.slice(0, 4).join(", ") || "—"}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-dim">Thêm từ thư viện:</span>
          {chars
            .filter((c) => !inCast(c.id))
            .map((c) => (
              <button key={c.id} className="chip border border-line text-mute hover:text-ink" onClick={() => toggleCast(c.id)}>
                + {c.name}
              </button>
            ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[15px] font-bold">Bối cảnh trong tập</h3>
          <span className="text-xs text-mute">{setList.length ? `${setList.length} bối cảnh · khung ${episode.aspect}` : "chưa chọn — chia cảnh sẽ dùng cả thư viện"}</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {setList.map((s) => (
            <div key={s.id} className="card cursor-pointer overflow-hidden p-2 hover:border-mute/50" onClick={() => setEdit({ kind: "set", id: s.id })}>
              <SettingPreview settingId={s.id} library={library} aspect={episode.aspect} className="w-full rounded" />
              <div className="mt-1.5 flex items-center gap-1">
                <span className="truncate text-[13px] font-medium">{s.name}</span>
                <button className="ml-auto text-xs text-dim hover:text-bad" title="Bỏ khỏi tập" onClick={(e) => (e.stopPropagation(), toggleSet(s.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="truncate text-[10.5px] text-dim">{s.description || s.tags.slice(0, 4).join(", ")}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-dim">Thêm từ thư viện:</span>
          {sets
            .filter((s) => !inSets(s.id))
            .map((s) => (
              <span key={s.id} className="chip inline-flex items-center gap-1 border border-line text-mute">
                <button className="hover:text-ink" onClick={() => toggleSet(s.id)}>
                  + {s.name}
                </button>
                <button className="text-dim hover:text-acc" title="Tạo bản sao để chỉnh" onClick={() => cloneSet(s.id)}>
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-acc" onClick={() => st.setPage("storyboard")}>
          Tiếp: Phân cảnh <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {edit && editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-8" onClick={() => setEdit(null)}>
          <div className="card flex h-[86vh] w-[min(1100px,92vw)] flex-col gap-3 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center">
              <h3 className="font-semibold">{edit.kind === "char" ? "Sửa nhân vật" : "Sửa bối cảnh"}</h3>
              <button className="btn ml-auto" onClick={() => setEdit(null)}>
                Xong
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {edit.kind === "char" ? <CharacterEditor spec={editing as CharacterSpec} library={library} /> : <SettingEditor spec={editing as SettingSpec} library={library} aspect={episode.aspect} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
