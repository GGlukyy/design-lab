// GLSL for the stable-fluids solver. All programs share the base vertex shader.
export const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Semi-Lagrangian advection
export const ADVECT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;      // 1/simRes
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  frag = uDissipation * texture(uSource, coord);
  frag.a = 1.0;
}`;

// Gaussian splat of force (velocity) or color (dye)
export const SPLAT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float g = exp(-dot(p, p) / uRadius);
  vec3 base = texture(uTarget, vUv).xyz;
  frag = vec4(base + g * uValue, 1.0);
}`;

export const DIVERGENCE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  vec2 C = texture(uVelocity, vUv).xy;
  // solid boundary: reflect at edges
  if (vUv.x - uTexel.x < 0.0) L = -C.x;
  if (vUv.x + uTexel.x > 1.0) R = -C.x;
  if (vUv.y - uTexel.y < 0.0) B = -C.y;
  if (vUv.y + uTexel.y > 1.0) T = -C.y;
  frag = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

export const PRESSURE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float div = texture(uDivergence, vUv).x;
  frag = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

export const GRADIENT_SUBTRACT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 vel = texture(uVelocity, vUv).xy;
  frag = vec4(vel - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
}`;

// Display: dye density -> phosphor palette with soft glow + vignette
export const DISPLAY = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uDye;
uniform vec3 uTintA;   // deep green
uniform vec3 uTintB;   // hot phosphor
uniform float uTime;
void main() {
  vec3 d = texture(uDye, vUv).rgb;
  float density = clamp(dot(d, vec3(0.45)), 0.0, 1.6);
  vec3 col = vec3(0.039, 0.039, 0.047); // #0a0a0c
  col += uTintA * smoothstep(0.0, 0.9, density) * 0.85;
  col += uTintB * smoothstep(0.45, 1.5, density);
  // faint phosphor flicker
  col *= 0.985 + 0.015 * sin(uTime * 23.0 + vUv.y * 400.0);
  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;
  frag = vec4(col, 1.0);
}`;
