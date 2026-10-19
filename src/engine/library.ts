import type { CharacterSpec, Project, SettingSpec } from "../schema";
import { BUILTIN_CHARACTERS } from "../library/characters";
import { BUILTIN_MODULES, type ModuleDef } from "../library/modules";
import { BUILTIN_SETTINGS } from "../library/settings";
import { compileModule, type SvgModule } from "./svg";

const builtinCache = new Map<string, SvgModule>();

/** Thư viện = module/bối cảnh/nhân vật có sẵn + phần riêng của dự án (ghi đè theo id) */
export class Library {
  readonly moduleDefs: ModuleDef[];
  readonly settings: Map<string, SettingSpec>;
  readonly characters: Map<string, CharacterSpec>;
  private compiled = new Map<string, SvgModule>();
  private failed = new Set<string>();

  constructor(project?: Pick<Project, "modules" | "settings" | "characters"> | null) {
    const projMods: ModuleDef[] = (project?.modules ?? [])
      .filter((m) => m.status === "approved")
      .map((m) => ({ id: m.id, label: m.id, kind: m.kind, tags: m.tags, svg: m.svg }));
    const ids = new Set(projMods.map((m) => m.id));
    this.moduleDefs = [...BUILTIN_MODULES.filter((m) => !ids.has(m.id)), ...projMods];
    for (const m of project?.modules ?? []) {
      if (m.status !== "approved") continue;
      try {
        this.compiled.set(m.id, compileModule(m.id, m.svg, m.anchor));
      } catch {
        this.failed.add(m.id);
      }
    }
    this.settings = new Map(BUILTIN_SETTINGS.map((s) => [s.id, s]));
    for (const s of project?.settings ?? []) this.settings.set(s.id, s);
    this.characters = new Map(BUILTIN_CHARACTERS.map((c) => [c.id, c]));
    for (const c of project?.characters ?? []) this.characters.set(c.id, c);
  }

  getModule = (id: string): SvgModule | undefined => {
    const own = this.compiled.get(id);
    if (own) return own;
    if (this.failed.has(id)) return undefined;
    let m = builtinCache.get(id);
    if (!m) {
      const def = BUILTIN_MODULES.find((d) => d.id === id);
      if (!def) return undefined;
      try {
        m = compileModule(def.id, def.svg);
      } catch {
        this.failed.add(id);
        return undefined;
      }
      builtinCache.set(id, m);
    }
    return m;
  };

  getSetting(id: string): SettingSpec {
    return this.settings.get(id) ?? this.settings.get("title_card")!;
  }

  getCharacter(id: string): CharacterSpec | undefined {
    return this.characters.get(id);
  }
}
