// 13 — Metaballs. Scalar field of moving blobs, marching squares with linear
// interpolation extracts the iso-contour each frame; filled with an animated
// gradient, gooey merge/split around the pointer. Canvas 2D, from scratch.

const BALLS = 7;
const CELL = 10; // field resolution in css px

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter)*-0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">marching squares · ${CELL}px field · lerped edges · pointer is a metaball</p>`;

  if (reducedMotion) {
    layer.style.background =
      "radial-gradient(28% 40% at 38% 50%, rgba(51,255,153,0.25), transparent 70%)," +
      "radial-gradient(24% 36% at 62% 48%, rgba(51,255,153,0.2), transparent 70%), #0a0a0c";
    return {};
  }

  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, gw = 0, gh = 0, field;
  function resize() {
    W = canvas.width = layer.clientWidth;
    H = canvas.height = layer.clientHeight;
    gw = Math.ceil(W / CELL) + 1;
    gh = Math.ceil(H / CELL) + 1;
    field = new Float32Array(gw * gh);
  }
  resize();

  // blobs orbit slow anchors
  const balls = [];
  for (let i = 0; i < BALLS; i++) {
    balls.push({
      ax: 0.5 + (Math.random() - 0.5) * 0.55, // anchor in fractions
      ay: 0.5 + (Math.random() - 0.5) * 0.45,
      orbit: 0.06 + Math.random() * 0.15,
      speed: 0.25 + Math.random() * 0.5,
      phase: Math.random() * 7,
      r: 42 + Math.random() * 46,
      x: 0, y: 0,
    });
  }
  const mouseBall = { x: -9999, y: -9999, r: 66 };
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseBall.x = e.clientX - r.left;
    mouseBall.y = e.clientY - r.top;
  }
  function onLeave() { mouseBall.x = -9999; mouseBall.y = -9999; }
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", onLeave);

  const ISO = 1.0;

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    const t = now / 1000;

    for (const b of balls) {
      b.x = (b.ax + Math.cos(t * b.speed + b.phase) * b.orbit) * W;
      b.y = (b.ay + Math.sin(t * b.speed * 1.3 + b.phase) * b.orbit) * H;
    }
    const all = mouseBall.x > -999 ? [...balls, mouseBall] : balls;

    // scalar field: sum r² / d²
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = gx * CELL, y = gy * CELL;
        let v = 0;
        for (const b of all) {
          const dx = x - b.x, dy = y - b.y;
          v += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        field[gy * gw + gx] = v;
      }
    }

    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);

    // animated fill gradient
    const grad = ctx.createLinearGradient(
      W / 2 + Math.cos(t * 0.4) * W * 0.4, 0,
      W / 2 - Math.cos(t * 0.4) * W * 0.4, H
    );
    grad.addColorStop(0, "rgba(51,255,153,0.85)");
    grad.addColorStop(0.5, "rgba(20,143,92,0.75)");
    grad.addColorStop(1, "rgba(9,64,40,0.85)");

    // marching squares: build path of iso-contour + fill via threshold blit
    const lerp = (a, b) => (ISO - a) / (b - a);
    ctx.beginPath();
    for (let gy = 0; gy < gh - 1; gy++) {
      for (let gx = 0; gx < gw - 1; gx++) {
        const i = gy * gw + gx;
        const tl = field[i], tr = field[i + 1], br = field[i + gw + 1], bl = field[i + gw];
        let code = (tl > ISO ? 8 : 0) | (tr > ISO ? 4 : 0) | (br > ISO ? 2 : 0) | (bl > ISO ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x = gx * CELL, y = gy * CELL;
        // edge midpoints with linear interpolation
        const top = [x + CELL * lerp(tl, tr), y];
        const right = [x + CELL, y + CELL * lerp(tr, br)];
        const bottom = [x + CELL * lerp(bl, br), y + CELL];
        const left = [x, y + CELL * lerp(tl, bl)];
        const seg = (a, b) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
        switch (code) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
    }
    // fill: threshold pass drawn as batched horizontal spans per row
    ctx.fillStyle = grad;
    for (let gy = 0; gy < gh - 1; gy++) {
      let runStart = -1;
      for (let gx = 0; gx < gw; gx++) {
        const inside = gx < gw - 1 && field[gy * gw + gx] > ISO && field[gy * gw + gx + 1] > ISO;
        if (inside && runStart < 0) runStart = gx;
        if (!inside && runStart >= 0) {
          ctx.fillRect(runStart * CELL, gy * CELL, (gx - runStart) * CELL, CELL);
          runStart = -1;
        }
      }
    }
    // crisp contour on top
    ctx.strokeStyle = "rgba(51,255,153,0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
