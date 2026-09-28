import { GLSL_NOISE } from '../gl';

/** Rayons de soleil filtrant à travers le feuillage (additif, espace écran). */
export const LIGHT_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uNoise;
uniform vec2 uScreen;
uniform vec2 uSrc;
uniform vec3 uSunCol;
uniform float uStrength;
uniform float uTime;
uniform float uWind;
uniform float uHaze;
uniform float uHorizon;

void main() {
  vec2 rel = vPos - uSrc;
  float dist = length(rel);
  float ang = atan(rel.x, rel.y);
  float t = uTime;
  float sway = sin(t * 0.4) * 0.004 * (1.0 + uWind * 2.0);
  float a = ang + sway;
  // Quelques faisceaux larges et doux, dont l'intensité varie comme le feuillage qui bouge
  float b1 = pow(max(0.0, sin(a * 9.0 + sin(a * 3.0 + t * 0.04) * 1.5)), 3.0);
  float b2 = pow(max(0.0, sin(a * 14.0 + 2.1 - t * 0.03)), 4.0) * 0.6;
  float flick = texture(uNoise, vec2(a * 0.6, t * 0.012)).r;
  float beams = (b1 + b2) * smoothstep(0.3, 0.8, flick);
  float fade = smoothstep(uScreen.y * 0.1, uScreen.y * 0.5, dist) * (1.0 - smoothstep(uScreen.y * 0.7, uScreen.y * 1.6, dist));
  fade *= smoothstep(uHorizon - 40.0, uHorizon + 160.0, vPos.y);
  float dust = pow(texture(uNoise, vPos / 90.0 + vec2(t * 0.004, -t * 0.003)).g, 12.0) * 2.0;
  vec3 col = uSunCol * beams * (0.07 + uHaze * 0.1 + dust * 0.3) * fade * uStrength;
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
