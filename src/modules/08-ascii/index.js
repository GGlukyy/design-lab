// 08 — ASCII × Dither. One low-res source buffer (a live 3D torus-knot render,
// or a dropped image) pushed through interchangeable CPU renderers:
// ASCII density ramp, Bayer-8 ordered dither (1-bit / 4-color), or raw pixels.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, TorusKnotGeometry,
  MeshNormalMaterial, WebGLRenderTarget,
} from "three";

const SW = 220, SH = 130;      // source buffer resolution
const RAMP = " .:-=+*#%@";
const MODES = ["ASCII", "DITHER 1-BIT", "DITHER 4-COL", "RAW"];

// 8×8 Bayer matrix, normalized 0..1
const BAYER8 = (() => {
  const m = [[0]];
  let n = 1;
  while (n < 8) {
    for (let y = 0; y < n; y++) {
      m[y + n] = [];
      for (let x = 0; x < n; x++) {
        const v = m[y][x] * 4;
        m[y][x] = v;
        m[y][x + n] = v + 2;
        m[y + n][x] = v + 3;
        m[y + n][x + n] = v + 1;
      }
    }
    n *= 2;
  }
  return m.map((row) => row.map((v) => (v + 0.5) / 64));
})();

// palette for 4-color mode
const PAL4 = [[10, 10, 12], [21, 92, 60], [51, 255, 153], [232, 230, 225]];

function btnStyle() {
  return `all:unset;cursor:pointer;font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label);color:var(--accent);border:1px solid var(--accent-dim);padding:0.7em 1.6em`;
}

