// 01 — Hero fluid ink. Stable-fluids solver, raw WebGL2, ping-pong FBOs.
import { VERT, ADVECT, SPLAT, DIVERGENCE, PRESSURE, GRADIENT_SUBTRACT, DISPLAY } from "./shaders.glsl.js";

const SIM_RES = 192;
const DYE_RES = 768;
const PRESSURE_ITERS = 22;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("shader: " + gl.getShaderInfoLog(s));
  }
  return s;
}

function program(gl, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("link: " + gl.getProgramInfoLog(p));
  }
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uniforms[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

function createFBO(gl, w, h, internal, format, type) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo, w, h };
}

function createDoubleFBO(gl, w, h, internal, format, type) {
  let a = createFBO(gl, w, h, internal, format, type);
  let b = createFBO(gl, w, h, internal, format, type);
  return {
    get read() { return a; },
    get write() { return b; },
    swap() { [a, b] = [b, a]; },
    dispose() {
      for (const f of [a, b]) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); }
    },
  };
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
  const extOK = gl && gl.getExtension("EXT_color_buffer_float");

  if (!gl || !extOK || reducedMotion) {
    layer.style.background =
      "radial-gradient(120% 90% at 30% 70%, rgba(51,255,153,0.16), transparent 60%)," +
      "radial-gradient(90% 70% at 75% 25%, rgba(51,255,153,0.08), transparent 55%)," +
      "#0a0a0c";
    return {};
  }

  layer.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, aspect = 1;
  function resize() {
    W = Math.floor(layer.clientWidth * dpr);
    H = Math.floor(layer.clientHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    aspect = W / H;
  }
  resize();

  // fullscreen quad
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const progs = {
    advect: program(gl, ADVECT),
    splat: program(gl, SPLAT),
    div: program(gl, DIVERGENCE),
    pressure: program(gl, PRESSURE),
    grad: program(gl, GRADIENT_SUBTRACT),
    display: program(gl, DISPLAY),
  };

  const simW = SIM_RES, simH = Math.max(Math.round(SIM_RES / aspect), 64);
  const dyeW = DYE_RES, dyeH = Math.max(Math.round(DYE_RES / aspect), 256);
  const velocity = createDoubleFBO(gl, simW, simH, gl.RG16F, gl.RG, gl.HALF_FLOAT);
  const pressure = createDoubleFBO(gl, simW, simH, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const divergence = createFBO(gl, simW, simH, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const dye = createDoubleFBO(gl, dyeW, dyeH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);

  function blit(target) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function bindTex(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  function splat(x, y, dx, dy, r, g, b) {
    const { p, u } = progs.splat;
    gl.useProgram(p);
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uPoint, x, y);
    gl.uniform1f(u.uRadius, 0.0018);
    gl.uniform1i(u.uTarget, bindTex(0, velocity.read.tex));
    gl.uniform3f(u.uValue, dx, dy, 0);
    blit(velocity.write);
    velocity.swap();
    gl.uniform1f(u.uRadius, 0.0032);
    gl.uniform1i(u.uTarget, bindTex(0, dye.read.tex));
    gl.uniform3f(u.uValue, r, g, b);
    blit(dye.write);
    dye.swap();
  }

  const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, moved: false };
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    pointer.dx = (x - pointer.x) * 12;
    pointer.dy = (y - pointer.y) * 12;
    pointer.x = x;
    pointer.y = y;
    pointer.moved = true;
  }
  section.addEventListener("pointermove", onMove);

  // idle auto-drift so the hero is alive without input
  let idleT = Math.random() * 100;
  function autoSplat(dt) {
    idleT += dt;
    const x = 0.5 + 0.34 * Math.sin(idleT * 0.21) * Math.cos(idleT * 0.09);
    const y = 0.45 + 0.3 * Math.sin(idleT * 0.147 + 1.7);
    const dx = Math.cos(idleT * 0.6) * 1.6;
    const dy = Math.sin(idleT * 0.43) * 1.6;
    const amt = 0.05 + 0.035 * Math.sin(idleT * 0.9);
    splat(x, y, dx * 2.2, dy * 2.2, amt * 0.35, amt, amt * 0.62);
  }

  // seed splats so first paint isn't empty
  for (let i = 0; i < 8; i++) {
    splat(0.25 + Math.random() * 0.5, 0.25 + Math.random() * 0.5,
      (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26,
      0.05, 0.17, 0.1);
  }

  let raf = 0, running = true, last = performance.now(), simTime = 0;
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    simTime += dt;

    autoSplat(dt);
    if (pointer.moved) {
      const speed = Math.hypot(pointer.dx, pointer.dy);
      splat(pointer.x, pointer.y, pointer.dx * 8, pointer.dy * 8,
        0.04 + speed * 0.25, 0.14 + speed * 0.5, 0.08 + speed * 0.3);
      pointer.moved = false;
    }

    const tx = 1 / simW, ty = 1 / simH;

    let pr = progs.advect;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, tx, ty);
    gl.uniform1f(pr.u.uDt, dt);
    gl.uniform1f(pr.u.uDissipation, 0.985);
    gl.uniform1i(pr.u.uVelocity, bindTex(0, velocity.read.tex));
    gl.uniform1i(pr.u.uSource, 0);
    blit(velocity.write);
    velocity.swap();

    pr = progs.div;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, tx, ty);
    gl.uniform1i(pr.u.uVelocity, bindTex(0, velocity.read.tex));
    blit(divergence);

    pr = progs.pressure;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, tx, ty);
    gl.uniform1i(pr.u.uDivergence, bindTex(1, divergence.tex));
    for (let i = 0; i < PRESSURE_ITERS; i++) {
      gl.uniform1i(pr.u.uPressure, bindTex(0, pressure.read.tex));
      blit(pressure.write);
      pressure.swap();
    }

    pr = progs.grad;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, tx, ty);
    gl.uniform1i(pr.u.uPressure, bindTex(0, pressure.read.tex));
    gl.uniform1i(pr.u.uVelocity, bindTex(1, velocity.read.tex));
    blit(velocity.write);
    velocity.swap();

    pr = progs.advect;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uTexel, tx, ty);
    gl.uniform1f(pr.u.uDt, dt);
    gl.uniform1f(pr.u.uDissipation, 0.978);
    gl.uniform1i(pr.u.uVelocity, bindTex(0, velocity.read.tex));
    gl.uniform1i(pr.u.uSource, bindTex(1, dye.read.tex));
    blit(dye.write);
    dye.swap();

    pr = progs.display;
    gl.useProgram(pr.p);
    gl.uniform1i(pr.u.uDye, bindTex(0, dye.read.tex));
    gl.uniform3f(pr.u.uTintA, 0.06, 0.55, 0.32);
    gl.uniform3f(pr.u.uTintB, 0.2, 1.0, 0.6);
    gl.uniform1f(pr.u.uTime, simTime);
    blit(null);
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(resize);
  ro.observe(layer);

  return {
    pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      section.removeEventListener("pointermove", onMove);
      velocity.dispose(); pressure.dispose(); dye.dispose();
      gl.deleteTexture(divergence.tex); gl.deleteFramebuffer(divergence.fbo);
      Object.values(progs).forEach((x) => gl.deleteProgram(x.p));
      gl.deleteBuffer(vbo);
      canvas.remove();
    },
  };
}
