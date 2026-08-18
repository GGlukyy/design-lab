// 06 — Scroll-driven 3D corridor. Pinned canvas; camera flies through fog,
// emissive wireframe rings and floating data panels, scrubbed by scroll.
import {
  WebGLRenderer, Scene, PerspectiveCamera, FogExp2, Group, Mesh,
  TorusGeometry, PlaneGeometry, BoxGeometry, MeshBasicMaterial,
  CanvasTexture, LinearFilter, DoubleSide, Color,
} from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const DEPTH = 220; // corridor length in world units

function panelTexture(title, rows) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 288;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(12,15,13,0.92)";
  ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = "#1d8f5c";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 496, 272);
  ctx.fillStyle = "#33ff99";
  ctx.font = "700 26px Consolas, monospace";
  ctx.fillText(title, 28, 52);
  ctx.fillStyle = "#12402c";
  ctx.fillRect(28, 68, 456, 2);
  ctx.font = "400 20px Consolas, monospace";
  rows.forEach((r, i) => {
    ctx.fillStyle = i % 2 ? "#1d8f5c" : "#9adfbe";
    ctx.fillText(r, 28, 108 + i * 34);
  });
  const t = new CanvasTexture(c);
  t.minFilter = LinearFilter;
  return t;
}

export default async function init(section, { reducedMotion }) {
  const layer = section.querySelector(".fx-layer");
  const content = section.querySelector(".section-content");

  if (reducedMotion) {
    layer.style.background =
      "linear-gradient(#0a0a0c, #0d1410 50%, #0a0a0c), radial-gradient(40% 40% at 50% 50%, rgba(51,255,153,0.15), transparent)";
    content.innerHTML = `<h2 class="h-section" style="margin-top:40vh">Corridor</h2>`;
    return {};
  }

  // pin the canvas within the tall section.
  // position:sticky is dead inside an overflow:hidden ancestor — the section
  // must allow overflow for the sticky layer to track the viewport.
  section.style.overflow = "visible";
  layer.style.inset = "auto";
  layer.style.position = "sticky";
  layer.style.top = "0";
  layer.style.height = "100vh";
  layer.style.width = "calc(100% + var(--gutter) * 2)";
  layer.style.margin = "calc(var(--gutter) * -1)";
  layer.style.marginBottom = "0";

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0c);
  layer.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.fog = new FogExp2(0x0a0a0c, 0.028);
  const cam = new PerspectiveCamera(70, 1, 0.1, 400);

  const world = new Group();
  scene.add(world);

  const accent = new Color(0x33ff99);
  const dimGreen = new Color(0x155c3c);

  // ── wireframe rings marching down -z ──
  const ringGeo = new TorusGeometry(6, 0.045, 8, 64);
  const rings = [];
  for (let i = 0; i < 36; i++) {
    const hot = i % 6 === 0;
    const mat = new MeshBasicMaterial({
      color: hot ? accent : dimGreen,
      wireframe: true,
      transparent: true,
      opacity: hot ? 0.9 : 0.5,
    });
    const ring = new Mesh(ringGeo, mat);
    ring.position.z = -i * (DEPTH / 36);
    ring.rotation.z = i * 0.16;
    rings.push(ring);
    world.add(ring);
  }

  // ── floating data panels at story beats ──
  const panels = [
    { z: -28, x: -4.2, y: 0.6, tex: panelTexture("BEAT-01 / ENTRY", ["fog: exp2(0.028)", "camera: z-scrub", "geometry: 36 rings"]) },
    { z: -85, x: 4.4, y: -0.8, tex: panelTexture("BEAT-02 / DRIFT", ["roll: +0.35 rad", "panels: canvas tex", "no lights: basic mat"]) },
    { z: -150, x: -3.8, y: 1.2, tex: panelTexture("BEAT-03 / CORE", ["pulse: sin(t*2)", "emissive wireframe", "scrub: 0.6 smooth"]) },
  ];
  const panelMeshes = panels.map((p) => {
    const m = new Mesh(
      new PlaneGeometry(6.4, 3.6),
      new MeshBasicMaterial({ map: p.tex, transparent: true, side: DoubleSide })
    );
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.x > 0 ? -0.5 : 0.5;
    world.add(m);
    return m;
  });

  // ── scattered emissive boxes (debris) ──
  const boxGeo = new BoxGeometry(0.4, 0.4, 0.4);
  const debris = [];
  for (let i = 0; i < 60; i++) {
    const m = new Mesh(
      boxGeo,
      new MeshBasicMaterial({ color: Math.random() > 0.8 ? accent : dimGreen, wireframe: true })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 3.5 + Math.random() * 5;
    m.position.set(Math.cos(a) * r, Math.sin(a) * r, -Math.random() * DEPTH);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    debris.push(m);
    world.add(m);
  }

  // ── camera choreography: 4 beats via gsap timeline scrubbed by scroll ──
  const rig = { z: 8, x: 0, y: 0, roll: 0, lookX: 0, lookY: 0 };
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
    },
  });
  tl.to(rig, { z: -50, ease: "none", duration: 1 })
    .to(rig, { z: -95, x: 1.6, roll: 0.35, lookX: 0.8, ease: "power1.inOut", duration: 1 })
    .to(rig, { z: -158, x: -1.2, roll: -0.25, lookX: -0.6, lookY: 0.4, ease: "power1.inOut", duration: 1 })
    .to(rig, { z: -DEPTH - 14, x: 0, y: 0, roll: 0, lookX: 0, lookY: 0, ease: "power2.in", duration: 1 });

  function resize() {
    const w = layer.clientWidth, h = layer.clientHeight;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  resize();

  let raf = 0, running = true;
  function step(now) {
    raf = requestAnimationFrame(step);
    const t = now / 1000;
    cam.position.set(rig.x, rig.y, rig.z);
    cam.rotation.set(rig.lookY * 0.3, rig.lookX * 0.3, rig.roll);
    // ring pulse + slow rotation
    for (let i = 0; i < rings.length; i++) {
      rings[i].rotation.z += 0.0006 * (i % 2 ? 1 : -1);
      const hot = i % 6 === 0;
      if (hot) rings[i].material.opacity = 0.65 + 0.3 * Math.sin(t * 2 + i);
    }
    for (const d of debris) {
      d.rotation.x += 0.002;
      d.rotation.y += 0.0016;
    }
    // panels gently bob and face camera-ish
    panelMeshes.forEach((m, i) => {
      m.position.y = panels[i].y + Math.sin(t * 0.8 + i * 2) * 0.15;
    });
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
      ro.disconnect();
      tl.scrollTrigger?.kill();
      tl.kill();
      ringGeo.dispose(); boxGeo.dispose();
      scene.traverse((o) => { o.material?.map?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
