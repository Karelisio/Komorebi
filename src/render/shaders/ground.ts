/** Sol du jardin : mousse, gravier, neige et taches de lumière (komorebi). */
export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUV;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uNoise;
uniform vec3 uMoss;
uniform vec3 uMossDry;
uniform vec3 uEarth;
uniform vec3 uAmbient;
uniform vec3 uSunCol;
uniform float uSun;
uniform float uSnow;
uniform float uWet;
uniform float uTime;
uniform float uWind;
uniform vec2 uLight;
uniform vec4 uCanopy[8];
uniform float uHorizon;
uniform vec4 uColor;

float canopy(vec4 c, vec2 p) {
  vec2 d = (p - c.xy) / c.zw;
  return smoothstep(1.0, 0.55, length(d));
}

void main() {
  vec2 p = vPos;
  vec4 nA = texture(uNoise, p / 900.0);
  vec4 nB = texture(uNoise, p / 230.0 + 0.37);
  vec4 nC = texture(uNoise, p / 83.0 + vec2(0.71, 0.13));

  float dry = smoothstep(0.35, 0.75, nA.r * 0.7 + nB.g * 0.3);
  vec3 col = mix(uMoss, uMossDry, dry);
  // Touffes et variations fines
  col *= 0.88 + 0.16 * nC.b + 0.08 * nB.a;
  float earth = nB.r * 0.5 + texture(uNoise, p * mat2(0.8, 0.6, -0.6, 0.8) / 310.0).g * 0.5;
  col = mix(col, uEarth, smoothstep(0.64, 0.8, earth) * 0.4);
  // Assombrit vers l'arrière-plan (perspective atmosphérique inversée : herbe plus haute)
  float far = smoothstep(uHorizon + 500.0, uHorizon, p.y);
  col *= 1.0 - far * 0.25;

  // Humidité : sol plus sombre et brillant
  col *= 1.0 - uWet * 0.22;

  // Neige : couverture irrégulière
  float snow = smoothstep(1.0 - uSnow, 1.0 - uSnow + 0.12, nA.g * 0.6 + nB.b * 0.4 + uSnow * 0.35);
  col = mix(col, vec3(0.93, 0.95, 1.0), snow * 0.95);

  // Ombre du feuillage et taches de soleil qui bougent avec le vent
  float shade = 0.0;
  for (int i = 0; i < 8; i++) shade = max(shade, canopy(uCanopy[i], p));
  vec2 drift = vec2(sin(uTime * 0.6) * 3.0, cos(uTime * 0.45) * 2.0) * (0.4 + uWind);
  float holes = texture(uNoise, (p + drift) / 140.0 + uLight * 0.02).a;
  float holes2 = texture(uNoise, (p - drift * 0.7) / 75.0 + 0.5).b;
  float dapple = smoothstep(0.66, 0.8, holes * 0.55 + holes2 * 0.45);
  vec3 light = uAmbient * (1.0 - shade * 0.45 * uSun);
  light += uSunCol * dapple * shade * uSun * 0.4;
  col *= light;

  finalColor = vec4(col, 1.0) * uColor.a;
}
`;
