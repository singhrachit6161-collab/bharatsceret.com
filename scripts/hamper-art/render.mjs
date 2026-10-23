// Renders the sources from gen.py to PNG with Chromium (playwright-core).
// Usage: node scripts/hamper-art/render.mjs <srcdir> <pngdir>
// Env: PLAYWRIGHT_CORE (module path, optional), CHROMIUM (executable path, optional)
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [src, out] = process.argv.slice(2).map((p) => resolve(p));
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });

const jobs = [
  { file: "hero.html", w: 1600, h: 1000, scale: 1.25, png: "hero.png" },
  { file: "gift-card.svg", w: 1000, h: 640, scale: 1.5, png: "gift-card.png" },
  ...[1, 2, 3].map((n) => ({ file: `step-${n}.svg`, w: 400, h: 400, scale: 1.5, png: `step-${n}.png`, transparent: true })),
];
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale });
  await page.goto(pathToFileURL(join(src, j.file)).href);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, j.png), omitBackground: Boolean(j.transparent) });
  await page.close();
  console.log("rendered", j.png);
}
await browser.close();
