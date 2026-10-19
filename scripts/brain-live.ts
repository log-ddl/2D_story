// Gọi CLI bộ não thật (mặc định agy) cho tập mẫu: đề xuất dàn + chia cảnh. Dùng: npx tsx scripts/brain-live.ts [agy|claude]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { applyCast, proposeCast, scopedLibrary, segmentScenes, type BrainRunner } from "../src/brain";
import { EXPRESSIONS, POSES } from "../src/engine/character";
import { Library } from "../src/engine/library";
import { DEMO_SCRIPT } from "../src/library/demo";
import { estimateAlignment } from "../src/pipeline/align";
import { scenesFromLlm } from "../src/pipeline/segment";
import { Episode, Project } from "../src/schema";

const cli = process.argv[2] ?? "agy";
const run: BrainRunner = async (prompt, schema) => {
  const t0 = Date.now();
  const args = cli === "agy" ? ["--output-format", "json", "--json-schema", schema, "-p", prompt] : ["-p", "--output-format", "json", "--json-schema", schema, "--tools", ""];
  const out = execFileSync(cli, args, { input: cli === "agy" ? undefined : prompt, cwd: "/tmp", maxBuffer: 1 << 26, encoding: "utf8" });
  const v = JSON.parse(out);
  console.log(`  ${cli}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (v.is_error || (v.status && v.status !== "SUCCESS")) throw new Error(JSON.stringify(v).slice(0, 300));
  return JSON.stringify(v.structured_output ?? JSON.parse(v.result ?? v.response));
};

const lib = new Library();
let project = Project.parse({ id: "p", name: "live" });
let ep = Episode.parse({ id: "e", title: "t", script_text: DEMO_SCRIPT, aspect: "16:9" });
console.log("1) đề xuất dàn nhân vật + bối cảnh");
const p = await proposeCast(run, DEMO_SCRIPT, lib, ep.aspect);
const r = applyCast(p, project, ep, lib);
project = r.project;
ep = r.episode;
console.log("  style:", ep.style);
console.log("  cast:", ep.cast.join(", "), "| tạo mới:", project.characters.map((c) => c.name).join(", "));
console.log("  sets:", ep.sets.join(", "), "| tạo mới:", project.settings.map((s) => s.name).join(", "));
const lib2 = new Library(project);
console.log("2) chia cảnh");
const al = estimateAlignment(DEMO_SCRIPT);
const raw = await segmentScenes(run, al.words, lib2, ep);
const { scenes, warnings } = scenesFromLlm(raw, al, 30, scopedLibrary(lib2, ep), Object.keys(POSES), Object.keys(EXPRESSIONS));
for (const s of scenes) console.log(`  ${s.id} ${s.duration.toFixed(1)}s ${s.beat.padEnd(9)} ${s.background.setting.padEnd(16)} [${s.characters.map((c) => `${c.character}:${c.pose}/${c.expression}`).join(", ")}] ${s.overlays.map((o) => `${o.style}:${o.text}`).join("|")} acts=${s.actions.map((a) => `${a.target}.${a.verb}${a.to ? ">" + a.to : ""}${a.value ? "=" + a.value : ""}`).join(",")} props=${s.props.map((p) => p.module).join(",")}`);
console.log(`  tổng hành động: ${scenes.reduce((n, s) => n + s.actions.length, 0)}`);
console.log("  cảnh báo:", warnings);
ep = { ...ep, alignment: al, scenes };
writeFileSync("out/brain-live.json", JSON.stringify({ project, episode: ep }, null, 1));
console.log("→ out/brain-live.json");
