// 14 — Boids. Separation / alignment / cohesion flocking with a spatial hash
// grid; ~300 triangle agents with motion trails; the pointer is a predator.

const N = 300;
const VIEW = 58;       // neighbor radius (css px)
const SEP = 22;
const MAX_SPEED = 2.6;
const MAX_FORCE = 0.055;
const PREDATOR_R = 150;

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter)*-0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">${N} agents · separation / alignment / cohesion · spatial hash ${VIEW}px cells · pointer = predator</p>`;

  if (reducedMotion) {
    layer.style.background =
      "radial-gradient(30% 30% at 30% 40%, rgba(51,255,153,0.1), transparent 70%)," +
      "radial-gradient(26% 26% at 68% 60%, rgba(51,255,153,0.08), transparent 70%), #0a0a0c";
    return {};
  }

  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio, 1.5);

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = layer.clientWidth * dpr;
    H = canvas.height = layer.clientHeight * dpr;
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);
  }
  resize();

  // agents: x, y, vx, vy
  const b = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    b[i * 4] = Math.random() * W;
    b[i * 4 + 1] = Math.random() * H;
    const a = Math.random() * Math.PI * 2;
    b[i * 4 + 2] = Math.cos(a) * MAX_SPEED * 0.7;
    b[i * 4 + 3] = Math.sin(a) * MAX_SPEED * 0.7;
  }

  let mx = -9999, my = -9999;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) * dpr;
    my = (e.clientY - r.top) * dpr;
  }
  function onLeave() { mx = -9999; my = -9999; }
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", onLeave);

  // spatial hash rebuilt per frame
  const cell = VIEW * dpr;
  const grid = new Map();
  const key = (cx, cy) => cx * 100000 + cy;

  let raf = 0, running = true;
  function step() {
    raf = requestAnimationFrame(step);
    const view2 = (VIEW * dpr) ** 2, sep2 = (SEP * dpr) ** 2, pred2 = (PREDATOR_R * dpr) ** 2;

    grid.clear();
    for (let i = 0; i < N; i++) {
      const k = key((b[i * 4] / cell) | 0, (b[i * 4 + 1] / cell) | 0);
      const arr = grid.get(k);
      arr ? arr.push(i) : grid.set(k, [i]);
    }

    for (let i = 0; i < N; i++) {
      const x = b[i * 4], y = b[i * 4 + 1], vx = b[i * 4 + 2], vy = b[i * 4 + 3];
      let cohX = 0, cohY = 0, aliX = 0, aliY = 0, sepX = 0, sepY = 0, n = 0;
      const cx = (x / cell) | 0, cy = (y / cell) | 0;
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const bucket = grid.get(key(gx, gy));
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const dx = b[j * 4] - x, dy = b[j * 4 + 1] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > view2) continue;
            cohX += b[j * 4]; cohY += b[j * 4 + 1];
            aliX += b[j * 4 + 2]; aliY += b[j * 4 + 3];
            if (d2 < sep2) {
              const inv = 1 / (d2 + 1);
              sepX -= dx * inv; sepY -= dy * inv;
            }
            n++;
          }
        }
      }

      let fx = 0, fy = 0;
      const steer = (tx, ty, w) => {
        const m = Math.hypot(tx, ty);
        if (m < 1e-5) return;
        const sx = (tx / m) * MAX_SPEED - vx, sy = (ty / m) * MAX_SPEED - vy;
        const sm = Math.hypot(sx, sy) || 1;
        const lim = Math.min(sm, MAX_FORCE * dpr) / sm;
        fx += sx * lim * w; fy += sy * lim * w;
      };
      if (n > 0) {
        steer(cohX / n - x, cohY / n - y, 0.65);      // cohesion
        steer(aliX / n, aliY / n, 0.75);              // alignment
        steer(sepX, sepY, 1.5);                       // separation
      }
      // predator flee
      const pdx = x - mx, pdy = y - my;
      const pd2 = pdx * pdx + pdy * pdy;
      if (pd2 < pred2) {
        steer(pdx, pdy, 2.6 * (1 - pd2 / pred2));
      }
      // soft wall avoidance
      const M = 60 * dpr;
      if (x < M) fx += MAX_FORCE * dpr * 1.8;
      if (x > W - M) fx -= MAX_FORCE * dpr * 1.8;
      if (y < M) fy += MAX_FORCE * dpr * 1.8;
      if (y > H - M) fy -= MAX_FORCE * dpr * 1.8;

      let nvx = vx + fx, nvy = vy + fy;
      const sp = Math.hypot(nvx, nvy) || 1;
      const clamped = Math.max(Math.min(sp, MAX_SPEED * dpr), MAX_SPEED * dpr * 0.45);
      nvx = (nvx / sp) * clamped; nvy = (nvy / sp) * clamped;
      b[i * 4] = (x + nvx + W) % W;
      b[i * 4 + 1] = (y + nvy + H) % H;
      b[i * 4 + 2] = nvx; b[i * 4 + 3] = nvy;
    }

    // ── render: fading trails + triangles ──
    ctx.fillStyle = "rgba(10,10,12,0.16)";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const x = b[i * 4], y = b[i * 4 + 1], vx = b[i * 4 + 2], vy = b[i * 4 + 3];
      const a = Math.atan2(vy, vx);
      const s = 4.6 * dpr;
      const flee = mx > -999 && ((x - mx) ** 2 + (y - my) ** 2) < pred2;
      ctx.fillStyle = flee ? "#7dffbe" : "rgba(51,255,153,0.75)";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 1.7, y + Math.sin(a) * s * 1.7);
      ctx.lineTo(x + Math.cos(a + 2.5) * s, y + Math.sin(a + 2.5) * s);
      ctx.lineTo(x + Math.cos(a - 2.5) * s, y + Math.sin(a - 2.5) * s);
      ctx.closePath();
      ctx.fill();
    }
    // predator marker
    if (mx > -999) {
      ctx.strokeStyle = "rgba(255,120,90,0.55)";
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.arc(mx, my, 9 * dpr, 0, Math.PI * 2);
      ctx.moveTo(mx - 14 * dpr, my); ctx.lineTo(mx + 14 * dpr, my);
      ctx.moveTo(mx, my - 14 * dpr); ctx.lineTo(mx, my + 14 * dpr);
      ctx.stroke();
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
