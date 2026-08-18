// 07 — Kinetic typography. Text on a curved SVG path, per-character cursor
// proximity reaction, and a canvas marquee whose speed follows scroll velocity.

const ARC_TEXT = "TYPE IN MOTION — PRECISION OVER DECORATION — ";
const PROX_TEXT = "PROXIMITY";
const MARQUEE = "DESIGN LAB · WEBGL · GLSL · CANVAS · SPRINGS · NOISE · ";

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");
  content.innerHTML = `
    <svg class="arc" viewBox="0 0 1000 300" style="width:100%;overflow:visible" aria-hidden="true">
      <defs>
        <path id="arcPath" d="M 40 260 Q 500 -60 960 260" fill="none"/>
      </defs>
      <text style="font-family:var(--font-mono);font-size:30px;letter-spacing:0.35em;fill:var(--ink-dim)">
        <textPath href="#arcPath" class="arc-tp" startOffset="0%">${ARC_TEXT}${ARC_TEXT}</textPath>
      </text>
    </svg>
    <div class="prox" data-interactive style="display:flex;justify-content:center;gap:0.02em;cursor:default;user-select:none;margin:2rem 0 3.5rem">
      ${[...PROX_TEXT].map((ch) =>
        `<span style="display:inline-block;font-size:var(--fs-hero);font-weight:800;letter-spacing:-0.02em;will-change:transform;transition:color 0.2s">${ch}</span>`
      ).join("")}
    </div>
    <canvas class="marquee" height="90" style="width:calc(100% + var(--gutter)*2);margin-inline:calc(var(--gutter)*-1);display:block"></canvas>
    <p class="mono-note" style="margin-top:1.5rem">marquee speed ∝ scroll velocity · characters react to cursor distance</p>`;

  const spans = [...content.querySelectorAll(".prox span")];
  const marquee = content.querySelector(".marquee");
  const arcTp = content.querySelector(".arc-tp");
  const mctx = marquee.getContext("2d");

  if (reducedMotion) return {};

  // ── per-char proximity ──
  let mx = -9999, my = -9999;
  function onMove(e) { mx = e.clientX; my = e.clientY; }
  function onLeave() { mx = -9999; my = -9999; }
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", onLeave);

  // ── scroll velocity signal ──
  let lastScroll = scrollY, scrollVel = 0;

  // ── marquee state ──
  let offset = 0;
  const dpr = Math.min(devicePixelRatio, 2);
  function sizeMarquee() {
    marquee.width = marquee.clientWidth * dpr;
    marquee.height = 90 * dpr;
  }
  sizeMarquee();

  let raf = 0, running = true, last = performance.now(), arcOff = 0;
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.max(Math.min((now - last) / 1000, 1 / 30), 0);
    last = now;

    // scroll velocity (px/s), smoothed
    const sv = (scrollY - lastScroll) / Math.max(dt, 1e-4);
    lastScroll = scrollY;
    scrollVel += (sv - scrollVel) * 0.08;

    // characters
    for (const s of spans) {
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(mx - cx, my - cy);
      const p = Math.max(0, 1 - d / 260);
      const e = p * p;
      const dir = cx < mx ? -1 : 1;
      s.style.transform =
        `translateY(${-e * 34}px) rotate(${dir * e * 9}deg) scale(${1 + e * 0.22})`;
      s.style.color = e > 0.25 ? "var(--accent)" : "var(--ink)";
    }

    // arc drift + slight scroll response
    arcOff = (arcOff + dt * (1.2 + Math.min(Math.abs(scrollVel) * 0.004, 4))) % 50;
    arcTp.setAttribute("startOffset", `${-Math.abs(arcOff)}%`);

    // marquee canvas
    const W = marquee.width, H = marquee.height;
    mctx.clearRect(0, 0, W, H);
    mctx.font = `800 ${54 * dpr}px Inter, "Segoe UI", sans-serif`;
    const tw = mctx.measureText(MARQUEE).width;
    const speed = (60 + Math.min(Math.abs(scrollVel), 2600) * 0.55) * (scrollVel < 0 ? -1 : 1);
    offset = (offset - speed * dt * dpr) % tw;
    const hot = Math.min(Math.abs(scrollVel) / 1800, 1);
    mctx.fillStyle = `rgba(${51 + 180 * (1 - hot)}, ${255}, ${153 + 70 * (1 - hot)}, ${0.16 + hot * 0.75})`;
    for (let x = offset - tw; x < W + tw; x += tw) {
      mctx.fillText(MARQUEE, x, H * 0.72);
    }
    // baseline rule
    mctx.fillStyle = "rgba(51,255,153,0.25)";
    mctx.fillRect(0, H - 2 * dpr, W, 1 * dpr);
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(sizeMarquee);
  ro.observe(marquee);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; last = performance.now(); lastScroll = scrollY; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    },
  };
}
