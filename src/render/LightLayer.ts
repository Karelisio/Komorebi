import type { Container } from 'pixi.js';
import { createShaderMesh, setQuad, setVec, vec2, vec3 } from './gl';
import { FOG_FRAGMENT, LIGHT_FRAGMENT } from './shaders/light';
import { DAPPLE_FRAGMENT, PAPER_FRAGMENT } from './shaders/paper';
import { sharedTextures } from './textures';

export class LightLayer {
  readonly rays = createShaderMesh({
    name: 'rays',
    fragment: LIGHT_FRAGMENT,
    textures: { uNoise: sharedTextures().noise.source },
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

  /** Taches de soleil sous le feuillage. */
  readonly dapple = createShaderMesh({
    name: 'dapple',
    fragment: DAPPLE_FRAGMENT,
    textures: { uNoise: sharedTextures().noise.source },
    uniforms: {
      uScreen: { type: 'vec2<f32>', value: vec2(1, 1) },
      uTime: { type: 'f32', value: 0 },
      uWind: { type: 'f32', value: 0 },
      uSun: { type: 'f32', value: 0 },
      uSunCol: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
    },
  });

  /** Papier aquarelle, ombre du feuillage et vignette (multiply). */
  readonly paper = createShaderMesh({
    name: 'paper',
    fragment: PAPER_FRAGMENT,
    textures: { uNoise: sharedTextures().noise.source },
    uniforms: {
      uScreen: { type: 'vec2<f32>', value: vec2(1, 1) },
      uTime: { type: 'f32', value: 0 },
      uWind: { type: 'f32', value: 0 },
      uShade: { type: 'f32', value: 1 },
      uGrain: { type: 'f32', value: 1 },
    },
  });

  constructor(raysParent: Container, fogParent: Container, paperParent: Container) {
    this.rays.mesh.blendMode = 'add';
    this.dapple.mesh.blendMode = 'add';
    this.paper.mesh.blendMode = 'normal';
    raysParent.addChild(this.dapple.mesh, this.rays.mesh);
    fogParent.addChild(this.fog.mesh);
    paperParent.addChild(this.paper.mesh);
  }

  resize(w: number, h: number): void {
    for (const m of [this.rays, this.fog, this.dapple, this.paper]) {
      setQuad(m.mesh.geometry, 0, 0, w, h);
      setVec(m.u.uScreen, [w, h]);
    }
  }
}
