// Serves dist/ under a subpath (simulating a GitHub Pages project site or an
// itch.io upload) and checks the production build for console errors.
// Usage: node tools/verify-dist.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "playwright";

const SUBPATH = "/design-lab";
const PORT = 4178;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (!p.startsWith(SUBPATH)) { res.writeHead(404).end("not found"); return; }
  p = p.slice(SUBPATH.length) || "/";
  if (p === "/") p = "/index.html";
  try {
    const body = await readFile(join("dist", p));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ args: ["--use-angle=default", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`[error] ${m.text()}`));
page.on("requestfailed", (r) => errors.push(`[404?] ${r.url()}`));

await page.goto(`http://localhost:${PORT}${SUBPATH}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// walk every section so each module lazy-inits under the production bundle
const ids = await page.$$eval(".lab-section", (els) => els.map((e) => e.id));
for (const id of ids) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: "instant" }), id);
  await page.waitForTimeout(900);
}
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: "output/qa-dist-subpath.png" });

console.log(`sections initialised: ${ids.length}`);
console.log(errors.length ? `FAIL:\n${errors.join("\n")}` : "PASS — production build clean on a subpath");

await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
