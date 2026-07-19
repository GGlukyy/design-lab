# DECISIONS

- **Accent color: phosphor green `#33ff99`** (over amber). Better fit for CRT/terminal aesthetic and reads well on #0a0a0c.
- **Fonts: no self-hosted font.** System grotesque stack (Inter/Helvetica/Segoe) + monospace stack (IBM Plex Mono → Cascadia → Consolas). Keeps the build dependency-free and fast; variable-font weight axis in module 07 replaced with transform-based reaction.
- **Module 01 in raw WebGL2**, modules 02/03/05/06/08 via Three.js as thin wrapper (own shaders), 04/07 DOM/SVG, 09 2D canvas. Right tool per effect.
- **Scaffolded Vite manually** (package.json written directly) instead of `npm create vite` — the interactive scaffolder wastes time and its template adds files we'd delete.
- **Screenshot tool captures per-section PNGs at 1440×900 and 390×844**, fails on any console error or pageerror. Warnings are reported but don't block.
- **Global grain + scanlines done in CSS** (SVG feTurbulence data-URI + repeating gradient), fixed overlays. Costs ~0 fps vs a fullscreen shader pass.
