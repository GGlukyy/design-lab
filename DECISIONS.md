# DECISIONS

- **Accent color: phosphor green `#33ff99`** (over amber). Better fit for CRT/terminal aesthetic and reads well on #0a0a0c.
- **Fonts: no self-hosted font.** System grotesque stack (Inter/Helvetica/Segoe) + monospace stack (IBM Plex Mono → Cascadia → Consolas). Keeps the build dependency-free and fast; variable-font weight axis in module 07 replaced with transform-based reaction.
- **Module 01 in raw WebGL2**, modules 02/03/05/06/08 via Three.js as thin wrapper (own shaders), 04/07 DOM/SVG, 09 2D canvas. Right tool per effect.
- **Scaffolded Vite manually** (package.json written directly) instead of `npm create vite` — the interactive scaffolder wastes time and its template adds files we'd delete.
- **Screenshot tool captures per-section PNGs at 1440×900 and 390×844**, fails on any console error or pageerror. Warnings are reported but don't block.
- **Global grain + scanlines done in CSS** (SVG feTurbulence data-URI + repeating gradient), fixed overlays. Costs ~0 fps vs a fullscreen shader pass.
- **Module 02 morph is scroll-position driven, not GPGPU.** Targets precomputed as vertex attributes (one per word); all motion in the vertex shader. Simpler than ping-pong position textures and indistinguishable at 11k points.
- **Module 06 pins via `position: sticky`** on the fx-layer inside a 400vh section instead of GSAP pinning — avoids ScrollTrigger pin-spacer reflow jank; the timeline only scrubs the camera rig.
- **Module 07 uses transform-based character reaction** (lift/rotate/scale) instead of a variable-font weight axis, since no variable font is self-hosted (system stack has no reliable wght axis).
- **Module 08 grid is 110×56 with `readRenderTargetPixels`** — the readback is ~25 KB and did not register in the FPS probe, so no async PBO tricks needed.
- **Kinetic bug fixed:** first rAF timestamp can precede `performance.now()` captured at init → negative `dt` produced an invalid SVG `startOffset` ("--x%"). All module loops clamp `dt ≥ 0` where it feeds attributes.
- **Mobile: right-side `.readout-status` labels hidden < 700px** — they collided with the section readouts at 390px.
## Extension (modules 10–15)

- **Module 10 "blue noise" is interleaved gradient noise**, not a precomputed blue-noise texture — IGN is isotropic enough at this scale, needs zero assets, and the toggle contrast vs Bayer-8 is clearly visible.
- **Module 10 renders at a fixed 420×262 internal target** with `image-rendering: pixelated` upscaling; the chunk is the aesthetic, and it makes the post pass cost independent of viewport size.
- **Module 11 tears two ways**: constraint overstretch (3.4× rest length) and violent grab (pointer > ~2 cells from the grabbed node kills ~half its constraints) — reads better than overstretch alone.
- **Modules 12/15 in raw WebGL2** (like 01); 10 via Three (needs a lit mesh scene). 11/13/14 are Canvas 2D — the math is the effect, GPU adds nothing at these element counts.
- **Bug found in 12, worth remembering:** hard-coding vertex attribute location 0 instead of `getAttribLocation` gave a silently blank canvas (no GL error). Module 01 only worked by luck. 12/15 query the location.
- **Screenshot tool settle wait bumped 1300→1700 ms** — module 13's first capture raced lazy-init and produced a blank frame that looked like a bug; the module was fine.
- **Module 13 fill is blitted at field resolution** (10px spans) under the smooth lerped contour — the slight stair-step is kept as an intentional lo-fi texture consistent with 10.
- **Module 14 predator marker is the one non-green accent** (muted red-orange crosshair) — a deliberate semantic exception recorded here so it isn't "fixed" later.
## User-feedback pass (2026-07-20)

- **Page reordered to 14 sections**: finale moved to the end (displayed `14 / FINALE`), old 10-dither merged into 08 as `ASCII×DITHER` (one source buffer, four render modes + image drag & drop). Displayed numbers are sequential 01–14; module folders keep historical names (`11-cloth` shows as 09, etc.) to avoid churn in imports/screenshots.
- **Corridor pin fixed**: `position: sticky` silently fails inside the section's `overflow: hidden` — module 06 now sets its section to `overflow: visible`. Verified mid-scroll via Playwright (canvas rect covers viewport at 50% section depth).
- **Root cause of "dead buttons" (incl. cloth RESET)**: inline `all: unset` on styled buttons reset `pointer-events` to the value inherited from `.section-content` (`none`), and inline beats the stylesheet re-enable. Fixed with `!important` on the `.section-content` interactive-elements rule.
- **Cloth grab rewritten**: node eases toward pointer with a per-frame step cap (0.9× spacing) instead of teleporting — fast mouse motion no longer detonates the mesh; the random shred-on-yank block is gone (natural overstretch tearing remains). Pointer capture + `pointercancel`/`blur` handlers stop stuck grabs when the button is released outside the window.
- **Finale background**: trail fade switched from low-alpha paint (leaves a permanent residue floor due to 8-bit quantization) to `destination-out` alpha erase over a transparent canvas — background is now genuinely #0a0a0c. Footer links point to github.com/GGlukyy and ggluki.itch.io.
- **COPY SRC buttons** on every section: lazy `import.meta.glob(..., ?raw)` pulls the module's own files and writes them to the clipboard with a usage header — works in dev and production builds.
- **QA results (headless SwiftShader, lower bound):** 58–60 fps avg on 13 of 14 sections; s11 (cloth) reads ~28 fps in the probe because at that scroll position the software renderer is CPU-rasterizing three neighbor sections at once (s08 readback + raymarch) — each section alone probes 60, hardware GL is unaffected. Reduced-motion renders static fallbacks with zero console errors across all 14; `npm run build` outputs static dist (three.js chunk ~116 KB gzip).
