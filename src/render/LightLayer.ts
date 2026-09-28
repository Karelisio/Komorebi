import type { Container } from 'pixi.js';
import { createShaderMesh, setQuad, setVec, vec2, vec3 } from './gl';
import { FOG_FRAGMENT, LIGHT_FRAGMENT } from './shaders/light';

export class LightLayer {
  readonly rays = createShaderMesh({
    name: 'rays',
    fragment: LIGHT_FRAGMENT,
    uniforms: {
      uScreen: { type: 'vec2<f32>', value: vec2(1, 1) },
      uSrc: { type: 'vec2<f32>', value: vec2() },
      uSunCol: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
      uStrength: { type: 'f32', value: 0 },
      uTime: { type: 'f32', value: 0 },
      uWind: { type: 'f32', value: 0 },
      uHaze: { type: 'f32', value: 0 },
      uHorizon: { type: 'f32', value: 300 },
    },
  });

  readonly fog = createShaderMesh({
    name: 'fog',
    fragment: FOG_FRAGMENT,
    uniforms: {
      uScreen: { type: 'vec2<f32>', value: vec2(1, 1) },
      uFogCol: { type: 'vec3<f32>', value: vec3(0.8, 0.82, 0.85) },
      uFog: { type: 'f32', value: 0 },
      uTime: { type: 'f32', value: 0 },
      uHorizon: { type: 'f32', value: 300 },
    },
  });

  constructor(raysParent: Container, fogParent: Container) {
    this.rays.mesh.blendMode = 'add';
    raysParent.addChild(this.rays.mesh);
    fogParent.addChild(this.fog.mesh);
  }

  resize(w: number, h: number): void {
    setQuad(this.rays.mesh.geometry, 0, 0, w, h);
    setQuad(this.fog.mesh.geometry, 0, 0, w, h);
    setVec(this.rays.u.uScreen, [w, h]);
    setVec(this.fog.u.uScreen, [w, h]);
  }
}
