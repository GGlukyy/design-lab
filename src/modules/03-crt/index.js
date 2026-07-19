// 03 — CRT / glitch panel. A canvas-drawn content card pushed through a CRT
// post shader: barrel distortion, scanlines, RGB aberration, VHS tracking.
import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, Mesh,
  ShaderMaterial, CanvasTexture, LinearFilter,
} from "three";

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uTime;
uniform float uIntensity;  // 0..1 slider
uniform float uGlitch;     // 0..1 tracking spike
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = vUv;

  // barrel distortion
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  uv = 0.5 + c * (1.0 + r2 * (0.18 + 0.35 * uIntensity));

  // VHS tracking: a band that tears horizontally
  float band = smoothstep(0.0, 0.35, uGlitch);
  if (band > 0.001) {
    float y = fract(uTime * 0.37);
    float d = abs(uv.y - y);
    float tear = exp(-d * 60.0) * band;
    uv.x += (hash(floor(uv.y * 90.0) + floor(uTime * 17.0)) - 0.5) * 0.12 * tear;
    uv.y += tear * 0.004;
  }

  // per-line jitter scales with intensity
  uv.x += (hash(floor(uv.y * 240.0) + floor(uTime * 13.0)) - 0.5) * 0.0035 * uIntensity;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.02, 0.02, 0.025, 1.0);
    return;
  }

  // chromatic aberration
  float ab = (0.0012 + 0.004 * uIntensity) * (1.0 + r2 * 3.0);
  float rC = texture2D(uTex, uv + vec2(ab, 0.0)).r;
  float gC = texture2D(uTex, uv).g;
  float bC = texture2D(uTex, uv - vec2(ab, 0.0)).b;
  vec3 col = vec3(rC, gC, bC);

  // scanlines + aperture grille
  col *= 0.82 + 0.18 * sin(uv.y * 640.0) * (0.4 + 0.6 * uIntensity) + 0.10;
  col *= 0.94 + 0.06 * sin(uv.x * 1400.0);

  // phosphor glow lift + flicker
  col += vec3(0.01, 0.035, 0.02) * (1.0 - r2 * 1.5);
  col *= 0.97 + 0.03 * sin(uTime * 87.0);

  // vignette
  col *= 1.0 - r2 * 0.9;

  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function drawCard(ctx, w, h, t) {
  ctx.fillStyle = "#0c0f0d";
  ctx.fillRect(0, 0, w, h);
  const green = "#33ff99", dim = "#1d8f5c", faint = "#12402c";

  ctx.strokeStyle = dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.font = "700 26px Consolas, monospace";
  ctx.fillStyle = green;
  ctx.fillText("SYS://DESIGN-LAB / MODULE-03", 48, 72);
  ctx.fillStyle = dim;
  ctx.font = "400 20px Consolas, monospace";
  ctx.fillText("CRT SIGNAL PROCESSOR — LIVE FEED", 48, 104);

  ctx.fillStyle = faint;
  ctx.fillRect(48, 124, w - 96, 2);

  ctx.font = "400 19px Consolas, monospace";
  const lines = [
    "barrel distortion .......... r2 radial remap",
    "scanlines .................. sin(y*640)",
    "aperture grille ............ sin(x*1400)",
    "chromatic aberration ....... uv offset per channel",
    "tracking glitch ............ hover to trigger",
  ];
  lines.forEach((s, i) => {
    ctx.fillStyle = i % 2 ? dim : "#9adfbe";
    ctx.fillText(s, 48, 172 + i * 34);
  });

  ctx.strokeStyle = green;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const wy = h - 130, amp = 46;
  for (let x = 0; x <= w - 96; x += 4) {
    const y = wy + Math.sin(x * 0.02 + t * 2.1) * amp * Math.sin(x * 0.0031 + t * 0.6);
    x === 0 ? ctx.moveTo(48 + x, y) : ctx.lineTo(48 + x, y);
  }
  ctx.stroke();

  ctx.fillStyle = dim;
  ctx.font = "400 17px Consolas, monospace";
  ctx.fillText(`T+${t.toFixed(2)}s`, 48, h - 44);
  ctx.fillStyle = green;
  ctx.fillText("● REC", w - 130, h - 44);
}

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");

  const CW = 1024, CH = 640;
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = CW; cardCanvas.height = CH;
  const cardCtx = cardCanvas.getContext("2d");
  drawCard(cardCtx, CW, CH, 0);

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem">
      <div class="crt-holder" data-interactive
        style="width:min(760px, 92%);aspect-ratio:${CW}/${CH};cursor:crosshair;
               box-shadow:0 0 60px rgba(51,255,153,0.07), 0 0 8px rgba(0,0,0,0.8)"></div>
      <label class="mono-note" data-interactive style="display:flex;align-items:center;gap:1em;max-width:none">
        SIGNAL DEGRADATION
        <input type="range" min="0" max="100" value="35" style="accent-color:#33ff99;width:180px" />
        <span class="crt-val" style="color:#33ff99">0.35</span>
      </label>
    </div>`;
  const holder = content.querySelector(".crt-holder");
  const slider = content.querySelector("input[type=range]");
  const valEl = content.querySelector(".crt-val");

  if (reducedMotion) {
    cardCanvas.style.width = "100%";
    cardCanvas.style.height = "100%";
    holder.appendChild(cardCanvas);
    return {};
  }

  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  holder.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new Scene();
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 1;

  const tex = new CanvasTexture(cardCanvas);
  tex.minFilter = LinearFilter;

  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTex: { value: tex },
      uTime: { value: 0 },
      uIntensity: { value: 0.35 },
      uGlitch: { value: 0 },
    },
  });
  scene.add(new Mesh(new PlaneGeometry(2, 2), mat));

  function resize() {
    renderer.setSize(holder.clientWidth, holder.clientHeight);
  }
  resize();

  slider.addEventListener("input", () => {
    const v = slider.value / 100;
    mat.uniforms.uIntensity.value = v;
    valEl.textContent = v.toFixed(2);
  });

  let glitchTarget = 0;
  holder.addEventListener("pointerenter", () => { glitchTarget = 1; });
  holder.addEventListener("pointerleave", () => { glitchTarget = 0; });
  const glitchTimer = setInterval(() => {
    if (glitchTarget === 0) mat.uniforms.uGlitch.value = 0.9;
  }, 3800 + Math.random() * 2000);

  let raf = 0, running = true, redrawAcc = 0, last = performance.now();
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = (now - last) / 1000;
    last = now;
    const t = now / 1000;
    mat.uniforms.uTime.value = t;
    const g = mat.uniforms.uGlitch.value;
    mat.uniforms.uGlitch.value = g + (glitchTarget - g) * (glitchTarget > g ? 0.2 : 0.04);
    redrawAcc += dt;
    if (redrawAcc > 0.05) {
      drawCard(cardCtx, CW, CH, t);
      tex.needsUpdate = true;
      redrawAcc = 0;
    }
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(resize);
  ro.observe(holder);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(glitchTimer);
      ro.disconnect();
      tex.dispose(); mat.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
