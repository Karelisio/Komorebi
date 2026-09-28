import { GLSL_NOISE } from '../gl';

export const SKY_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUV;
in vec2 vPos;
out vec4 finalColor;

uniform vec2 uScreen;
uniform float uHorizon;
uniform float uSkyHeight;
uniform vec3 uTop;
uniform vec3 uHorizonCol;
uniform vec2 uSunPos;
uniform vec3 uSunCol;
uniform float uSunVis;
uniform vec2 uMoonPos;
uniform float uMoonPhase;
uniform float uMoonVis;
uniform float uMoonSize;
uniform float uStars;
uniform float uTime;
uniform float uClouds;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uWind;
uniform vec2 uStarShift;
uniform int uOctaves;
uniform float uFlash;

${GLSL_NOISE}

vec3 stars(vec2 p) {
  vec2 cell = floor(p / 3.0);
  vec2 f = fract(p / 3.0);
  float h = hash12(cell);
  if (h < 0.965) return vec3(0.0);
  vec2 c = hash22(cell + 7.0);
  float d = length(f - c);
  float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 60.0);
  float b = smoothstep(0.09, 0.0, d) * (h - 0.965) / 0.035 * tw;
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.92, 0.8), hash12(cell + 3.1));
  return tint * b * 1.6;
}

void main() {
  vec2 p = vPos;
  float above = uHorizon - p.y;
  float t = clamp(above / uSkyHeight, 0.0, 1.0);
  vec3 col = mix(uHorizonCol, uTop, pow(t, 0.55));

  // Halo du soleil
  vec2 sd = (p - uSunPos) / uScreen.y;
  float sdist = length(sd);
  col += uSunCol * uSunVis * (exp(-sdist * 5.0) * 0.35 + exp(-sdist * 22.0) * 0.5);
  col += uSunCol * uSunVis * smoothstep(0.028, 0.022, sdist) * 1.2;

  // Étoiles (dans une bande légèrement déplacée pour simuler la rotation du ciel)
  if (uStars > 0.01) {
    vec2 sp = (p + uStarShift) * 0.35;
    col += stars(sp * 3.0) * uStars * smoothstep(0.0, 0.25, t);
    // Voie lactée diffuse
    float mw = fbm(sp * 0.02 + vec2(3.0, 1.0), 3);
    float band = exp(-pow((sp.x * 0.6 + sp.y - 60.0) / 55.0, 2.0));
    col += vec3(0.5, 0.55, 0.75) * band * mw * 0.12 * uStars;
  }

  // Lune avec sa phase réelle
  if (uMoonVis > 0.01) {
    vec2 md = (p - uMoonPos) / uMoonSize;
    float r = length(md);
    col += vec3(0.6, 0.68, 0.85) * exp(-r * 0.9) * 0.18 * uMoonVis;
    if (r < 1.0) {
      vec3 n = vec3(md.x, -md.y, sqrt(1.0 - r * r));
      float a = uMoonPhase * 6.28318;
      vec3 l = vec3(sin(a), 0.0, -cos(a));
      float lit = smoothstep(-0.06, 0.06, dot(n, l));
      float maria = fbm(md * 2.2 + 4.0, 3);
      vec3 moonCol = vec3(0.95, 0.94, 0.88) * (0.78 + 0.22 * smoothstep(0.35, 0.65, maria));
      vec3 earthshine = vec3(0.10, 0.12, 0.18);
      float edge = smoothstep(1.0, 0.94, r);
      col = mix(col, mix(earthshine + col * 0.6, moonCol, lit), edge * uMoonVis);
    }
  }

  // Nuages en couches, étirés près de l'horizon
  if (uClouds > 0.01) {
    float persp = 0.35 + t * 1.4;
    vec2 cp = vec2(p.x / uScreen.y * 2.2 + uTime * uWind * 0.012, above / uScreen.y * 5.0 / persp);
    float n = fbm(cp * vec2(1.0, 1.8), uOctaves);
    float cover = smoothstep(1.0 - uClouds * 0.85, 1.05 - uClouds * 0.55, n);
    float shade = fbm(cp * 1.7 + 11.0, 2);
    vec3 cc = mix(uCloudShade, uCloudLit, smoothstep(0.3, 0.75, shade));
    cc += uSunCol * uSunVis * exp(-sdist * 3.0) * 0.35;
    col = mix(col, cc, cover * 0.92 * smoothstep(0.0, 0.08, t));
  }

  // Éclair lointain
  col += vec3(0.75, 0.8, 1.0) * uFlash * (0.3 + 0.7 * t);

  // Grain léger pour éviter le banding
  col += (hash12(p + fract(uTime)) - 0.5) / 255.0 * 2.0;
  finalColor = vec4(col, 1.0);
}
`;
