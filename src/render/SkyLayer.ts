import type { Container } from 'pixi.js';
import { createShaderMesh, setQuad, setVec, vec2, vec3, type ShaderMesh } from './gl';
import { MOUNTAINS_FRAGMENT, SKY_FRAGMENT } from './shaders/sky';

const uniforms = () => ({
  uScreen: { type: 'vec2<f32>' as const, value: vec2(1, 1) },
  uHorizon: { type: 'f32' as const, value: 400 },
  uSkyHeight: { type: 'f32' as const, value: 400 },
  uTop: { type: 'vec3<f32>' as const, value: vec3() },
  uHorizonCol: { type: 'vec3<f32>' as const, value: vec3() },
  uSunPos: { type: 'vec2<f32>' as const, value: vec2() },
  uSunCol: { type: 'vec3<f32>' as const, value: vec3() },
  uSunVis: { type: 'f32' as const, value: 0 },
  uMoonPos: { type: 'vec2<f32>' as const, value: vec2() },
  uMoonPhase: { type: 'f32' as const, value: 0.5 },
  uMoonVis: { type: 'f32' as const, value: 0 },
  uMoonSize: { type: 'f32' as const, value: 14 },
  uStars: { type: 'f32' as const, value: 0 },
  uTime: { type: 'f32' as const, value: 0 },
  uClouds: { type: 'f32' as const, value: 0.2 },
  uCloudLit: { type: 'vec3<f32>' as const, value: vec3(1, 1, 1) },
  uCloudShade: { type: 'vec3<f32>' as const, value: vec3(0.7, 0.7, 0.75) },
  uWind: { type: 'f32' as const, value: 1 },
  uStarShift: { type: 'vec2<f32>' as const, value: vec2() },
  uOctaves: { type: 'i32' as const, value: 4 },
  uFlash: { type: 'f32' as const, value: 0 },
  uCamX: { type: 'f32' as const, value: 0 },
  uMtn: { type: 'vec3<f32>' as const, value: vec3(0.2, 0.26, 0.34) },
  uForest: { type: 'vec3<f32>' as const, value: vec3(0.12, 0.2, 0.16) },
  uHaze: { type: 'vec3<f32>' as const, value: vec3(0.7, 0.8, 0.9) },
  uSnowLine: { type: 'f32' as const, value: 0.5 },
  uSunSide: { type: 'f32' as const, value: 1 },
  uSunLit: { type: 'vec3<f32>' as const, value: vec3(1, 1, 1) },
});

export type SkyUniforms = ShaderMesh<ReturnType<typeof uniforms>>['u'];

const mountainUniforms = () => ({
  uScreen: { type: 'vec2<f32>' as const, value: vec2(1, 1) },
  uHorizon: { type: 'f32' as const, value: 400 },
  uSkyHeight: { type: 'f32' as const, value: 400 },
  uOctaves: { type: 'i32' as const, value: 4 },
  uCamX: { type: 'f32' as const, value: 0 },
  uMtn: { type: 'vec3<f32>' as const, value: vec3(0.2, 0.26, 0.34) },
  uForest: { type: 'vec3<f32>' as const, value: vec3(0.12, 0.2, 0.16) },
  uHaze: { type: 'vec3<f32>' as const, value: vec3(0.7, 0.8, 0.9) },
  uSnowLine: { type: 'f32' as const, value: 0.5 },
  uSunSide: { type: 'f32' as const, value: 1 },
  uSunLit: { type: 'vec3<f32>' as const, value: vec3(1, 1, 1) },
});

export class SkyLayer {
  readonly sm = createShaderMesh({ name: 'sky', fragment: SKY_FRAGMENT, uniforms: uniforms() });
  readonly mountains = createShaderMesh({
    name: 'mountains',
    fragment: MOUNTAINS_FRAGMENT,
    uniforms: mountainUniforms(),
  });

  /** Ordre : ciel, (nuages insérés par la scène), montagnes. */
  constructor(parent: Container, between?: Container) {
    parent.addChild(this.sm.mesh);
    if (between) parent.addChild(between);
    parent.addChild(this.mountains.mesh);
  }

  get m(): ShaderMesh<ReturnType<typeof mountainUniforms>>['u'] {
    return this.mountains.u;
  }

  get u(): SkyUniforms {
    return this.sm.u;
  }

  resize(w: number, h: number): void {
    setQuad(this.sm.mesh.geometry, 0, 0, w, h);
    setQuad(this.mountains.mesh.geometry, 0, 0, w, h);
    setVec(this.sm.u.uScreen, [w, h]);
    setVec(this.mountains.u.uScreen, [w, h]);
  }
}
