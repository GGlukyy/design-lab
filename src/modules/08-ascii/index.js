// 08 — ASCII renderer. Torus-knot rendered to a tiny offscreen target,
// luminance read back and mapped to a character density ramp on 2D canvas.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, TorusKnotGeometry,
  MeshNormalMaterial, WebGLRenderTarget,
} from "three";

const RAMP = " .:-=+*#%@";
const GW = 110, GH = 56; // character grid

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem">
      <div class="ascii-holder" style="width:min(880px,94%);aspect-ratio:2/1.05;position:relative;border:1px solid var(--line);background:#070708"></div>
      <div style="display:flex;gap:1rem;align-items:center">
        <button class="ascii-toggle" data-interactive style="all:unset;cursor:pointer;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label);color:var(--accent);border:1px solid var(--accent-dim);padding:0.7em 1.6em">MODE: ASCII</button>
        <span class="mono-note" style="max-width:none">110×56 grid · luminance → " .:-=+*#%@"</span>
      </div>
    </div>`;
  const holder = content.querySelector(".ascii-holder");
  const toggle = content.querySelector(".ascii-toggle");

  // 2D output canvas
  const out = document.createElement("canvas");
  out.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  holder.appendChild(out);
  const octx = out.getContext("2d");

  // hidden webgl canvas (shown in RAW mode)
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x070708);
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:none";
  holder.appendChild(renderer.domElement);

  const scene = new Scene();
  const cam = new PerspectiveCamera(50, GW / GH, 0.1, 100);
  cam.position.z = 38;
  const knot = new Mesh(new TorusKnotGeometry(10, 3, 110, 14), new MeshNormalMaterial());
  scene.add(knot);

  const rt = new WebGLRenderTarget(GW, GH);
  const pixels = new Uint8Array(GW * GH * 4);

  let ascii = true;
  toggle.addEventListener("click", () => {
    ascii = !ascii;
    toggle.textContent = ascii ? "MODE: ASCII" : "MODE: RAW";
    out.style.display = ascii ? "block" : "none";
    renderer.domElement.style.display = ascii ? "none" : "block";
  });

  function sizeOut() {
    const dpr = Math.min(devicePixelRatio, 2);
    out.width = holder.clientWidth * dpr;
    out.height = holder.clientHeight * dpr;
    renderer.setSize(holder.clientWidth, holder.clientHeight, false);
  }
  sizeOut();

  if (reducedMotion) {
    // single static ASCII frame
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, GW, GH, pixels);
    drawAscii(0);
    return {};
  }

  function drawAscii(t) {
    const cw = out.width / GW, ch = out.height / GH;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = "#070708";
    octx.fillRect(0, 0, out.width, out.height);
    octx.font = `${Math.ceil(ch)}px Consolas, monospace`;
    octx.textBaseline = "top";
    // stretch so the monospace advance exactly fills the grid width
    const charW = octx.measureText("@").width;
    octx.setTransform(cw / charW, 0, 0, 1, 0, 0);
    for (let y = 0; y < GH; y++) {
      let row = "";
      for (let x = 0; x < GW; x++) {
        // render target is flipped vertically
        const i = ((GH - 1 - y) * GW + x) * 4;
        const lum = (pixels[i] * 0.3 + pixels[i + 1] * 0.55 + pixels[i + 2] * 0.15) / 255;
        row += RAMP[Math.min(RAMP.length - 1, (lum * RAMP.length) | 0)];
      }
      // two-tone: brighter rows pulse slightly
      octx.fillStyle = y % 7 === (t * 8 | 0) % 7 ? "#4dffa8" : "#2bbf77";
      octx.fillText(row, 0, y * ch);
    }
  }

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    const t = now / 1000;
    knot.rotation.x = t * 0.5;
    knot.rotation.y = t * 0.34;
    if (ascii) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.readRenderTargetPixels(rt, 0, 0, GW, GH, pixels);
      drawAscii(t);
    } else {
      cam.aspect = holder.clientWidth / holder.clientHeight;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      cam.aspect = GW / GH;
      cam.updateProjectionMatrix();
    }
  }
  raf = requestAnimationFrame(step);

  const ro = new ResizeObserver(sizeOut);
  ro.observe(holder);

  return {
    pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(step); } },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      knot.geometry.dispose(); knot.material.dispose();
      rt.dispose(); renderer.dispose();
      renderer.domElement.remove(); out.remove();
    },
  };
}
