// 04 — Magnetic + elastic. Damped-spring cursor attraction on buttons/cards,
// plus an elastic SVG divider whose control point snaps back with oscillation.

const BTNS = [
  ["EXECUTE", "run current patch"],
  ["ARCHIVE", "store to tape"],
  ["TRANSMIT", "broadcast signal"],
];

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");
  content.innerHTML = `
    <h2 class="h-section">Magnet<span style="color:var(--accent)">/</span>Spring</h2>
    <p class="mono-note" style="margin-bottom:3rem">Damped springs, semi-implicit Euler. No tween library — every frame integrates force toward the cursor.</p>
    <svg class="elastic-line" width="100%" height="120" style="display:block;overflow:visible;margin-bottom:3rem" aria-hidden="true">
      <path fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.85"/>
    </svg>
    <div class="mag-row" style="display:flex;gap:2.5rem;flex-wrap:wrap">
      ${BTNS.map(
        ([label, sub]) => `
        <button class="mag-btn" data-interactive style="
          all:unset;cursor:pointer;padding:1.4rem 2.6rem;border:1px solid var(--line-strong);
          font-family:var(--font-mono);letter-spacing:0.15em;font-size:0.85rem;color:var(--ink);
          background:var(--bg-raise);position:relative;will-change:transform">
          <span style="color:var(--accent);margin-right:0.7em">■</span>${label}
          <div style="font-size:0.62rem;color:var(--ink-dim);letter-spacing:0.1em;margin-top:0.5em">${sub}</div>
        </button>`
      ).join("")}
    </div>`;

  if (reducedMotion) {
    const path = content.querySelector(".elastic-line path");
    const w = content.querySelector(".elastic-line").clientWidth || 800;
    path.setAttribute("d", `M 0 60 L ${w} 60`);
    return {};
  }

  // ── magnetic buttons: spring integrator ──
  const buttons = [...content.querySelectorAll(".mag-btn")].map((el) => ({
    el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
  }));

  const RADIUS = 160, STIFF = 90, DAMP = 14;
  let mouse = { x: -9999, y: -9999 };
  function onMove(e) { mouse = { x: e.clientX, y: e.clientY }; }
  function onLeave() { mouse = { x: -9999, y: -9999 }; }
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", onLeave);

  // ── elastic svg divider ──
  const svg = content.querySelector(".elastic-line");
  const path = svg.querySelector("path");
  const line = { y: 0, vy: 0, target: 0 }; // control point offset from rest
  let lineHot = false;
  function lineMove(e) {
    const r = svg.getBoundingClientRect();
    if (e.clientY > r.top - 40 && e.clientY < r.bottom + 40 &&
        e.clientX > r.left && e.clientX < r.right) {
      line.target = (e.clientY - (r.top + r.height / 2)) * 1.6;
      line.target = Math.max(-90, Math.min(90, line.target));
      lineHot = true;
    } else {
      lineHot = false;
    }
  }
  addEventListener("pointermove", lineMove, { passive: true });

  let raf = 0, running = true, last = performance.now();
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    for (const b of buttons) {
      const r = b.el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = mouse.x - cx, dy = mouse.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < RADIUS) {
        const pull = 1 - dist / RADIUS;
        b.tx = dx * pull * 0.42;
        b.ty = dy * pull * 0.42;
      } else {
        b.tx = 0; b.ty = 0;
      }
      // semi-implicit Euler spring toward target
      b.vx += (STIFF * (b.tx - b.x) - DAMP * b.vx) * dt;
      b.vy += (STIFF * (b.ty - b.y) - DAMP * b.vy) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.el.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0)`;
      b.el.style.borderColor = b.tx || b.ty ? "var(--accent)" : "var(--line-strong)";
    }

    // elastic line: pulled while hot, springs free otherwise (underdamped)
    const target = lineHot ? line.target : 0;
    const k = lineHot ? 160 : 120, c = lineHot ? 22 : 6; // low damping when released = wobble
    line.vy += (k * (target - line.y) - c * line.vy) * dt;
    line.y += line.vy * dt;
    const w = svg.clientWidth || 800;
    const mid = 60 + line.y;
    path.setAttribute("d", `M 0 60 Q ${w / 2} ${mid * 2 - 60} ${w} 60`);

    // idle everything settled? keep running (cheap) — section pauses off-screen anyway
  }
  raf = requestAnimationFrame(step);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      removeEventListener("pointermove", lineMove);
    },
  };
}
