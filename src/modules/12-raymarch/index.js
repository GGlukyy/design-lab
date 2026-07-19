// 12 — Raymarch. Fullscreen fragment-shader SDF scene: smooth-min blended
// primitives, soft shadows, slow morph, pointer-driven key light. Raw WebGL2.

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;   // -1..1

float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  float t = uTime * 0.4;
  // sphere orbiting
  vec3 sp = p - vec3(sin(t) * 1.1, cos(t * 0.7) * 0.6, 0.0);
  float d = sdSphere(sp, 0.85 + 0.15 * sin(uTime * 0.9));
  // torus slowly tumbling
  vec3 tp = p;
  float ca = cos(t * 0.6), sa = sin(t * 0.6);
  tp.xy = mat2(ca, -sa, sa, ca) * tp.xy;
  tp.yz = mat2(ca, sa, -sa, ca) * tp.yz;
  d = smin(d, sdTorus(tp, vec2(1.5, 0.42)), 0.7);
  // box breathing below
  float bx = sdBox(p - vec3(0.0, -1.3 + 0.2 * sin(t * 1.4), 0.0), vec3(0.9, 0.25, 0.9));
  d = smin(d, bx, 0.55);
  // ground
  d = smin(d, p.y + 2.1, 0.4);
  return d;
}

vec3 normal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

// iq-style soft shadow
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.06;
  for (int i = 0; i < 40; i++) {
    float h = map(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, 9.0 * h / t);
    t += h;
    if (t > 12.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

void main() {
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);
  vec3 ro = vec3(0.0, 0.4, 4.6);
  vec3 rd = normalize(vec3(uv, -1.9));

  float t = 0.0;
  float d;
  vec3 p;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    p = ro + rd * t;
    d = map(p);
    if (d < 0.0015 * t) { hit = true; break; }
    t += d;
    if (t > 22.0) break;
  }

  vec3 bg = vec3(0.039, 0.039, 0.047);
  vec3 col = bg;
  if (hit) {
    vec3 n = normal(p);
    vec3 lightPos = vec3(uMouse.x * 4.0, 2.4 + uMouse.y * 2.0, 2.8);
    vec3 ld = normalize(lightPos - p);
    float diff = max(dot(n, ld), 0.0);
    float sh = softShadow(p + n * 0.03, ld);
    float ao = clamp(map(p + n * 0.35) / 0.35, 0.0, 1.0);
    float spec = pow(max(dot(reflect(-ld, n), -rd), 0.0), 24.0);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

    vec3 base = mix(vec3(0.05, 0.16, 0.11), vec3(0.12, 0.55, 0.34), diff * sh);
    col = base * (0.45 + 0.55 * ao);
    col += vec3(0.2, 1.0, 0.6) * spec * sh * 0.8;
    col += vec3(0.2, 1.0, 0.6) * fres * 0.22;
    // distance fog into background
    col = mix(col, bg, smoothstep(6.0, 20.0, t));
  }

  // faint scan flicker keeps it in family
  col *= 0.985 + 0.015 * sin(uTime * 31.0 + vUv.y * 700.0);
  frag = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter)*-0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">sphere ⊔ torus ⊔ box, smooth-min blend · 90-step march · move pointer to carry the light</p>`;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, depth: false, alpha: false });
  if (!gl || reducedMotion) {
    layer.style.background =
      "radial-gradient(55% 70% at 50% 55%, rgba(51,255,153,0.14), transparent 65%), #0a0a0c";
    return {};
  }
  layer.appendChild(canvas);

  // march at 0.7 dpr — SDF cost dominates, upscale is invisible on dark scene
  const dpr = Math.min(devicePixelRatio, 2) * 0.7;
  let W = 0, H = 0;
  function resize() {
    W = canvas.width = Math.floor(layer.clientWidth * dpr);
    H = canvas.height = Math.floor(layer.clientHeight * dpr);
    gl.viewport(0, 0, W, H);
  }
  resize();

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uMouse = gl.getUniformLocation(prog, "uMouse");

  let mx = 0.3, my = 0.2, tx = 0.3, ty = 0.2;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  section.addEventListener("pointermove", onMove);

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
      gl.deleteProgram(prog); gl.deleteBuffer(vbo);
      canvas.remove();
    },
  };
}
