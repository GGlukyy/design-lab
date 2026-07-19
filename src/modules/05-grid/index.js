// 05 — Infinite drag grid. Draggable, inertial, infinitely-wrapping plane grid
// of procedural textures; RGB-shift + stretch distortion follows drag velocity.
import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh,
  ShaderMaterial, CanvasTexture, LinearFilter,
} from "three";

const COLS = 5, ROWS = 4;       // logical tile set (wraps)
const TILE = 1.35, GAP = 0.12;  // world units

const VERT = /* glsl */ `
uniform vec2 uVel;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // skew/stretch with velocity for a smeared-tape feel
  p.x += uVel.x * 0.15 * (uv.y - 0.5);
  p.y += uVel.y * 0.15 * (uv.x - 0.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uVel;
varying vec2 vUv;
void main() {
  float v = clamp(length(uVel), 0.0, 3.0);
  vec2 dir = v > 0.001 ? normalize(uVel) : vec2(1.0, 0.0);
  vec2 off = dir * v * 0.012;
  float r = texture2D(uTex, vUv + off).r;
  float g = texture2D(uTex, vUv).g;
  float b = texture2D(uTex, vUv - off).b;
  // slight directional blur: 3-tap
  vec3 col = vec3(r, g, b);
  col += texture2D(uTex, vUv + off * 2.0).rgb * 0.5 * min(v, 1.0);
  col /= 1.0 + 0.5 * min(v, 1.0);
  // darken while dragging fast
  gl_FragColor = vec4(col * (1.0 - v * 0.06), 1.0);
}`;

// procedural tile art: layered gradients + noise + technical markings
function makeTileTexture(i) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  const seed = i * 137.5;
  const hueShift = (i * 47) % 100;

  const grad = ctx.createLinearGradient(0, 0, S * Math.cos(seed), S * Math.sin(seed));
  grad.addColorStop(0, `hsl(158, ${30 + hueShift % 40}%, ${7 + (i % 4) * 3}%)`);
  grad.addColorStop(1, `hsl(${140 + (i % 5) * 12}, 55%, ${13 + (i % 3) * 6}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // noise speckle
  const img = ctx.getImageData(0, 0, S, S);
  for (let p = 0; p < img.data.length; p += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[p] += n; img.data[p + 1] += n; img.data[p + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // rings / bars vary per tile
  ctx.strokeStyle = "rgba(51,255,153,0.55)";
  ctx.lineWidth = 2;
  if (i % 3 === 0) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 40 + (i % 5) * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 20 + (i % 4) * 10, seed, seed + 4);
    ctx.stroke();
  } else if (i % 3 === 1) {
    for (let k = 0; k < 5; k++) {
      const y = 30 + k * 46 + (i % 7) * 3;
      ctx.globalAlpha = 0.25 + 0.1 * k;
      ctx.strokeRect(24, y, S - 48, 14);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    for (let x = 0; x <= S; x += 4) {
      const y = S / 2 + Math.sin(x * 0.05 + seed) * 40 * Math.sin(x * 0.011);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // corner label
  ctx.fillStyle = "rgba(232,230,225,0.8)";
  ctx.font = "700 18px Consolas, monospace";
  ctx.fillText(`TX-${String(i).padStart(2, "0")}`, 14, S - 14);
  ctx.fillStyle = "rgba(51,255,153,0.9)";
  ctx.fillRect(14, 14, 26, 4);

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  return tex;
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter) * -0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">drag · inertial wrap · rgb-shift ∝ velocity</p>`;

  if (reducedMotion) {
    layer.style.background =
      "repeating-linear-gradient(90deg, #101014 0 180px, #0d1210 180px 360px)";
    return {};
  }

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0c);
  layer.appendChild(renderer.domElement);
  layer.style.cursor = "grab";
  layer.style.touchAction = "none";

  const scene = new Scene();
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 5;
  let viewW = 4, viewH = 4;
  function frustum() {
    const a = layer.clientWidth / layer.clientHeight;
    viewH = 4.2; viewW = viewH * a;
    cam.left = -viewW / 2; cam.right = viewW / 2;
    cam.top = viewH / 2; cam.bottom = -viewH / 2;
    cam.updateProjectionMatrix();
  }

  const velUniform = { value: [0, 0] };
  const geo = new PlaneGeometry(TILE, TILE, 8, 8);
  const tiles = [];
  const SPANX = COLS * (TILE + GAP);
  const SPANY = ROWS * (TILE + GAP);
  for (let i = 0; i < COLS * ROWS; i++) {
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTex: { value: makeTileTexture(i) }, uVel: velUniform },
    });
    const m = new Mesh(geo, mat);
    const col = i % COLS, row = (i / COLS) | 0;
    m.userData.baseX = col * (TILE + GAP);
    m.userData.baseY = row * (TILE + GAP);
    tiles.push(m);
    scene.add(m);
  }

  // drag state
  let offX = 0, offY = 0, velX = 0.15, velY = 0.05;
  let dragging = false, px = 0, py = 0;
  function toWorld(dxPix, dyPix) {
    return [dxPix / layer.clientWidth * viewW, -dyPix / layer.clientHeight * viewH];
  }
  function down(e) {
    dragging = true;
    px = e.clientX; py = e.clientY;
    layer.style.cursor = "grabbing";
    layer.setPointerCapture?.(e.pointerId);
  }
  function move(e) {
    if (!dragging) return;
    const [dx, dy] = toWorld(e.clientX - px, e.clientY - py);
    px = e.clientX; py = e.clientY;
    offX += dx; offY += dy;
    velX = dx * 60; velY = dy * 60; // world units / s
  }
  function up() { dragging = false; layer.style.cursor = "grab"; }
  layer.addEventListener("pointerdown", down);
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerup", up, { passive: true });

  function resize() {
    renderer.setSize(layer.clientWidth, layer.clientHeight);
    frustum();
  }
  resize();

  const wrap = (v, span) => ((v % span) + span * 1.5) % span - span / 2;

  let raf = 0, running = true, last = performance.now();
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (!dragging) {
      offX += velX * dt; offY += velY * dt;
      const decay = Math.exp(-2.2 * dt);
      velX *= decay; velY *= decay;
      // gentle perpetual drift so the grid never fully freezes
      offX += 0.045 * dt;
    }
    velUniform.value = [velX, velY];

    for (const t of tiles) {
      t.position.x = wrap(t.userData.baseX + offX, SPANX);
      t.position.y = wrap(t.userData.baseY + offY, SPANY);
    }
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(resize);
  ro.observe(layer);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      layer.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      tiles.forEach((t) => { t.material.uniforms.uTex.value.dispose(); t.material.dispose(); });
      geo.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
