import { Geometry, Mesh, Shader, UniformGroup, type TextureSource } from 'pixi.js';

/** Vertex shader commun à tous nos meshes (positions + UV). */
export const MESH_VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in float aExtra;
out vec2 vUV;
out vec2 vPos;
out float vExtra;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vPos = aPosition;
  vExtra = aExtra;
}
`;

/** Fonctions GLSL partagées : bruit, fbm, worley. */
export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}
// Worley animé : renvoie (F1, F2).
vec2 worley(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}
`;

export type UniformType = 'f32' | 'i32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>';
export type UniformSpec = Record<
  string,
  { type: UniformType; value: number | Float32Array; size?: number }
>;

export interface ShaderMesh<U extends UniformSpec> {
  mesh: Mesh<Geometry, Shader>;
  /** Valeurs des uniforms (modifier en place les Float32Array, ou réassigner les nombres). */
  u: { [K in keyof U]: U[K]['value'] };
  shader: Shader;
}

/** Géométrie d'un quad (x, y, w, h) avec UV 0..1. */
export function quadGeometry(x = 0, y = 0, w = 1, h = 1): Geometry {
  return new Geometry({
    attributes: {
      aPosition: [x, y, x + w, y, x + w, y + h, x, y + h],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      aExtra: [0, 0, 0, 0],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
}

export function setQuad(geometry: Geometry, x: number, y: number, w: number, h: number): void {
  const buf = geometry.getBuffer('aPosition');
  const d = buf.data as Float32Array;
  d.set([x, y, x + w, y, x + w, y + h, x, y + h]);
  buf.update();
}

export function createShaderMesh<U extends UniformSpec>(opts: {
  fragment: string;
  uniforms: U;
  textures?: Record<string, TextureSource>;
  geometry?: Geometry;
  name: string;
}): ShaderMesh<U> {
  const group = new UniformGroup(opts.uniforms);
  const shader = Shader.from({
    gl: { vertex: MESH_VERTEX, fragment: opts.fragment, name: opts.name },
    resources: { [`${opts.name}Uniforms`]: group, ...(opts.textures ?? {}) },
  });
  const mesh = new Mesh({ geometry: opts.geometry ?? quadGeometry(), shader });
  return { mesh, shader, u: group.uniforms as ShaderMesh<U>['u'] };
}

export const vec3 = (r = 0, g = 0, b = 0): Float32Array => new Float32Array([r, g, b]);
export const vec2 = (x = 0, y = 0): Float32Array => new Float32Array([x, y]);
export const vec4 = (x = 0, y = 0, z = 0, w = 0): Float32Array => new Float32Array([x, y, z, w]);

export function setVec(target: Float32Array, values: readonly number[]): void {
  for (let i = 0; i < target.length; i++) target[i] = values[i] ?? 0;
}
