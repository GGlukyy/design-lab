# Interactive Design Lab

Nine interactive web effects, each written from scratch — raw WebGL2, GLSL, Canvas 2D, SVG, and vanilla JS. Three.js is used only as a thin WebGL wrapper (all shaders are authored here); GSAP ScrollTrigger only for scroll choreography. No effect libraries.

**Run:** `npm install && npm run dev` · **Build:** `npm run build` (static output in `dist/`) · **QA:** `node tools/screenshot.mjs` and `node tools/qa.mjs` with the dev server running.

Every module lazy-initializes when its section enters the viewport (IntersectionObserver), pauses its rAF loop off-screen, disposes GPU resources on destroy, and renders a static styled frame under `prefers-reduced-motion`. Shared design tokens live in `src/styles/tokens.css`; the global grain + scanline overlay is pure CSS (SVG feTurbulence data-URI + repeating gradient).

## Module techniques

### 01 — Fluid ink (raw WebGL2)
A stable-fluids solver on half-float ping-pong FBOs: each frame semi-Lagrangian-advects the velocity field into itself, splats pointer force and dye as Gaussians, computes divergence, runs 22 Jacobi iterations to solve for pressure, subtracts the pressure gradient to make the field divergence-free, then advects the dye through the corrected velocity. Simulation runs at 192px, dye at 768px; a display shader maps dye density through a two-stop phosphor palette with flicker and vignette. An idle Lissajous "auto-splat" keeps the hero alive without input.

### 02 — Particle text morph (Three.js points, custom shaders)
Each headline is drawn to an offscreen 2D canvas and its opaque pixels sampled into 11k target positions, stored as three vertex attributes (one per word). The vertex shader interpolates between targets with a per-particle staggered smoothstep driven by scroll progress, adds sine-based curl noise that peaks mid-transit (`sin(π·t)`), and brightens transiting particles. No CPU work per frame beyond one uniform.

### 03 — CRT / glitch panel (canvas texture → post shader)
A terminal-style card is drawn with Canvas 2D at ~20 fps and uploaded as a texture. The fullscreen fragment shader applies barrel distortion (radial `r²` remap), per-scanline horizontal jitter, chromatic aberration growing toward the edges, scanlines + aperture grille, and a VHS tracking band — a traveling `exp` falloff that tears rows sideways, eased in on hover and fired randomly on a timer. A monospace slider drives the master intensity uniform.

### 04 — Magnetic + elastic (vanilla JS + SVG)
Buttons integrate a damped spring (`v += (k·(target−x) − c·v)·dt`, semi-implicit Euler) whose target is a fraction of the cursor offset inside an attraction radius — zero outside, so elements snap home. The divider is a quadratic Bézier whose control point is spring-driven: stiff and heavily damped while the pointer drags it, soft and underdamped when released, producing the elastic wobble.

### 05 — Infinite drag grid (Three.js instanced-style tiles)
5×4 planes with procedurally generated canvas textures (seeded gradients, noise speckle, rings/bars/waveforms, technical labels). Pointer drag accumulates a world-space offset; each tile's position is the base position plus offset wrapped modulo the grid span, so the field is endless with no seams. Released velocity decays exponentially for inertia. The shared shader smears tiles with velocity: vertex skew, per-channel RGB offset along the drag direction, and a cheap 2-tap directional blur.

### 06 — Scroll corridor (Three.js + GSAP ScrollTrigger)
A 400vh section with a sticky canvas. The camera rig (position, roll, look offsets) is animated by a 4-beat GSAP timeline scrubbed by scroll (`scrub: 0.6` for smoothing): straight run, starboard drift, port counter-roll, and a final accelerating dive past the last ring. The space is 36 wireframe tori marching down −z through exponential fog, 60 wireframe debris cubes, and three canvas-textured data panels placed at beat waypoints. Everything uses MeshBasicMaterial — no lights, so fill rate stays cheap.

### 07 — Kinetic typography (SVG + Canvas)
Three systems: (1) text on a curved `<textPath>` whose `startOffset` drifts continuously and speeds up with scroll; (2) a headline whose characters compute distance to the cursor each frame and ease lift/rotation/scale with a quadratic falloff — direction-aware so letters lean away; (3) a canvas marquee that measures one text repetition and tiles it, with speed and opacity driven by a low-pass-filtered scroll-velocity signal (direction included, so scrolling up reverses it).

### 08 — ASCII renderer (Three.js RTT + readPixels)
A torus-knot with MeshNormalMaterial renders into a 110×56 WebGLRenderTarget; the buffer is read back with `readRenderTargetPixels` (tiny, so the GPU stall is negligible), luminance-mapped through the density ramp ` .:-=+*#%@`, and drawn as monospace rows on a 2D canvas with a horizontal transform so the glyph advance exactly fills the panel. A toggle swaps in the raw WebGL render for comparison.

### 09 — Generative finale (Canvas 2D flow field)
A permutation-table value noise (two octaves) defines a flow field whose base angle is seeded by the time of day — the whole field slowly rotates through 360° across 24 h, and the noise table is seeded from hh:mm, so every visit composes differently. 1400 particles integrate the field, leave trails via a low-alpha fill each frame, are repelled by the pointer, and respawn when they exit or randomly (keeps density uniform). Doubles as the footer behind the contact links.

## Extraction notes
Each module is a self-contained folder exporting `init(section, { reducedMotion }) → { pause, resume, destroy }` with no cross-module imports — copy the folder, provide a container element, and wire the lifecycle to your own observer.
