// Module registry + lazy loader.
// Each module folder exports default async (section) => ({ destroy, pause?, resume? })
const registry = {
  "01-fluid": () => import("./modules/01-fluid/index.js"),
  "02-particles": () => import("./modules/02-particles/index.js"),
  "03-crt": () => import("./modules/03-crt/index.js"),
  "04-magnetic": () => import("./modules/04-magnetic/index.js"),
  "05-grid": () => import("./modules/05-grid/index.js"),
  "06-corridor": () => import("./modules/06-corridor/index.js"),
  "07-kinetic": () => import("./modules/07-kinetic/index.js"),
  "08-ascii": () => import("./modules/08-ascii/index.js"),
  "09-finale": () => import("./modules/09-finale/index.js"),
  "10-dither": () => import("./modules/10-dither/index.js"),
  "11-cloth": () => import("./modules/11-cloth/index.js"),
  "12-raymarch": () => import("./modules/12-raymarch/index.js"),
  "13-metaballs": () => import("./modules/13-metaballs/index.js"),
  "14-boids": () => import("./modules/14-boids/index.js"),
  "15-halftone": () => import("./modules/15-halftone/index.js"),
};

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const instances = new Map(); // section el -> { state: 'idle'|'loading'|'live', api }

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const el = entry.target;
      const name = el.dataset.module;
      if (!registry[name]) continue;
      let inst = instances.get(el);
      if (entry.isIntersecting) {
        if (!inst) {
          inst = { state: "loading", api: null };
          instances.set(el, inst);
          registry[name]()
            .then((m) => m.default(el, { reducedMotion }))
            .then((api) => {
              inst.state = "live";
              inst.api = api || {};
              // if it scrolled away while loading, pause immediately
              if (!el.dataset.visible && inst.api.pause) inst.api.pause();
            })
            .catch((err) => console.error(`[lab] module ${name} failed:`, err));
        } else if (inst.api?.resume) {
          inst.api.resume();
        }
        el.dataset.visible = "1";
      } else {
        delete el.dataset.visible;
        if (inst?.api?.pause) inst.api.pause();
      }
    }
  },
  { rootMargin: "20% 0px 20% 0px" }
);

document.querySelectorAll(".lab-section[data-module]").forEach((el) => io.observe(el));

// ── section index nav highlight ──
const navLinks = [...document.querySelectorAll(".lab-nav a")];
const sections = [...document.querySelectorAll(".lab-section")];
const navIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = sections.indexOf(e.target);
      navLinks.forEach((a, j) => a.classList.toggle("active", i === j));
    }
  },
  { rootMargin: "-45% 0px -45% 0px" }
);
sections.forEach((s) => navIO.observe(s));
