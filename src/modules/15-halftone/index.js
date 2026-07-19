// 15 — Halftone. An animated luminance scene sampled through three rotated
// print screens (classic 15°/45°/75° CMYK angles), each channel its own ink;
// dot gain follows pointer distance. Single-pass raw WebGL2.

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
uniform vec2 uMouse;    // px

// animated source "scene": drifting soft blobs + diagonal sweep
float sceneLum(vec2 p) {
  float t = uTime * 0.5;
  vec2 a = vec2(0.5 + 0.26 * cos(t), 0.5 + 0.22 * sin(t * 1.3));
  vec2 b = vec2(0.5 + 0.3 * cos(t * 0.7 + 2.2), 0.45 + 0.26 * sin(t * 0.9 + 1.0));
  vec2 c = vec2(0.48 + 0.2 * sin(t * 1.1 + 4.0), 0.5 + 0.3 * cos(t * 0.6 + 3.1));
  float l = 0.0;
  l += 0.75 * exp(-dot(p - a, p - a) * 22.0);
  l += 0.65 * exp(-dot(p - b, p - b) * 30.0);
  l += 0.55 * exp(-dot(p - c, p - c) * 26.0);
  l += 0.18 * (0.5 + 0.5 * sin((p.x + p.y) * 5.0 - uTime * 0.8));
  return clamp(l, 0.0, 1.0);
}

// one rotated screen: returns dot coverage for this channel
float screenDots(vec2 fragPx, float angle, float cellPx, float lum, float gain) {
  float ca = cos(angle), sa = sin(angle);
  vec2 r = mat2(ca, -sa, sa, ca) * fragPx;
  vec2 cellId = floor(r / cellPx);
  vec2 local = fract(r / cellPx) - 0.5;
  // dot radius from luminance sampled at the cell center (unrotate)
  vec2 center = (cellId + 0.5) * cellPx;
  vec2 srcPx = mat2(ca, sa, -sa, ca) * center;
  float v = sceneLum(srcPx / uRes);
  float rad = sqrt(v) * 0.62 * gain;
  return smoothstep(rad, rad - 0.14, length(local));
}

void main() {
  vec2 fragPx = vUv * uRes;

  // dot gain swells near the pointer
  float md = distance(fragPx, uMouse);
  float gain = 1.0 + 0.55 * exp(-md * md / (240.0 * 240.0));

  float cell = uRes.y / 46.0;
  // three inks on rotated screens
  float k1 = screenDots(fragPx, 0.2618, cell, 1.0, gain);           // 15° — deep green
  float k2 = screenDots(fragPx, 0.7854, cell * 0.92, 1.0, gain);    // 45° — phosphor
  float k3 = screenDots(fragPx, 1.3090, cell * 1.18, 1.0, gain);    // 75° — off-white

  vec3 col = vec3(0.039, 0.039, 0.047);
  col = mix(col, vec3(0.075, 0.33, 0.21), k1 * 0.9);
  col = mix(col, vec3(0.2, 1.0, 0.6), k2 * 0.85);
  col = mix(col, vec3(0.91, 0.9, 0.88), k3 * 0.5);

  // paper vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.6;
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
  content.innerHTML = `<p class="mono-note" style="position:absolute;bottom:calc(var(--gutter)*-0.4);left:0;background:rgba(10,10,12,0.7);padding:0.4em 0.8em">three screens at 15° / 45° / 75° · dot radius √lum · pointer adds dot gain</p>`;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, depth: false, alpha: false });
  if (!gl || reducedMotion) {
    layer.style.background =
      "radial-gradient(45% 60% at 45% 45%, rgba(51,255,153,0.16), transparent 65%)," +
      "radial-gradient(6px 6px at 50% 50%, rgba(51,255,153,0.35) 30%, transparent 32%) 0 0/22px 22px, #0a0a0c";
    return {};
  }
  layer.appendChild(canvas);

  const dpr = Math.min(devicePixelRatio, 2);
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

  let mx = -4000, my = -4000, tx = -4000, ty = -4000;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    tx = (e.clientX - r.left) * dpr;
    ty = (r.height - (e.clientY - r.top)) * dpr; // gl y-up
  }
  section.addEventListener("pointermove", onMove);

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    mx += (tx - mx) * 0.1;
    my += (ty - my) * 0.1;
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
