// Build release/zonera-demo.html: one file that runs offline from disk.
// Inlines React, ReactDOM and three (scripts/vendor) and every image as a data URI.
// Run after `vite build` (needs dist/index.html from vite + artifactize).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const vendor = ["react.production.min.js", "react-dom.production.min.js", "three.min.js"].map(f => readFileSync(join("scripts/vendor", f), "utf8"));
let html = readFileSync("dist/index.html", "utf8");

// Swap the CDN tags for inline copies, in order.
html = html.replace(/<script src="https:\/\/[^"]+"><\/script>\n?/g, () => "");
const libs = vendor.map(v => `<script>${v.replace(/<\/script/gi, "<\\/script")}</script>`).join("\n");

// Images → data URIs, exposed to the app through window.__ZONERA_IMG.
const imgs = {};
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(webp|png|jpg)$/.test(f)) {
      const rel = p.replace(/^public\//, "");
      imgs[rel] = `data:image/${f.split(".").pop()};base64,` + readFileSync(p).toString("base64");
    }
  }
}
walk("public/img");
const map = `<script>window.__ZONERA_IMG=${JSON.stringify(imgs)};</script>`;

// Libraries and the image map must run before the app script at the end of <body>.
const appStart = html.indexOf('<script id="zonera-app">');
if (appStart < 0) throw new Error("app script marker not found");
html = html.slice(0, appStart) + map + "\n" + libs + "\n" + html.slice(appStart);

mkdirSync("release", { recursive: true });
writeFileSync("release/zonera-demo.html", html);
console.log("release/zonera-demo.html", (html.length / 1024 / 1024).toFixed(2) + " MB", Object.keys(imgs).length, "images");

// Skeleton-free copy for the artifact host (it supplies <html>/<head>/<body>).
const inner = html
  .replace(/<!doctype html>/i, () => "")
  .replace(/<html[^>]*>/i, () => "")
  .replace(/<\/html>/i, () => "")
  .replace(/<head>/i, () => "")
  .replace(/<\/head>/i, () => "")
  .replace(/<body>/i, () => "")
  .replace(/<\/body>/i, () => "")
  .replace(/<meta charset="UTF-8" \/>/i, () => "")
  .replace(/<meta name="viewport"[^>]*>/i, () => "")
  .trim();
writeFileSync("release/zonera-artifact.html", inner);