export default async function init(section, { reducedMotion }) {
  const content = section.querySelector(".section-content");
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem">
      <div class="ad-holder" data-interactive style="width:min(880px,94%);aspect-ratio:${SW}/${SH};position:relative;border:1px solid var(--line);background:#070708">
        <div class="ad-drop" style="position:absolute;inset:0;z-index:3;display:none;align-items:center;justify-content:center;border:1px dashed var(--accent);background:rgba(10,10,12,0.82);font-family:var(--font-mono);font-size:var(--fs-label);letter-spacing:var(--tracking-label);color:var(--accent);pointer-events:none">DROP IMAGE TO CONVERT</div>
      </div>
      <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;justify-content:center">
        <button class="ad-mode" data-interactive style="${btnStyle()}">MODE: ASCII</button>
        <button class="ad-src" data-interactive style="${btnStyle()};color:var(--ink-dim);border-color:var(--line-strong)">SOURCE: SCENE</button>
        <span class="mono-note" style="max-width:none">${SW}×${SH} buffer · drag an image onto the panel</span>
      </div>
    </div>`;
  const holder = content.querySelector(".ad-holder");
  const dropHint = content.querySelector(".ad-drop");
  const modeBtn = content.querySelector(".ad-mode");
  const srcBtn = content.querySelector(".ad-src");

  // display canvas (hi-res for ASCII text; pixelated blits for the rest)
  const out = document.createElement("canvas");
  out.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  holder.appendChild(out);
  const octx = out.getContext("2d");

  // small canvas used to blit dither/raw ImageData before upscale
  const tmp = document.createElement("canvas");
  tmp.width = SW; tmp.height = SH;
  const tctx = tmp.getContext("2d");

  // ── 3D scene source ──
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x070708);
  const scene = new Scene();
  const cam = new PerspectiveCamera(50, SW / SH, 0.1, 100);
  cam.position.z = 34;
  const knot = new Mesh(new TorusKnotGeometry(10, 3, 110, 14), new MeshNormalMaterial());
  scene.add(knot);
  const rt = new WebGLRenderTarget(SW, SH);
  const scenePixels = new Uint8Array(SW * SH * 4);

  // ── image source (drag & drop) ──
  let imagePixels = null; // Uint8ClampedArray, y-down
  let source = "scene";   // "scene" | "image"
  let modeIdx = 0;
  let needsStatic = true; // static sources (image) only redraw on mode/source change

  function setSource(s) {
    source = s;
    srcBtn.textContent = s === "image" ? "SOURCE: IMAGE ⨯" : "SOURCE: SCENE";
    srcBtn.style.color = s === "image" ? "var(--accent)" : "var(--ink-dim)";
    srcBtn.style.borderColor = s === "image" ? "var(--accent-dim)" : "var(--line-strong)";
    needsStatic = true;
  }
  srcBtn.addEventListener("click", () => setSource("scene"));

  section.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropHint.style.display = "flex";
  });
  section.addEventListener("dragleave", (e) => {
    if (e.target === section) dropHint.style.display = "none";
  });
  section.addEventListener("drop", (e) => {
    e.preventDefault();
    dropHint.style.display = "none";
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // cover-fit into the source buffer
      const s = Math.max(SW / img.width, SH / img.height);
      const dw = img.width * s, dh = img.height * s;
      tctx.fillStyle = "#070708";
      tctx.fillRect(0, 0, SW, SH);
      tctx.drawImage(img, (SW - dw) / 2, (SH - dh) / 2, dw, dh);
      imagePixels = tctx.getImageData(0, 0, SW, SH).data;
      URL.revokeObjectURL(url);
      setSource("image");
    };
    img.src = url;
  });

  modeBtn.addEventListener("click", () => {
    modeIdx = (modeIdx + 1) % MODES.length;
    modeBtn.textContent = "MODE: " + MODES[modeIdx];
    needsStatic = true;
  });

  function sizeOut() {
    const dpr = Math.min(devicePixelRatio, 2);
    out.width = holder.clientWidth * dpr;
    out.height = holder.clientHeight * dpr;
    octx.imageSmoothingEnabled = false;
    needsStatic = true;
  }
  sizeOut();

  // luminance of source pixel (x, y): scene buffer is y-flipped (GL), image is not
  function lumAt(buf, x, y, flipped) {
    const i = ((flipped ? SH - 1 - y : y) * SW + x) * 4;
    return (buf[i] * 0.3 + buf[i + 1] * 0.55 + buf[i + 2] * 0.15) / 255;
  }

  const imgData = tctx.createImageData(SW, SH);

  function drawFrame(t) {
    let buf, flipped;
    if (source === "image" && imagePixels) {
      buf = imagePixels; flipped = false;
    } else {
      knot.rotation.x = t * 0.5;
      knot.rotation.y = t * 0.34;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.readRenderTargetPixels(rt, 0, 0, SW, SH, scenePixels);
      buf = scenePixels; flipped = true;
    }

    const mode = MODES[modeIdx];
    if (mode === "ASCII") {
      const GW = 110, GH = 65;
      const cw = out.width / GW, ch = out.height / GH;
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.fillStyle = "#070708";
      octx.fillRect(0, 0, out.width, out.height);
      octx.font = `${Math.ceil(ch)}px Consolas, monospace`;
      octx.textBaseline = "top";
      const charW = octx.measureText("@").width;
      octx.setTransform(cw / charW, 0, 0, 1, 0, 0);
      for (let y = 0; y < GH; y++) {
        let row = "";
        for (let x = 0; x < GW; x++) {
          const lum = lumAt(buf, x * 2, (y * 2) | 0, flipped);
          row += RAMP[Math.min(RAMP.length - 1, (lum * RAMP.length) | 0)];
        }
        octx.fillStyle = y % 7 === ((t * 8) | 0) % 7 ? "#4dffa8" : "#2bbf77";
        octx.fillText(row, 0, y * ch);
      }
      octx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }

    // pixel modes render into the SW×SH ImageData then upscale pixelated
    const d = imgData.data;
    for (let y = 0; y < SH; y++) {
      const th = BAYER8[y & 7];
      for (let x = 0; x < SW; x++) {
        const lum = lumAt(buf, x, y, flipped);
        const o = (y * SW + x) * 4;
        let r, g, bch;
        if (mode === "DITHER 1-BIT") {
          const on = lum * 1.3 > th[x & 7];
          [r, g, bch] = on ? [51, 255, 153] : [10, 10, 12];
        } else if (mode === "DITHER 4-COL") {
          const q = lum * 3 + (th[x & 7] - 0.5) * 1.2;
          const p = PAL4[q < 0.75 ? 0 : q < 1.5 ? 1 : q < 2.4 ? 2 : 3];
          [r, g, bch] = p;
        } else { // RAW
          const i = ((flipped ? SH - 1 - y : y) * SW + x) * 4;
          r = buf[i]; g = buf[i + 1]; bch = buf[i + 2];
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = bch; d[o + 3] = 255;
      }
    }
    tctx.putImageData(imgData, 0, 0);
    octx.imageSmoothingEnabled = false;
    octx.fillStyle = "#070708";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(tmp, 0, 0, out.width, out.height);
  }

  if (reducedMotion) {
    drawFrame(1.0);
    modeBtn.addEventListener("click", () => drawFrame(1.0));
    srcBtn.addEventListener("click", () => drawFrame(1.0));
    return {};
  }

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    const t = now / 1000;
    if (source === "image" && imagePixels) {
      if (needsStatic) { drawFrame(t); needsStatic = false; }
    } else {
      drawFrame(t);
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
      out.remove();
    },
  };
}
