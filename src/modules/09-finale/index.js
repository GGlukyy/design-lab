// 09 — Generative finale. 2D canvas flow field seeded by time of day;
// particle trails, gentle pointer repulsion. Doubles as footer background.

const COUNT = 1400;

// layered value noise
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const a = perm[perm[X] + Y] / 255, b = perm[perm[X + 1] + Y] / 255;
    const c = perm[perm[X] + Y + 1] / 255, d = perm[perm[X + 1] + Y + 1] / 255;
    const u = fade(fx), v = fade(fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return (x, y) => noise2(x, y) * 0.7 + noise2(x * 2.7, y * 2.7) * 0.3;
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const baseAngle = (hour / 24) * Math.PI * 2; // field rotates through the day
  const seedLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2.2rem">
      <h2 class="h-section">End of<br/>Transmission</h2>
      <p class="mono-note">flow field seeded ${seedLabel} · field angle ${(baseAngle * 57.3).toFixed(0)}° · regenerates with the clock</p>
      <div style="display:flex;gap:2.5rem;flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label)">
        <a data-interactive href="https://github.com/GGlukyy" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-dim);padding-bottom:0.4em">GITHUB ↗</a>
        <a data-interactive href="https://ggluki.itch.io/" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-dim);padding-bottom:0.4em">ITCH.IO ↗</a>
        <a data-interactive href="mailto:luki.lokvenc@gmail.com" style="color:var(--ink-dim);text-decoration:none;border-bottom:1px solid var(--line);padding-bottom:0.4em">MAIL ↗</a>
        <a data-interactive href="#s01" style="color:var(--ink-dim);text-decoration:none;border-bottom:1px solid var(--line);padding-bottom:0.4em">RESTART ↺</a>
      </div>
    </div>`;

  if (reducedMotion) {
    layer.style.background =
      "radial-gradient(80% 60% at 70% 40%, rgba(51,255,153,0.09), transparent 65%), #0a0a0c";
    return {};
  }

  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const noise = makeNoise((now.getHours() * 60 + now.getMinutes()) * 7919 + 1);

  let W = 0, H = 0;
  const dpr = Math.min(devicePixelRatio, 1.5);
  function resize() {
    W = canvas.width = layer.clientWidth * dpr;
    H = canvas.height = layer.clientHeight * dpr;
    // canvas stays transparent — the section's #0a0a0c shows through, so the
    // background is genuinely black instead of accumulated trail residue
  }
  resize();

  const parts = new Float32Array(COUNT * 4); // x, y, px, py
  function respawn(i) {
    parts[i * 4] = Math.random() * W;
    parts[i * 4 + 1] = Math.random() * H;
    parts[i * 4 + 2] = parts[i * 4];
    parts[i * 4 + 3] = parts[i * 4 + 1];
  }
  for (let i = 0; i < COUNT; i++) respawn(i);

  let mx = -9999, my = -9999;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * dpr;
    my = (e.clientY - r.top) * dpr;
  }
  function onLeave() { mx = -9999; my = -9999; }
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", onLeave);

  let raf = 0, running = true, t = 0;
  function step() {
    raf = requestAnimationFrame(step);
    t += 0.004;

    // trail fade: destination-out erases alpha, so old strokes decay to fully
    // transparent instead of leaving a gray-green residue floor
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    ctx.lineWidth = 1 * dpr;
    for (let i = 0; i < COUNT; i++) {
      let x = parts[i * 4], y = parts[i * 4 + 1];
      const n = noise(x / (340 * dpr) + t, y / (340 * dpr) - t * 0.6);
      const a = baseAngle + n * Math.PI * 3.2;
      let vx = Math.cos(a) * 1.15 * dpr;
      let vy = Math.sin(a) * 1.15 * dpr;
      // pointer repulsion
      const dx = x - mx, dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22000 * dpr * dpr) {
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / (150 * dpr)) * 3.2 * dpr;
        vx += (dx / d) * f;
        vy += (dy / d) * f;
      }
      const nx = x + vx, ny = y + vy;
      const speedGlow = Math.min((Math.abs(vx) + Math.abs(vy)) / (3 * dpr), 1);
      ctx.strokeStyle = `rgba(${40 + speedGlow * 60}, ${190 + speedGlow * 65}, ${120 + speedGlow * 33}, ${0.16 + speedGlow * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      parts[i * 4] = nx;
      parts[i * 4 + 1] = ny;
      if (nx < -5 || nx > W + 5 || ny < -5 || ny > H + 5 || Math.random() < 0.001) respawn(i);
    }
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(resize);
  ro.observe(layer);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      canvas.remove();
    },
  };
}
