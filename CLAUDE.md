# Interactive Design Lab — CLAUDE.md

## What this project is
A single-page "Interactive Design Lab": a showcase of 9 interactive web effects, each built **from scratch** (raw WebGL / Canvas / GLSL / vanilla JS). This is a portfolio R&D playground — the best modules will later be transplanted into the owner's real portfolio site (single-file HTML/CSS/JS, WebGL nebula background, glass UI, CZ/EN toggle).

## Hard rules
1. **No effect libraries.** Forbidden: particles.js, curtains.js, vanta.js, tsparticles, any "webgl effect" npm package. Allowed: Three.js (as a thin WebGL wrapper only — write your own shaders/materials), GSAP core + ScrollTrigger for scroll choreography. Everything visual must be authored here.
2. **Work autonomously.** Do not ask the user questions. Make a decision, note it in DECISIONS.md, move on.
3. **Verify visually after every module.** Use Playwright (headless Chromium) to screenshot each section into `output/<nn>-<effect>.png` at 1440×900 and 390×844 (mobile). Check the browser console for errors/warnings via Playwright and fix them before moving on. If a screenshot looks broken (blank, NaN artifacts, missing canvas), treat it as a failing test.
4. **Performance is a feature.** 60 fps target. Every effect must: lazy-init only when its section enters the viewport (IntersectionObserver), pause rAF loops when off-screen, dispose GPU resources when destroyed, and respect `prefers-reduced-motion` (fall back to a static styled frame).
5. **One design system, not demo soup.** All sections share tokens defined in `src/styles/tokens.css`. Every effect must feel like it belongs to the same site.

## Aesthetic direction
- Dark, lo-fi, analog-tech. Think PS2-era menus, CRT phosphor, VHS artifacts — but executed with modern precision, not as a joke.
- Palette: near-black background (#0a0a0c), off-white text (#e8e6e1), one hot accent (phosphor green #33ff99 or amber #ffb347 — pick one, commit, record in DECISIONS.md), muted supporting grays.
- Typography: one grotesque sans for UI (system stack or a single self-hosted variable font), one monospace for labels/technical annotations. Big, confident type. Section labels styled like technical readouts (`01 / FLUID`, `02 / SCRAMBLE`...).
- Subtle global grain/scanline overlay tying sections together (cheap: one fullscreen shader or CSS, must not tank fps).
- Motion language: precise and slightly mechanical. Ease-out-expo for entrances, spring physics for pointer interactions. No bounce-for-bounce's-sake.

## The 9 modules (build in this order)
1. **Hero — fluid ink** · Fullscreen GPU fluid simulation (stable-fluids style: velocity/pressure/dye ping-pong FBOs) reacting to pointer. Site title rendered on top; fluid dye tinted with the accent color.
2. **Particle text morph** · Headline text rasterized to particle targets; particles scatter on scroll-out and reassemble into the next headline. GPGPU or instanced points, curl-noise while in transit.
3. **CRT / glitch panel** · A content card rendered through a CRT post-process shader: barrel distortion, scanlines, chromatic aberration, occasional VHS tracking glitch triggered on hover. Include an intensity slider (monospace UI) so it doubles as a shader playground.
4. **Magnetic + elastic elements** · Buttons and cards with spring-physics attraction to the cursor (verlet or simple damped spring, no library), plus an elastic SVG divider line that deforms as the pointer crosses it.
5. **Infinite drag grid** · A draggable, inertial, infinitely-wrapping WebGL image grid. RGB-shift/blur distortion proportional to drag velocity. Use generated placeholder art (procedural gradients/noise textures) — no external images.
6. **Scroll-driven 3D corridor** · Camera flying through an abstract 3D space (fog, emissive wireframe geometry, floating panels) bound to scroll progress. This is the "cinematic" centerpiece — choreograph 3–4 distinct beats.
7. **Kinetic typography** · Text on curved paths, characters reacting to cursor proximity (weight/rotation via variable font axis or transform), one marquee ribbon whose speed follows scroll velocity.
8. **ASCII renderer** · A small animated 3D scene (rotating object) live-converted to ASCII/Unicode density characters on canvas. Toggle between ASCII and raw render. Leans into the cyberbrutalism trend.
9. **Generative finale** · Full-viewport generative particle/flow-field system seeded by time of day, gently reactive to pointer. Doubles as the footer background with contact links.

## Project structure
```
/index.html            single entry
/src/main.js           module registry + lazy loader
/src/styles/tokens.css design tokens
/src/styles/base.css   layout, type, overlay
/src/modules/<nn>-<name>/  one folder per effect: index.js, shaders as .glsl.js template strings
/tools/screenshot.mjs  Playwright capture script (all sections, both viewports, console error check)
/output/               screenshots (committed)
DECISIONS.md           running log of choices made autonomously
README.md              per-module technique write-up (written last)
```
Use Vite for dev/build (`npm create vite@latest`). Keep the production build deployable as static files.

## Working loop (repeat per module)
1. Implement module + register it in main.js with lazy init.
2. `node tools/screenshot.mjs` → verify screenshots + zero console errors.
3. Quick perf sanity: log dropped-frame estimate; if a module can't hold ~60 fps, simplify until it does.
4. Commit with message `feat(nn-name): <what>`. Then next module.

## Final pass (reserve time for this)
- Global QA run: full-page scroll-through capture, mobile viewports, reduced-motion check.
- Unify easings/timings; add section index nav (dots or the `01/09` readout style).
- Write README.md: for each module, 3–5 sentences on the technique (what's happening in the shader/physics), so modules are easy to extract into the real portfolio later.
- Produce `output/demo.gif` or a short webm scroll-through via Playwright.

## Definition of done
- All 9 modules render with zero console errors at both viewports.
- 60 fps on desktop for every section in isolation.
- Reduced-motion fallback exists everywhere.
- README + DECISIONS complete. `npm run build` produces a working static build.
