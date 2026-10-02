// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [darkScheme]
import { chromium } from "playwright";
const [url, out, w = "1440", h = "900", wait = "2500", dark = ""] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: dark ? "dark" : "light" });
const logs = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text()); });
page.on("pageerror", e => logs.push("pageerror: " + e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out, fullPage: !!process.env.FULL });
console.log(logs.slice(0, 15).join("\n") || "no console errors");
await browser.close();
