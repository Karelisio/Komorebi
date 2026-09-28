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
uniform float uCamX;
uniform vec3 uMtn;
uniform vec3 uForest;
uniform vec3 uHaze;
uniform float uSnowLine;
uniform float uSunSide;
uniform vec3 uSunLit;

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

  // Voile nuageux (temps couvert) ; les cumulus sont des sprites peints.
  if (uClouds > 0.45) {
    float drift = uTime * uWind * 0.004;
    vec2 cp = vec2(p.x / uScreen.y * 1.8 + drift, above / uScreen.y * 3.0);
    float n = fbm(cp, 3);
    float veil = smoothstep(0.45, 1.0, uClouds);
    float cover = smoothstep(0.3, 0.7, n) * veil;
    vec3 cc = mix(uCloudShade, uCloudLit, smoothstep(0.35, 0.8, n));
    col = mix(col, cc, cover * 0.9 * smoothstep(0.0, 0.1, t));
  }

  // Éclair lointain
  col += vec3(0.75, 0.8, 1.0) * uFlash * (0.3 + 0.7 * t);

  // Grain léger pour éviter le banding
  col += (hash12(p + fract(uTime)) - 0.5) / 255.0 * 2.0;
  finalColor = vec4(col, 1.0);
}
`;

/** Chaînes de montagnes (couche transparente au-dessus des nuages lointains). */
export const MOUNTAINS_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vPos;
out vec4 finalColor;

uniform vec2 uScreen;
uniform float uHorizon;
uniform float uSkyHeight;
uniform int uOctaves;
uniform float uCamX;
uniform vec3 uMtn;
uniform vec3 uForest;
uniform vec3 uHaze;
uniform float uSnowLine;
uniform float uSunSide;
uniform vec3 uSunLit;

${GLSL_NOISE}

// Crête montagneuse : bruit « ridged » (arêtes vives, vallées douces).
float ridge(float x, float seed, int oct) {
  float h = 0.0;
  float a = 0.55;
  float f = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float n = vnoise(vec2(x * f + seed * 13.1, seed * 7.3 + float(i) * 3.7));
    n = 1.0 - abs(n * 2.0 - 1.0);
    h += n * n * a;
    f *= 2.07;
    a *= 0.48;
  }
  return h;
}

// Dessine un plan de montagnes ; renvoie la couverture (0..1) et modifie col.
void mountainLayer(inout vec4 acc, vec2 p, float depth, float par, float base, float amp, float freq, float seed, vec3 tone, bool forest) {
  float x = (p.x + uCamX * par) / uScreen.y * freq;
  float e = 0.01;
  float r = ridge(x, seed, uOctaves + 1);
  float hgt = base + amp * r;
  if (forest) hgt += 0.03 * vnoise(vec2(x * 9.0, seed)) + 0.018 * vnoise(vec2(x * 24.0, seed + 2.0));
  float top = uHorizon - hgt * uSkyHeight;
  float cover = smoothstep(top - 0.8, top + 0.8, p.y);
  if (cover <= 0.0) return;
  float slope = ridge(x + e, seed, 3) - ridge(x - e, seed, 3);
  float below = (p.y - top) / uSkyHeight;
  // Aplat façon estampe : liseré éclairé juste sous la crête, côté soleil
  float rim = (1.0 - smoothstep(0.0, 0.035 + depth * 0.02, below)) * clamp(slope * 8.0 * uSunSide, 0.0, 1.0);
  vec3 c = tone;
  c = mix(c, c * 1.25 + uSunLit * 0.18, rim * 0.8);
  float lit = rim;
  // Neiges sommitales (plans lointains)
  if (!forest) {
    // Neige : calotte irrégulière qui descend dans les couloirs, jamais en colonnes
    float n2 = vnoise(vec2(x * 4.0, below * 22.0)) * 0.7 + vnoise(vec2(x * 11.0, below * 50.0)) * 0.3;
    float cap = 0.05 + n2 * 0.09;
    float snow = smoothstep(uSnowLine, uSnowLine + 0.02, (uHorizon - p.y) / uSkyHeight + 0.04) * (1.0 - smoothstep(cap * 0.7, cap, below));
    c = mix(c, mix(vec3(0.92, 0.94, 1.0) * (0.82 + 0.18 * lit), uHaze, depth * 0.45) * (0.55 + 0.45 * min(1.0, length(uSunLit))), snow * 0.9);
  }
  // Perspective atmosphérique + brume de vallée vers la base
  // Perspective atmosphérique + brume qui monte des vallées
  float above = (uHorizon - p.y) / uSkyHeight;
  float valley = 1.0 - smoothstep(0.0, base + amp * 0.45, above);
  c = mix(c, uHaze, clamp(depth * 0.8 + valley * (0.4 + depth * 0.2), 0.0, 0.95));
  acc = vec4(c * cover, cover) + acc * (1.0 - cover);
}


void main() {
  vec2 p = vPos;
  // Dessin du lointain vers le proche, en « over » prémultiplié inversé
  vec4 acc = vec4(0.0);
  mountainLayer(acc, p, 0.55, 0.04, 0.12, 0.62, 6.0, 1.0, uMtn, false);
  mountainLayer(acc, p, 0.38, 0.07, 0.09, 0.42, 8.5, 2.0, uMtn, false);
  mountainLayer(acc, p, 0.22, 0.11, 0.07, 0.26, 12.0, 3.0, mix(uMtn, uForest, 0.55), false);
  mountainLayer(acc, p, 0.08, 0.16, 0.06, 0.1, 16.0, 4.0, uForest, true);
  finalColor = acc;
}
`;
