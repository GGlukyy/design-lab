// 10 — Dither. Low-res 3D scene pushed through an ordered-dither post shader:
// Bayer matrix or gradient-noise threshold, 1-bit or 4-color palette.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, IcosahedronGeometry,
  TorusGeometry, MeshStandardMaterial, DirectionalLight, AmbientLight,
  WebGLRenderTarget, OrthographicCamera, PlaneGeometry, ShaderMaterial,
  NearestFilter,
} from "three";

// low internal resolution = chunky Obra Dinn pixels
const RW = 420, RH = 262;

const POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uMode;     // 0 = bayer, 1 = gradient noise
uniform float uPalette;  // 0 = 1-bit, 1 = 4-color
uniform vec2 uRes;
varying vec2 vUv;

// golfed ordered-dither thresholds (Shadertoy idiom)
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

// interleaved gradient noise — blue-noise-like isotropic threshold
float ign(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

void main() {
  vec3 src = texture2D(uTex, vUv).rgb;
  float lum = dot(src, vec3(0.299, 0.587, 0.114));

  vec2 px = floor(vUv * uRes);
  float threshold = mix(bayer8(px), ign(px), uMode);

  vec3 col;
  if (uPalette < 0.5) {
    // 1-bit: background vs phosphor
    float on = step(threshold, lum * 1.35);
    col = mix(vec3(0.039, 0.039, 0.047), vec3(0.2, 1.0, 0.6), on);
  } else {
    // 4-color ramp: near-black, deep green, phosphor, off-white
    float q = lum * 3.0 + (threshold - 0.5) * 1.2;
    vec3 c0 = vec3(0.039, 0.039, 0.047);
    vec3 c1 = vec3(0.082, 0.36, 0.235);
    vec3 c2 = vec3(0.2, 1.0, 0.6);
    vec3 c3 = vec3(0.91, 0.9, 0.88);
    col = q < 0.75 ? c0 : q < 1.5 ? c1 : q < 2.4 ? c2 : c3;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function btnStyle() {
  return `all:unset;cursor:pointer;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label);color:var(--accent);border:1px solid var(--accent-dim);padding:0.7em 1.6em`;
}

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem">
      <div class="dither-holder" style="width:min(880px,94%);aspect-ratio:${RW}/${RH};border:1px solid var(--line);background:#070708"></div>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center">
        <button class="d-mode" data-interactive style="${btnStyle()}">DITHER: BAYER-8</button>
        <button class="d-pal" data-interactive style="${btnStyle()}">PALETTE: 1-BIT</button>
        <span class="mono-note" style="max-width:none;align-self:center">${RW}×${RH} target · nearest upscale</span>
      </div>
    </div>`;
  const holder = content.querySelector(".dither-holder");
  const modeBtn = content.querySelector(".d-mode");
  const palBtn = content.querySelector(".d-pal");

  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1); // post pass supplies the pixels; keep 1:1
  holder.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;image-rendering:pixelated";

  // ── scene ──
  const scene = new Scene();
  const cam = new PerspectiveCamera(45, RW / RH, 0.1, 100);
  cam.position.set(0, 0, 26);
  const matA = new MeshStandardMaterial({ color: 0xbfc4bd, roughness: 0.55, metalness: 0.1 });
  const matB = new MeshStandardMaterial({ color: 0x8fae9c, roughness: 0.4, metalness: 0.3 });
  const ico = new Mesh(new IcosahedronGeometry(6.2, 1), matA);
  const torus = new Mesh(new TorusGeometry(9.5, 1.15, 10, 48), matB);
  scene.add(ico, torus);
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(6, 8, 10);
  const amb = new AmbientLight(0xffffff, 0.18);
  scene.add(key, amb);

  const rt = new WebGLRenderTarget(RW, RH);
  rt.texture.minFilter = NearestFilter;
  rt.texture.magFilter = NearestFilter;

  // ── post quad ──
  const postScene = new Scene();
  const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    uniforms: {
      uTex: { value: rt.texture },
      uMode: { value: 0 },
      uPalette: { value: 0 },
      uRes: { value: [RW, RH] },
    },
  });
  postScene.add(new Mesh(new PlaneGeometry(2, 2), postMat));

  modeBtn.addEventListener("click", () => {
    const m = postMat.uniforms.uMode.value ? 0 : 1;
    postMat.uniforms.uMode.value = m;
    modeBtn.textContent = m ? "DITHER: NOISE" : "DITHER: BAYER-8";
  });
  palBtn.addEventListener("click", () => {
    const p = postMat.uniforms.uPalette.value ? 0 : 1;
    postMat.uniforms.uPalette.value = p;
    palBtn.textContent = p ? "PALETTE: 4-COLOR" : "PALETTE: 1-BIT";
  });

  function resize() {
    renderer.setSize(RW, RH, false); // internal buffer stays low-res
  }
  resize();

  function renderFrame(t) {
    ico.rotation.x = t * 0.4;
    ico.rotation.y = t * 0.27;
    torus.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.5;
    torus.rotation.z = t * 0.22;
    key.position.set(Math.cos(t * 0.5) * 9, 8, Math.sin(t * 0.5) * 9 + 4);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  if (reducedMotion) {
    renderFrame(1.2); // one static dithered frame
    return {};
  }

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    renderFrame(now / 1000);
  }
  raf = requestAnimationFrame(step);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ico.geometry.dispose(); torus.geometry.dispose();
      matA.dispose(); matB.dispose(); postMat.dispose();
      rt.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
