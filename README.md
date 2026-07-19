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

### 08 — ASCII × Dither (Three.js RTT + CPU renderers, drag & drop)
One 220×130 source buffer feeds four interchangeable renderers. The source is either a live torus-knot render read back with `readRenderTargetPixels`, or any image dropped onto the panel (cover-fit into the buffer, cached). Modes: ASCII — luminance mapped through the density ramp ` .:-=+*#%@` drawn as monospace rows stretched to fill the panel; Bayer-8 ordered dither in 1-bit (background/phosphor) or a 4-level near-black → deep-green → phosphor → off-white ramp, Obra Dinn style (the 8×8 matrix is built recursively at init); and raw low-res pixels. Static image sources re-render only on mode change.

### 09 — Cloth (verlet + distance constraints, Canvas 2D · folder `11-cloth`)
A 42×24 particle grid integrates position-verlet with damping, gravity, and a spatially varying sine wind; every third top node is pinned. Three Gauss-Seidel iterations per frame satisfy the structural distance constraints; a constraint stretched past 3.4× its rest length dies (tear); the grabbed node eases toward the pointer with a capped per-frame step, so hard pulls stretch neighbors past the tear threshold instead of detonating the mesh. Rendering is a translucent quad fill shaded by local stretch (a cheap stand-in for lighting) under a single batched wireframe path.

### 10 — Raymarch (raw WebGL2 fullscreen SDF · folder `12-raymarch`)
A 90-step sphere-tracer over a `map()` of sphere ⊔ torus ⊔ box ⊔ ground, all blended with polynomial smooth-min so the shapes read as one morphing mass. Shading: central-difference normals, iq-style soft shadows (penumbra from the closest-miss ratio during the shadow march), one-tap ambient occlusion, specular + fresnel rim in the accent color, and distance fog into the page background. The key light hangs off the smoothed pointer position. Marches at 0.7× DPR since the SDF march dominates cost.

### 11 — Metaballs (marching squares, Canvas 2D · folder `13-metaballs`)
Seven blobs orbit anchors while the pointer contributes its own ball; the scalar field `Σ r²/d²` is evaluated on a 10px grid. Marching squares with linear edge interpolation extracts a crisp iso-contour (all 16 cell cases, including the two saddles); the interior fills as batched horizontal cell spans under an animated linear gradient, so merges and splits stay gooey.

### 12 — Boids (flocking + spatial hash, Canvas 2D · folder `14-boids`)
Classic separation/alignment/cohesion steering with clamped force and a speed floor so the flock never stalls. Neighbor lookup uses a spatial hash rebuilt each frame (cell size = view radius, 9-cell probe), taking the pairwise test from O(n²) to O(n·k) for 300 agents. The pointer is a predator: boids inside its radius get a strong distance-weighted flee force and brighten. Motion trails come free from a translucent background fill; agents draw as velocity-aligned triangles.

### 13 — Halftone (raw WebGL2, rotated print screens · folder `15-halftone`)
The "image" is itself procedural — drifting Gaussian blobs plus a diagonal sweep define a luminance field. Three halftone screens sample it at the classic print angles (15°/45°/75°), each with its own cell size and ink (deep green, phosphor, off-white): per fragment the pixel is rotated into screen space, snapped to its cell, the source luminance is sampled at the cell center back in image space, and the dot radius is `√lum` (area-linear coverage, like real halftoning). Overlapping screens produce the rosette moiré; a Gaussian falloff around the pointer adds dot gain.

### 14 — Generative finale (Canvas 2D flow field · folder `09-finale`)
A permutation-table value noise (two octaves) defines a flow field whose base angle is seeded by the time of day — the whole field slowly rotates through 360° across 24 h, and the noise table is seeded from hh:mm, so every visit composes differently. 1400 particles integrate the field, leave trails that decay via a `destination-out` alpha fade (so the background stays truly black), are repelled by the pointer, and respawn when they exit. Doubles as the footer behind the contact links.

## Extraction notes
Each module is a self-contained folder exporting `init(section, { reducedMotion }) → { pause, resume, destroy }` with no cross-module imports — copy the folder, provide a container element, and wire the lifecycle to your own observer. Or just hit the **⧉ COPY SRC** button in any section's corner — it puts that module's full source (shaders included) on the clipboard. Section numbers on the page follow display order; a few module folders keep their original historical numbers (noted per section above).
