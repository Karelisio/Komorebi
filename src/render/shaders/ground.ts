/** Sol du jardin : herbe peinte, variations, reflets du vent, neige, taches de soleil. */
export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUV;
in vec2 vPos;
out vec4 finalColor;

uniform sampler2D uNoise;
uniform sampler2D uGrass;
uniform vec3 uTint;
uniform vec3 uDry;
uniform vec3 uHazeCol;
uniform vec3 uAmbient;
uniform vec3 uSunCol;
uniform float uSun;
uniform float uSnow;
uniform float uWet;
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
uniform vec2 uLight;
uniform vec4 uCanopy[8];
uniform vec2 uPath[24];
uniform float uHorizon;
uniform vec4 uColor;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * t);
}

float canopy(vec4 c, vec2 p) {
  vec2 d = (p - c.xy) / c.zw;
  return smoothstep(1.0, 0.5, length(d));
}

void main() {
  vec2 p = vPos;
  float depth = smoothstep(uHorizon, uHorizon + 1500.0, p.y);
  // Perspective : les brins rapetissent vers l'horizon
  float k = mix(0.42, 0.82, depth);
  vec4 nA = texture(uNoise, p / 900.0);
  vec4 nB = texture(uNoise, p / 260.0 + 0.37);

  vec2 q = vec2(p.x, p.y * 1.15) / (150.0 * k);
  vec3 gA = texture(uGrass, q).rgb;
  vec3 gB = texture(uGrass, q * 0.71 + vec2(0.41, 0.17)).rgb;
  vec3 grass = mix(gA, gB, smoothstep(0.35, 0.65, nA.b));

  // Teinte de saison, zones plus sèches ou plus sombres
  float dry = smoothstep(0.45, 0.8, nA.r * 0.65 + nB.g * 0.35);
  vec3 col = grass * mix(uTint, uDry, dry * 0.6);
  col *= 0.86 + 0.28 * nB.a;

  // Reflets du vent : les pointes se couchent et accrochent la lumière
  float wave = sin(dot(p, uWindDir) * 0.011 - uTime * (0.9 + uWind * 1.6) + nB.r * 4.0);
  float sheen = smoothstep(0.55, 1.0, wave) * (0.25 + uWind * 0.75);
  col += vec3(0.1, 0.12, 0.05) * sheen * (0.35 + uSun * 0.65);

  // Allée de gravier ratissé, bordée de mousse
  float pd = 1e5;
  if (p.x < 700.0) {
    for (int i = 0; i < 23; i++) pd = min(pd, segDist(p, uPath[i], uPath[i + 1]));
  }
  float halfW = mix(18.0, 34.0, depth) + (nB.b - 0.5) * 6.0;
  float onPath = 1.0 - smoothstep(halfW - 3.0, halfW + 2.0, pd);
  float edge = (1.0 - smoothstep(halfW + 2.0, halfW + 14.0, pd)) * (1.0 - onPath);
  vec3 gravel = vec3(0.78, 0.75, 0.68) * (0.86 + 0.22 * texture(uNoise, p / 23.0).b) * (0.93 + 0.1 * texture(uNoise, p / 7.0).a);
  col = mix(col, col * 0.78, edge * 0.6);
  col = mix(col, gravel, onPath);

  // Humidité
  col *= 1.0 - uWet * 0.18;

  // Neige : couverture irrégulière
  float snow = smoothstep(1.0 - uSnow, 1.0 - uSnow + 0.12, nA.g * 0.6 + nB.b * 0.4 + uSnow * 0.35);
  col = mix(col, vec3(0.93, 0.95, 1.0), snow * 0.95);

  // Ombre du feuillage et taches de soleil (komorebi) qui bougent avec le vent
  float shade = 0.0;
  for (int i = 0; i < 8; i++) shade = max(shade, canopy(uCanopy[i], p));
  vec2 drift = vec2(sin(uTime * 0.6) * 3.0, cos(uTime * 0.45) * 2.0) * (0.4 + uWind);
  float holes = texture(uNoise, (p + drift) / 140.0 + uLight * 0.02).a;
  float holes2 = texture(uNoise, (p - drift * 0.7) / 75.0 + 0.5).b;
  float dapple = smoothstep(0.66, 0.8, holes * 0.55 + holes2 * 0.45);
  vec3 light = uAmbient * (1.0 - shade * 0.45 * uSun);
  light += uSunCol * dapple * shade * uSun * 0.45;
  col *= light;

  // Perspective atmosphérique près de l'horizon
  col = mix(col, uHazeCol, (1.0 - smoothstep(uHorizon, uHorizon + 380.0, p.y)) * 0.35);

  finalColor = vec4(col, 1.0) * uColor.a;
}
`;
