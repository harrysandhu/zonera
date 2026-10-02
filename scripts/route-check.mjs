// Prints which skill each prompt routes to. Usage:
//   node scripts/route-check.mjs "Prompt one" "Prompt two"
//   node scripts/route-check.mjs            (every skill's examples, plus scripts/prompts.txt: "prompt" must
//                                            not fall back, "prompt => skill.id" must route to that skill)
import { build } from "esbuild";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const out = "node_modules/.cache/route-check.mjs";
mkdirSync("node_modules/.cache", { recursive: true });
const entry = `
import { route, SKILLS, fallback } from "./src/agent/skills/index.ts";
import { parse } from "./src/agent/parse.ts";
export { route, SKILLS, parse };
export const fallbackId = fallback.id;
`;
writeFileSync("node_modules/.cache/route-entry.ts", entry.replace(/\.\/src/g, "../../src"));
await build({
  entryPoints: ["node_modules/.cache/route-entry.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  loader: { ".css": "empty", ".png": "empty", ".jpg": "empty", ".webp": "empty" },
  jsx: "transform",
  logLevel: "error",
  define: { "import.meta.env.DEV": "false" },
});
globalThis.window = globalThis.window ?? { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, __ZONERA_IMG: {} };
globalThis.document = globalThis.document ?? { querySelector: () => null, documentElement: { setAttribute() {}, removeAttribute() {} } };
globalThis.location = globalThis.location ?? { hash: "" };
globalThis.history = globalThis.history ?? { replaceState() {} };
const m = await import(pathToFileURL(out).href + "?" + Date.now());
let prompts = process.argv.slice(2);
if (!prompts.length) {
  prompts = m.SKILLS.flatMap(s => s.examples.map(e => ({ e, want: s.id })));
  if (existsSync("scripts/prompts.txt")) prompts.push(...readFileSync("scripts/prompts.txt", "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")).map(l => { const [e, want] = l.split(" => "); return { e, want: want ?? "*" }; }));
} else prompts = prompts.map(e => ({ e }));
let bad = 0;
for (const { e, want } of prompts) {
  const { skill, score } = m.route(m.parse(e, []));
  const ok = !want ? true : want === "*" ? skill.id !== m.fallbackId : want === skill.id;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${skill.id.padEnd(24)} ${String(score).padStart(2)}  ${e}${ok ? "" : `   (want ${want})`}`);
}
console.log(bad ? `\n${bad} misrouted` : "\nall routed");
process.exit(bad ? 1 : 0);
