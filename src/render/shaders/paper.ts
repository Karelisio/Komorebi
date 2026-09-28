/**
 * Papier aquarelle (mélange « multiply ») : grain et fibres, légères variations de pigment,
 * ombre mouvante du feuillage qui surplombe le bassin, vignette chaude.
 * Tout le bruit vient d'une texture tuilable (peu coûteux sur mobile).
 */
export const PAPER_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uNoise;
uniform vec2 uScreen;
uniform float uTime;
uniform float uWind;
uniform float uShade;
uniform float uGrain;

void main() {
  vec2 p = vPos / uScreen.y;
  // Grain du papier : fibres fines et creux du papier à grain torchon
  vec4 fine = texture(uNoise, vPos / vec2(70.0, 180.0));
  vec4 tooth = texture(uNoise, vPos / 23.0 + 0.3);
  float grain = 1.0 - uGrain * (0.05 * fine.r + 0.06 * smoothstep(0.55, 0.9, tooth.g));
  // Variations lentes du pigment
  float b = texture(uNoise, p * 0.55 + 0.17).b;
  // Ombre du feuillage du coin supérieur gauche, qui bouge avec le vent
  vec2 sway = vec2(sin(uTime * 0.5), cos(uTime * 0.37)) * 0.006 * (0.4 + uWind * 1.6);
  float leaves = texture(uNoise, (p + sway) * 2.2).a;
  float mask = 1.0 - smoothstep(0.15, 0.62, length(p * vec2(1.0, 1.25)));
  float shade = smoothstep(0.45, 0.62, leaves) * mask * uShade;
  // Vignette chaude
  float vig = smoothstep(1.25, 0.35, length((vPos / uScreen - 0.5) * vec2(1.0, 1.35)));
  // Mélange normal (le mode « multiply » coûte une passe complète) : un voile brun chaud,
  // plus dense dans les creux du papier, sous le feuillage et dans les coins
  float a = (1.0 - grain) + shade * 0.3 + (1.0 - vig) * 0.2 + (b - 0.5) * 0.03;
  a = clamp(a, 0.0, 0.6);
  vec3 c = mix(vec3(0.24, 0.17, 0.1), vec3(0.08, 0.14, 0.1), shade / max(a, 0.001) * 0.5);
  finalColor = vec4(c * a, a);
}
`;

/** Taches de soleil (komorebi) qui dansent sur la berge et l'eau (mélange additif). */
export const DAPPLE_FRAGMENT = /* glsl */ `
precision mediump float;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uNoise;
uniform vec2 uScreen;
uniform float uTime;
uniform float uWind;
uniform float uSun;
uniform vec3 uSunCol;

void main() {
  vec2 p = vPos / uScreen.y;
  vec2 drift = vec2(sin(uTime * 0.6), cos(uTime * 0.45)) * 0.004 * (0.4 + uWind * 1.8);
  float a = texture(uNoise, (p + drift) * 3.1).a;
  float b = texture(uNoise, (p - drift * 0.7) * 2.3 + 0.4).b;
  float spots = smoothstep(0.66, 0.84, a * 0.55 + b * 0.45);
  // Les taches n'existent que sous le feuillage (coin supérieur gauche et bords)
  float under = 1.0 - smoothstep(0.2, 0.75, length(p * vec2(1.0, 1.2)));
  under = max(under, (1.0 - smoothstep(0.0, 0.16, min(p.x, uScreen.x / uScreen.y - p.x))) * 0.6);
  vec3 col = uSunCol * spots * under * uSun * 0.22;
  finalColor = vec4(col, 0.0);
}
`;
