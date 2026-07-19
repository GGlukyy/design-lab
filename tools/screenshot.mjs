// Playwright capture: screenshots every section at desktop + mobile,
// collects console errors/warnings. Usage:
//   node tools/screenshot.mjs [sectionId ...]   (default: all)
// Requires dev server running at localhost:5173 OR pass URL via LAB_URL.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.LAB_URL || "http://localhost:5173/";
const ONLY = process.argv.slice(2); // e.g. "s01"
const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 390, height: 844 },
];

mkdirSync("output", { recursive: true });

const consoleMsgs = [];
const browser = await chromium.launch({ args: ["--use-angle=default", "--enable-unsafe-swiftshader"] });

let failed = false;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      consoleMsgs.push(`[${vp.tag}][${m.type()}] ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => consoleMsgs.push(`[${vp.tag}][pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const sections = await page.$$eval(".lab-section", (els) =>
    els.map((el) => ({ id: el.id, mod: el.dataset.module || el.id }))
  );

  for (const s of sections) {
    if (ONLY.length && !ONLY.includes(s.id)) continue;
    await page.evaluate((id) => {
      document.getElementById(id).scrollIntoView({ behavior: "instant", block: "start" });
    }, s.id);
    await page.waitForTimeout(1700); // let module lazy-init + settle
    const num = s.mod.split("-")[0];
    const name = s.mod.slice(num.length + 1);
    const file = `output/${num}-${name}${vp.tag === "mobile" ? "-mobile" : ""}.png`;
    await page.screenshot({ path: file });
    process.stdout.write(`✓ ${file}\n`);
  }
  await page.close();
}

await browser.close();

if (consoleMsgs.length) {
  console.error("\n─── CONSOLE ISSUES ───");
  for (const m of consoleMsgs) console.error(m);
  failed = consoleMsgs.some((m) => m.includes("[error]") || m.includes("[pageerror]"));
}
console.log(failed ? "\nRESULT: FAIL (console errors)" : "\nRESULT: PASS");
process.exit(failed ? 1 : 0);
