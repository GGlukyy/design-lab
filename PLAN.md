# PLAN — Interactive Design Lab

Accent: **phosphor green #33ff99**. Fonts: system grotesque stack for UI, IBM Plex Mono fallback chain for readouts. All modules lazy-init via IntersectionObserver in `src/main.js`, pause off-screen, expose `destroy/pause/resume`, and render a static fallback under `prefers-reduced-motion`.

## 01 — Hero fluid ink (raw WebGL)
Stable-fluids solver on ping-pong half-float FBOs: advect velocity → splat pointer force/dye → 20-iteration Jacobi pressure solve → subtract gradient → advect dye. Raw WebGL2 (no Three) for full FBO control; sim at 1/4 resolution, dye at 1/2. Dye tinted phosphor green over near-black; title HTML on top. Risks: half-float support / mobile precision — fall back to `EXT_color_buffer_float` checks and byte textures; idle "auto-splat" drift so it looks alive without a pointer.

## 02 — Particle text morph (Three.js points + custom shader)
Rasterize headlines to an offscreen 2D canvas, sample opaque pixels → target positions per word. One BufferGeometry of ~12k points with attributes for target A/B; morph driven by scroll progress within the section, curl-noise displacement in the vertex shader while `mix` factor is mid-transition. Risks: point-size consistency across DPR — set via uniform scaled by `devicePixelRatio`.

## 03 — CRT / glitch panel (Three.js scene→FBO→post shader)
Render an HTML-look content card into a texture (draw it with 2D canvas → texture, cheaper than html2canvas), then fullscreen quad shader: barrel distortion, scanlines, RGB aberration, vignette, animated tracking-glitch line triggered on hover + random interval. Intensity uniform bound to a range input styled monospace. Risks: text legibility — keep distortion subtle at rest.

## 04 — Magnetic + elastic (vanilla JS + SVG)
Damped-spring (semi-implicit Euler) attraction of buttons/cards toward cursor within a radius, translate3d only. Elastic divider: SVG path with control point spring-following pointer crossing, releasing into oscillation. No canvas needed. Risks: none serious; keep springs critically-ish damped to avoid jitter.

## 05 — Infinite drag grid (Three.js instanced quads)
Grid of planes with procedural gradient/noise textures generated on 2D canvas at init. Drag with pointer capture + inertia (velocity sampling, exponential decay); positions wrap modulo grid extent. Fragment shader applies RGB-shift + directional blur scaled by |velocity|. Risks: wrap seams — use modulo in JS per-tile, not shader.

## 06 — Scroll corridor (Three.js + GSAP ScrollTrigger)
Tall section (400vh) with pinned canvas; camera moves along a path through fog, emissive wireframe rings/panels, floating monospace "data panels" (canvas textures). 3–4 beats choreographed on scroll progress with GSAP timeline. Risks: pin jank on mobile — use `scrub: 0.5` smoothing and cheap geometry.

## 07 — Kinetic typography (SVG textPath + canvas marquee)
Text on curved SVG paths, per-character proximity reaction (scale/rotation/weight via transform) using cached glyph positions. Marquee ribbon: canvas-drawn repeated text strip whose scroll speed follows a smoothed scroll-velocity signal. Risks: layout cost of per-char spans — cap char count, use transforms only.

## 08 — ASCII renderer (Three.js offscreen → 2D canvas text)
Rotating torus-knot rendered to small FBO (~120×60), read back luminance with `readPixels`, map to density ramp ` .:-=+*#%@` drawn as monospace text on 2D canvas. Toggle button swaps raw render / ASCII. Risks: readPixels stall — tiny buffer size keeps it cheap; throttle to 30 fps if needed.

## 09 — Generative finale (2D canvas flow field)
Flow field from layered value noise; heading seeded by time-of-day (hour rotates the field's base angle, minute shifts hue-lightness of green). ~1500 particles with fading trails (translucent fill rect), gentle pointer repulsion. Doubles as footer with contact links. Risks: fillRect trail ghosting banding — use `globalCompositeOperation` and slight alpha floor.
