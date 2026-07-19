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
- **QA results (headless, lower bound):** all 9 sections 59–60 fps avg; reduced-motion run renders static fallbacks with zero console errors; `npm run build` outputs static dist (three.js chunk 115 KB gzip).
