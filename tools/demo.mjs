// Records a scroll-through of the lab to output/demo.webm via Playwright video.
import { chromium } from "playwright";
import { mkdirSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.LAB_URL || "http://localhost:5173/";
mkdirSync("output/.video", { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=default", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: "output/.video", size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let hero fluid develop

// wiggle the pointer over the hero, then glide down the page
await page.mouse.move(400, 400);
for (let i = 0; i < 30; i++) {
  await page.mouse.move(
    640 + Math.sin(i * 0.4) * 380,
    360 + Math.cos(i * 0.31) * 220,
    { steps: 4 }
  );
  await page.waitForTimeout(50);
}

const total = await page.evaluate(() => document.body.scrollHeight - innerHeight);
const STEPS = 380;
for (let i = 0; i <= STEPS; i++) {
  // ease in/out overall glide
  const t = i / STEPS;
  const y = total * (t * t * (3 - 2 * t));
  await page.evaluate((v) => scrollTo(0, v), y);
  if (i % 40 === 20) {
    await page.mouse.move(500 + (i % 80) * 6, 400, { steps: 3 });
  }
  await page.waitForTimeout(38);
}
await page.waitForTimeout(2000);

await ctx.close();
await browser.close();

const vid = readdirSync("output/.video").find((f) => f.endsWith(".webm"));
renameSync(join("output/.video", vid), "output/demo.webm");
console.log("saved output/demo.webm");
