// 02 — Particle text morph. Words rasterized to point targets; scroll-driven
// morph between them with curl-noise displacement in the vertex shader.
import {
  WebGLRenderer, Scene, OrthographicCamera, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending,
} from "three";

const WORDS = ["SIGNAL", "NOISE", "FORM"];
const COUNT = 11000;

const VERT = /* glsl */ `
uniform float uMix;      // 0..(WORDS-1) continuous
uniform float uTime;
uniform float uSize;
attribute vec3 tA;
attribute vec3 tB;
attribute vec3 tC;
attribute float seed;
varying float vGlow;

// cheap curl-ish noise from sines
vec3 curl(vec3 p) {
  return vec3(
    sin(p.y * 3.1 + uTime * 0.8) + sin(p.z * 2.3 - uTime * 0.6),
    sin(p.z * 2.9 - uTime * 0.7) + sin(p.x * 2.1 + uTime * 0.5),
    sin(p.x * 2.7 + uTime * 0.9) + sin(p.y * 1.9 - uTime * 0.4)
  );
}

void main() {
  float seg = clamp(uMix, 0.0, 2.0);
  vec3 from, to;
  float f;
  if (seg < 1.0) { from = tA; to = tB; f = seg; }
  else { from = tB; to = tC; f = seg - 1.0; }

  // per-particle stagger so the swarm doesn't move as one block
  float local = clamp(f * 1.6 - seed * 0.6, 0.0, 1.0);
  local = local * local * (3.0 - 2.0 * local);
  vec3 pos = mix(from, to, local);

  // turbulence peaks mid-transit
  float transit = sin(local * 3.14159);
  pos += curl(pos * 1.5 + seed * 17.0) * transit * 0.55;
  // constant faint jitter so the settled word shimmers
  pos += curl(pos * 4.0 + seed * 31.0) * 0.012;

  vGlow = transit;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uSize * (0.7 + 0.6 * seed) * (1.0 + transit * 1.2);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uHot;
varying float vGlow;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.02, d);
  vec3 col = mix(uColor, uHot, vGlow);
  gl_FragColor = vec4(col, a * (0.5 + vGlow * 0.5));
}`;

function rasterizeWord(word, count, aspect) {
  const cw = 1024, ch = 512;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${word.length > 5 ? 210 : 250}px Inter, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, cw / 2, ch / 2 + 10);
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const pts = [];
  for (let y = 0; y < ch; y += 2) {
    for (let x = 0; x < cw; x += 2) {
      if (data[(y * cw + x) * 4] > 128) pts.push(x, y);
    }
  }
  const out = new Float32Array(count * 3);
  const n = pts.length / 2;
  const scale = 3.6;
  for (let i = 0; i < count; i++) {
    const j = (Math.random() * n) | 0;
    out[i * 3] = ((pts[j * 2] / cw) - 0.5) * scale * aspect;
    out[i * 3 + 1] = (0.5 - pts[j * 2 + 1] / ch) * scale * 0.5;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  return out;
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter) * -0.25);left:0">11,000 points · targets sampled from rasterized glyphs · curl-noise transit · scroll to morph</p>`;

  if (reducedMotion) {
    layer.style.background =
      "radial-gradient(60% 45% at 50% 50%, rgba(51,255,153,0.12), transparent 70%), #0a0a0c";
    const h = document.createElement("h2");
    h.className = "h-section";
    h.textContent = WORDS[0];
    h.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0";
    layer.appendChild(h);
    return {};
  }

  const renderer = new WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  layer.appendChild(renderer.domElement);

  const scene = new Scene();
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 5;

  function frustum() {
    const a = layer.clientWidth / layer.clientHeight;
    cam.left = -1.6 * a; cam.right = 1.6 * a;
    cam.top = 1.6; cam.bottom = -1.6;
    cam.updateProjectionMatrix();
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(COUNT * 3), 3));
  const wordAspect = 1.15;
  geo.setAttribute("tA", new BufferAttribute(rasterizeWord(WORDS[0], COUNT, wordAspect), 3));
  geo.setAttribute("tB", new BufferAttribute(rasterizeWord(WORDS[1], COUNT, wordAspect), 3));
  geo.setAttribute("tC", new BufferAttribute(rasterizeWord(WORDS[2], COUNT, wordAspect), 3));
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) seeds[i] = Math.random();
  geo.setAttribute("seed", new BufferAttribute(seeds, 1));

  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 3.0 * Math.min(devicePixelRatio, 2) },
      uColor: { value: [0.35, 0.85, 0.6] },
      uHot: { value: [0.65, 1.0, 0.8] },
    },
  });
  scene.add(new Points(geo, mat));

  function resize() {
    renderer.setSize(layer.clientWidth, layer.clientHeight);
    frustum();
  }
  resize();

  let raf = 0, running = true, target = 0;
  function onScroll() {
    const r = section.getBoundingClientRect();
    const p = 1 - (r.bottom - innerHeight * 0.5) / r.height;
    target = Math.max(0, Math.min(2, (p - 0.25) * 4));
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  let mix = target;
  function step(t) {
    raf = requestAnimationFrame(step);
    mix += (target - mix) * 0.06;
    mat.uniforms.uMix.value = mix;
    mat.uniforms.uTime.value = t / 1000;
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(resize);
  ro.observe(layer);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      ro.disconnect();
      geo.dispose(); mat.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
