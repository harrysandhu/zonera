// Post-build: turn dist/index.html into an artifact-ready page.
// 1. Load React, ReactDOM and three from pinned CDN UMD builds (the bundle
//    references them as globals).
// 2. Strip the document skeleton; the artifact host supplies its own.
// 3. Make the inlined bundle a classic script placed after the CDN scripts.
import { readFileSync, writeFileSync } from "node:fs";

const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js",
];

let html = readFileSync("dist/index.html", "utf8");
const tags = CDN.map(src => `<script src="${src}"></script>`).join("\n");

// Pull the inlined app script out of <head> so it runs after #root exists.
const m = html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/) || html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error("inlined bundle not found");
const app = m[1];
html = html.replace(m[0], () => "");
html = html.replace("<!--CDN-->", "");
// Function replacements: the bundle contains `$&`/`$'` sequences that string replacements would expand.
html = html.replace("</body>", () => `${tags}\n<script id="zonera-app">${app}</script>\n</body>`);

// Full document for local use (dist/index.html), skeleton-free copy for the artifact.
writeFileSync("dist/index.html", html);
const inner = html
  .replace(/<!doctype html>/i, "")
  .replace(/<html[^>]*>/i, "")
  .replace(/<\/html>/i, "")
  .replace(/<head>/i, "")
  .replace(/<\/head>/i, "")
  .replace(/<body>/i, "")
  .replace(/<\/body>/i, "")
  .replace(/<meta charset="UTF-8" \/>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "")
  .trim();
writeFileSync("dist/artifact.html", inner);
console.log("artifact.html", (inner.length / 1024).toFixed(0) + "KB");
