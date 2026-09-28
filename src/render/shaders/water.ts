import { GLSL_NOISE } from '../gl';

export const WATER_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUV;
in vec2 vPos;
in float vExtra;
out vec4 finalColor;

uniform sampler2D uHeight;
uniform sampler2D uKoi;
uniform sampler2D uBed;
uniform sampler2D uRefl;
uniform float uReflStrength;

uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uAmbient;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform float uSunStrength;
uniform vec3 uMoonDir;
uniform float uMoonStrength;
uniform vec3 uTreeCol;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uTime;
uniform float uCaustics;
uniform float uWind;
uniform float uFog;
uniform vec3 uFogCol;
uniform vec4 uLantern;
uniform float uQuality;
uniform vec4 uColor;

${GLSL_NOISE}

void main() {
  float depth = vExtra;
  vec4 hv = texture(uHeight, vUV);
  vec2 slope = (hv.gb - 0.5) * 2.0;

  // Micro-ondulations dues au vent
  vec2 wp = vPos * 0.045;
  vec2 wind = vec2(vnoise(wp + vec2(uTime * 0.35, 0.0)) - 0.5, vnoise(wp * 1.3 + vec2(7.0, uTime * 0.28)) - 0.5);
  vec3 n = normalize(vec3(slope * 1.8 + wind * (0.08 + uWind * 0.35), 1.0));

  // Fond et absorption : le fond n'est visible que près des berges
  vec2 ruv = vUV + n.xy * 0.02;
  vec3 bed = texture(uBed, ruv).rgb;
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.85, depth));
  float bedVis = pow(1.0 - depth, 1.6) * 0.75;
  vec3 col = mix(body, bed * uShallow * 2.2, bedVis);

  // Caustiques (réseau de Worley animé)
  if (uCaustics > 0.01) {
    vec2 cp = vPos * 0.009 + n.xy * 0.5 + vnoise(vPos * 0.003 + uTime * 0.04) * 0.9;
    vec2 w1 = worley(cp, uTime * 0.45);
    float c = 1.0 - smoothstep(0.0, 0.45, w1.y - w1.x);
    if (uQuality > 1.5) {
      vec2 w2 = worley(cp * 1.37 + 5.3, -uTime * 0.37);
      c = c * 0.6 + (1.0 - smoothstep(0.0, 0.42, w2.y - w2.x)) * 0.4;
    }
    c = pow(c, 5.0);
    col += uSunCol * c * uCaustics * pow(1.0 - depth, 1.5) * 0.09;
  }

  // Koïs (et leurs ombres) sous la surface, réfractés
  vec4 koi = texture(uKoi, vUV + n.xy * 0.012);
  if (koi.a > 0.001) {
    vec3 kc = koi.rgb / koi.a;
    col = mix(col, kc * mix(vec3(1.0), uShallow * 1.8, 0.15), koi.a * 0.94);
  }

  // Ombre portée de la berge
  col *= 0.72 + 0.28 * smoothstep(0.0, 0.3, depth);
  col *= uAmbient;

  // Réflexion : ciel, puis silhouette des arbres de la berge opposée
  float sky = clamp(0.35 + n.y * 3.0 + vUV.y * 0.6, 0.0, 1.0);
  vec3 refl = mix(uSkyHorizon, uSkyTop, sky);
  // La nuit, l'eau garde un reflet bleuté lisible
  refl = max(refl, uAmbient * vec3(0.16, 0.2, 0.3));
  float edgeNoise = vnoise(vec2(vUV.x * 7.0, 1.0)) * 0.6 + vnoise(vec2(vUV.x * 23.0, 4.0)) * 0.4;
  float trees = smoothstep(0.2 + edgeNoise * 0.22, 0.05 + edgeNoise * 0.18, vUV.y + n.y * 0.25);
  refl = mix(refl, uTreeCol, trees * mix(0.85, 0.35, uReflStrength));
  float fres = 0.1 + 0.5 * pow(1.0 - vUV.y, 2.0) + 0.9 * length(slope);
  col = mix(col, refl, clamp(fres, 0.0, 0.75));

  // Reflets des arbres, lanternes et rochers de la berge, déformés par les ondes
  if (uReflStrength > 0.0) {
    vec2 ruvR = vec2(vUV.x + n.x * 0.03 + sin(vUV.y * 90.0 + uTime * 1.3) * 0.0015 * (1.0 + uWind * 3.0), vUV.y + n.y * 0.045);
    vec4 ro = texture(uRefl, ruvR);
    if (ro.a > 0.002) {
      vec3 rc = ro.rgb / ro.a;
      rc = mix(rc, uDeep * 1.5 + refl * 0.3, 0.3);
      float ra = ro.a * uReflStrength * (0.5 + 0.35 * (1.0 - vUV.y));
      col = mix(col, rc, clamp(ra, 0.0, 0.85));
    }
  }

  // Reflets spéculaires du soleil et de la lune
  vec3 v = vec3(0.0, 0.57, 0.82);
  vec3 hs = normalize(uSunDir + v);
  float spec = pow(max(dot(n, hs), 0.0), 420.0);
  col += uSunCol * spec * uSunStrength * 2.4;
  vec3 hm = normalize(uMoonDir + v);
  col += vec3(0.75, 0.82, 1.0) * pow(max(dot(n, hm), 0.0), 260.0) * uMoonStrength * 1.2;

  // Reflet des lanternes (x, y monde, rayon, intensité)
  if (uLantern.w > 0.01) {
    float ld = length((vPos - uLantern.xy) / vec2(uLantern.z * 0.5, uLantern.z)) ;
    col += vec3(1.0, 0.72, 0.38) * exp(-ld * 2.5) * uLantern.w * (0.6 + 0.4 * sin(uTime * 3.0 + n.x * 20.0));
  }

  // Ménisque : fin liseré lumineux le long de la berge
  float meniscus = smoothstep(0.13, 0.07, depth) * smoothstep(0.03, 0.07, depth);
  col += mix(uSkyHorizon, vec3(1.0), 0.3) * meniscus * (0.12 + 0.2 * length(slope)) * (0.4 + 0.6 * uAmbient.g);

  col = mix(col, uFogCol, uFog * 0.55);
  float edge = smoothstep(0.0, 0.05, depth);
  finalColor = vec4(col, 1.0) * edge * uColor.a;
}
`;
