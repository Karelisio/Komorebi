import type { Container } from 'pixi.js';
import { createShaderMesh, setQuad, setVec, vec2, vec3, type ShaderMesh } from './gl';
import { SKY_FRAGMENT } from './shaders/sky';

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
});

export type SkyUniforms = ShaderMesh<ReturnType<typeof uniforms>>['u'];

export class SkyLayer {
  readonly sm = createShaderMesh({ name: 'sky', fragment: SKY_FRAGMENT, uniforms: uniforms() });

  constructor(parent: Container) {
    parent.addChild(this.sm.mesh);
  }

  get u(): SkyUniforms {
    return this.sm.u;
  }

  resize(w: number, h: number): void {
    setQuad(this.sm.mesh.geometry, 0, 0, w, h);
    setVec(this.sm.u.uScreen, [w, h]);
  }
}
