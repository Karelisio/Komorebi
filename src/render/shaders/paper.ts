import { GLSL_NOISE } from '../gl';

/**
 * Papier aquarelle (mélange « multiply ») : grain et fibres, légères variations de pigment,
 * ombre mouvante du feuillage qui surplombe le bassin, vignette chaude.
 */
export const PAPER_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;

uniform vec2 uScreen;
uniform float uTime;
uniform float uWind;
uniform float uShade;
uniform float uGrain;

${GLSL_NOISE}

void main() {
  vec2 p = vPos / uScreen.y;
  // Grain du papier : fibres fines et creux du papier à grain torchon
  float fiber = vnoise(vPos * vec2(0.9, 0.35)) * 0.5 + vnoise(vPos * 0.23) * 0.5;
  float tooth = vnoise(vPos * 0.07 + 3.1);
  float grain = 1.0 - uGrain * (0.05 * fiber + 0.06 * smoothstep(0.55, 0.9, tooth));
  // Variations lentes du pigment (zones un peu plus chaudes ou plus froides)
  float b = fbm(p * 2.2 + 7.0, 3);
  vec3 tint = mix(vec3(1.0, 0.975, 0.93), vec3(0.97, 0.985, 1.0), b);
  // Ombre du feuillage du coin supérieur gauche, qui bouge avec le vent
  vec2 sway = vec2(sin(uTime * 0.5), cos(uTime * 0.37)) * 0.006 * (0.4 + uWind * 1.6);
  float leaves = fbm((p + sway) * 9.0, 3);
  float mask = 1.0 - smoothstep(0.15, 0.62, length((p - vec2(0.0, 0.0)) * vec2(1.0, 1.25)));
  float shade = smoothstep(0.42, 0.6, leaves) * mask * uShade;
  // Vignette chaude
  float vig = smoothstep(1.25, 0.35, length((vPos / uScreen - 0.5) * vec2(1.0, 1.35)));
  vec3 col = tint * grain * (1.0 - shade * 0.32) * mix(vec3(0.86, 0.8, 0.74), vec3(1.0), vig);
  finalColor = vec4(col, 1.0);
}
`;

/** Taches de soleil (komorebi) qui dansent sur la berge et l'eau (mélange additif). */
export const DAPPLE_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;

uniform vec2 uScreen;
uniform float uTime;
uniform float uWind;
uniform float uSun;
uniform vec3 uSunCol;

${GLSL_NOISE}

void main() {
  vec2 p = vPos / uScreen.y;
  vec2 drift = vec2(sin(uTime * 0.6), cos(uTime * 0.45)) * 0.004 * (0.4 + uWind * 1.8);
  float a = vnoise((p + drift) * 26.0);
  float b = vnoise((p - drift * 0.7) * 17.0 + 4.0);
  float spots = smoothstep(0.7, 0.86, a * 0.55 + b * 0.45);
  // Les taches n'existent que sous le feuillage (coin supérieur gauche et bords)
  float under = 1.0 - smoothstep(0.2, 0.75, length(p * vec2(1.0, 1.2)));
  under = max(under, (1.0 - smoothstep(0.0, 0.16, min(p.x, uScreen.x / uScreen.y - p.x))) * 0.6);
  vec3 col = uSunCol * spots * under * uSun * 0.22;
  finalColor = vec4(col, 0.0);
}
`;
