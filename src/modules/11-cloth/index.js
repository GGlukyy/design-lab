// 11 — Cloth. Verlet integration + distance constraints, written from scratch.
// Wind, pointer grab, and tear when a constraint overstretches. Canvas 2D render:
// wireframe over a subtle shaded fill.

const COLS = 42, ROWS = 24;
const ITER = 3;
const TEAR_RATIO = 3.4;

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter)*-0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">verlet · ${COLS}×${ROWS} nodes · drag to pull · pull hard to tear</p>
  <button class="cloth-reset" data-interactive style="all:unset;cursor:pointer;position:absolute;bottom:calc(var(--gutter)*-0.4);right:0;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label);color:var(--accent);border:1px solid var(--accent-dim);padding:0.6em 1.4em">RESET ↺</button>`;

  if (reducedMotion) {
    layer.style.background =
      "repeating-linear-gradient(0deg, transparent 0 34px, rgba(51,255,153,0.08) 34px 35px)," +
      "repeating-linear-gradient(90deg, transparent 0 34px, rgba(51,255,153,0.08) 34px 35px), #0a0a0c";
    return {};
  }

  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  layer.style.touchAction = "none";
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio, 1.5);

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = layer.clientWidth * dpr;
    H = canvas.height = layer.clientHeight * dpr;
  }
  resize();

  // ── cloth state ──
  let pts, cons, spacing;
  function build() {
    spacing = Math.min((W * 0.72) / (COLS - 1), (H * 0.62) / (ROWS - 1));
    const ox = (W - spacing * (COLS - 1)) / 2;
    const oy = H * 0.12;
    pts = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        pts.push({
          x: ox + x * spacing, y: oy + y * spacing,
          px: ox + x * spacing, py: oy + y * spacing,
          pin: y === 0 && x % 3 === 0, // every 3rd top node pinned
        });
      }
    }
    cons = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (x < COLS - 1) cons.push({ a: i, b: i + 1, len: spacing, dead: false });
        if (y < ROWS - 1) cons.push({ a: i, b: i + COLS, len: spacing, dead: false });
      }
    }
  }
  build();
  content.querySelector(".cloth-reset").addEventListener("click", () => {
    mdown = false; grab = -1;
    build();
  });

  // ── pointer grab ──
  let grab = -1, mx = 0, my = 0, mdown = false;
  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * dpr;
    my = (e.clientY - r.top) * dpr;
  }
  function down(e) {
    toLocal(e);
    // capture so pointerup always reaches us, even released outside the window —
    // otherwise the grab sticks and the cloth keeps shredding "on its own"
    layer.setPointerCapture?.(e.pointerId);
    mdown = true;
    grab = -1;
    let best = 50 * dpr * 50 * dpr;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].pin) continue;
      const d = (pts[i].x - mx) ** 2 + (pts[i].y - my) ** 2;
      if (d < best) { best = d; grab = i; }
    }
  }
  function move(e) { toLocal(e); }
  function up() { mdown = false; grab = -1; }
  layer.addEventListener("pointerdown", down);
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerup", up, { passive: true });
  addEventListener("pointercancel", up, { passive: true });
  addEventListener("blur", up);

  let raf = 0, running = true, t = 0;
  function step() {
    raf = requestAnimationFrame(step);
    t += 1 / 60;

    // integrate (verlet)
    const windX = (Math.sin(t * 0.7) * 0.35 + Math.sin(t * 1.9) * 0.15) * dpr;
    const windZ = Math.sin(t * 1.3);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.pin) continue;
      const col = i % COLS;
      const vx = (p.x - p.px) * 0.985;
      const vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y;
      p.x += vx + windX * (0.5 + 0.5 * Math.sin(col * 0.3 + t * 2.1)) * (0.6 + 0.4 * windZ);
      p.y += vy + 0.16 * dpr; // gravity
    }

    // grabbed node eases toward the pointer with a capped step — no teleporting,
    // so fast mouse moves stretch the cloth instead of detonating it. Tearing
    // happens only through the natural overstretch check in the solver below.
    if (mdown && grab >= 0) {
      const g = pts[grab];
      const dx = mx - g.x, dy = my - g.y;
      const d = Math.hypot(dx, dy);
      const maxStep = spacing * 0.9;
      const f = d > maxStep ? maxStep / d : 1;
      g.x += dx * f; g.y += dy * f;
      g.px = g.x; g.py = g.y;
    }

    // satisfy constraints + tear on overstretch
    for (let k = 0; k < ITER; k++) {
      for (const c of cons) {
        if (c.dead) continue;
        const A = pts[c.a], B = pts[c.b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1e-5;
        if (d > c.len * TEAR_RATIO) { c.dead = true; continue; }
        const diff = (d - c.len) / d * 0.5;
        const ox = dx * diff, oy = dy * diff;
        if (!A.pin) { A.x += ox; A.y += oy; }
        if (!B.pin) { B.x -= ox; B.y -= oy; }
      }
    }

    // ── render ──
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);

    // shaded fill: quads tinted by vertical stretch (fake normal/light)
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 0; x < COLS - 1; x++) {
        const i = y * COLS + x;
        const a = pts[i], b = pts[i + 1], c2 = pts[i + COLS + 1], d2 = pts[i + COLS];
        // skip torn cells via stretch test (cheaper than constraint lookup)
        const sx = Math.hypot(b.x - a.x, b.y - a.y);
        const sy = Math.hypot(d2.x - a.x, d2.y - a.y);
        if (sx > spacing * TEAR_RATIO || sy > spacing * TEAR_RATIO) continue;
        const stretch = (sx + sy) / (2 * spacing);
        const lum = Math.max(0, Math.min(1, 1.35 - stretch));
        ctx.fillStyle = `rgba(51, 255, 153, ${(0.04 + lum * 0.09).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // wireframe
    ctx.strokeStyle = "rgba(51,255,153,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of cons) {
      if (c.dead) continue;
      ctx.moveTo(pts[c.a].x, pts[c.a].y);
      ctx.lineTo(pts[c.b].x, pts[c.b].y);
    }
    ctx.stroke();

    // pins
    ctx.fillStyle = "#33ff99";
    for (const p of pts) {
      if (p.pin) ctx.fillRect(p.x - 2 * dpr, p.y - 2 * dpr, 4 * dpr, 4 * dpr);
    }
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(() => { resize(); build(); });
  ro.observe(layer);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      layer.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      removeEventListener("blur", up);
      canvas.remove();
    },
  };
}
