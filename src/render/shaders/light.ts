import { GLSL_NOISE } from '../gl';

/** Rayons de soleil filtrant à travers le feuillage (additif, espace écran). */
export const LIGHT_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;

uniform vec2 uScreen;
uniform vec2 uSrc;
uniform vec3 uSunCol;
uniform float uStrength;
uniform float uTime;
uniform float uWind;
uniform float uHaze;

${GLSL_NOISE}

void main() {
  vec2 rel = vPos - uSrc;
  float dist = length(rel);
  float ang = atan(rel.x, rel.y);
  float t = uTime;
  float sway = sin(t * 0.4) * 0.004 * (1.0 + uWind * 2.0);
  float a = ang + sway;
  float b1 = pow(max(0.0, sin(a * 29.0 + sin(a * 9.0 + t * 0.05) * 2.2)), 10.0);
  float b2 = pow(max(0.0, sin(a * 17.0 + 4.1 + t * 0.02 + sin(a * 5.0) * 2.0)), 16.0) * 0.8;
  float beams = (b1 + b2) * smoothstep(0.25, 0.75, vnoise(vec2(a * 6.0, 3.0)));
  // Scintillement : les feuilles bougent et masquent les faisceaux
  beams *= 0.35 + 0.65 * vnoise(vec2(a * 30.0, t * (0.25 + uWind * 0.6)));
  float fade = smoothstep(uScreen.y * 0.15, uScreen.y * 0.55, dist) * (1.0 - smoothstep(uScreen.y * 0.8, uScreen.y * 1.9, dist));
  // Poussière en suspension dans la lumière
  float dust = pow(vnoise(vPos * 0.11 + vec2(t * 0.35, -t * 0.25)), 24.0) * 2.0;
  vec3 col = uSunCol * beams * (0.11 + uHaze * 0.14 + dust * 0.3) * fade * uStrength;
  finalColor = vec4(col, 0.0);
}
`;

export const FOG_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;
uniform vec2 uScreen;
uniform vec3 uFogCol;
uniform float uFog;
uniform float uTime;
uniform float uHorizon;
${GLSL_NOISE}
void main() {
  vec2 p = vPos / uScreen.y;
  float n = fbm(p * vec2(2.0, 5.0) + vec2(uTime * 0.012, 0.0), 3);
  float band = 0.55 + 0.45 * smoothstep(uHorizon / uScreen.y + 0.4, uHorizon / uScreen.y - 0.05, p.y);
  float a = uFog * clamp(n * 1.25, 0.0, 1.0) * band * 0.85;
  finalColor = vec4(uFogCol * a, a);
}
`;
