import type { Container, Texture } from 'pixi.js';
import { createShaderMesh, quadGeometry, vec2, vec3 } from './gl';
import { GARDEN_PATH, PATH_SAMPLES, smoothPath, WORLD } from '@/world/layout';
import { GROUND_FRAGMENT } from './shaders/ground';

export class GroundView {
  readonly sm;

  constructor(parent: Container, noise: Texture, grass: Texture) {
    const top = WORLD.horizon - 30;
    this.sm = createShaderMesh({
      name: 'ground',
      fragment: GROUND_FRAGMENT,
      geometry: quadGeometry(-400, top, WORLD.width + 800, WORLD.height - top + 400),
      textures: { uNoise: noise.source, uGrass: grass.source },
      uniforms: {
        uTint: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
        uDry: { type: 'vec3<f32>', value: vec3(1.25, 1.1, 0.75) },
        uHazeCol: { type: 'vec3<f32>', value: vec3(0.6, 0.7, 0.75) },
        uWindDir: { type: 'vec2<f32>', value: vec2(0.8, 0.6) },
        uAmbient: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
        uSunCol: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
        uSun: { type: 'f32', value: 0 },
        uSnow: { type: 'f32', value: 0 },
        uWet: { type: 'f32', value: 0 },
        uTime: { type: 'f32', value: 0 },
        uWind: { type: 'f32', value: 0 },
        uLight: { type: 'vec2<f32>', value: vec2() },
        uCanopy: { type: 'vec4<f32>', value: new Float32Array(8 * 4).fill(-9999), size: 8 },
        uHorizon: { type: 'f32', value: WORLD.horizon },
        uPath: {
          type: 'vec2<f32>',
          value: new Float32Array(smoothPath(GARDEN_PATH, PATH_SAMPLES).flatMap((p) => [p.x, p.y])),
          size: PATH_SAMPLES,
        },
      },
    });
    parent.addChild(this.sm.mesh);
  }

  /** Zones ombragées par les feuillages (x, y, rx, ry), au plus 8. */
  setCanopies(list: readonly (readonly [number, number, number, number])[]): void {
    const arr = this.sm.u.uCanopy;
    arr.fill(-9999);
    list.slice(0, 8).forEach((c, i) => arr.set(c, i * 4));
  }
}
