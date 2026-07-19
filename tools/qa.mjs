// QA pass: (a) reduced-motion render check, (b) per-section FPS probe.
// Usage: node tools/qa.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.LAB_URL || "http://localhost:5173/";
mkdirSync("output", { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=default", "--enable-unsafe-swiftshader"] });

// ── reduced motion ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  const ids = await page.$$eval(".lab-section", (els) => els.map((el) => el.id));
  for (const id of ids) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: "instant" }), id);
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "output/qa-reduced-motion.png" });
  console.log(errors.length ? `reduced-motion ERRORS:\n${errors.join("\n")}` : "reduced-motion: PASS (no console errors)");
  await page.close();
}

// ── fps probe per section ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: "networkidle" });
  const ids = await page.$$eval(".lab-section", (els) => els.map((el) => el.id));
  console.log("\nFPS probe (2s per section, headless — treat as lower bound):");
  for (const id of ids) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: "instant" }), id);
    await page.waitForTimeout(900); // init
    const { fps, worst } = await page.evaluate(
      () =>
        new Promise((res) => {
          const deltas = [];
          let last = performance.now(), n = 0;
          function tick(t) {
            deltas.push(t - last);
            last = t;
            if (++n < 120) requestAnimationFrame(tick);
            else {
              deltas.shift();
              const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
              res({ fps: 1000 / avg, worst: Math.max(...deltas) });
            }
          }
          requestAnimationFrame(tick);
        })
    );
    console.log(`  ${id}: ${fps.toFixed(1)} fps avg · worst frame ${worst.toFixed(0)}ms`);
  }
  await page.close();
}

await browser.close();
