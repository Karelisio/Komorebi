import type { Texture } from 'pixi.js';
import { BufferImageSource, Container, Geometry, RenderTexture, type Renderer } from 'pixi.js';
import { RippleField } from '@/pond/ripples';
import { createShaderMesh, vec3, vec4 } from './gl';
import { pointInPolygon, type PondShape } from '@/world/layout';
import { drawPondRim } from './PondRim';
import { WATER_FRAGMENT } from './shaders/water';

export interface PondQuality {
  grid: number;
  koiResolution: number;
  level: number;
}

/** Géométrie en anneaux concentriques : aExtra = profondeur (1 au centre, 0 à la berge). */
function pondGeometry(shape: PondShape): Geometry {
  const rings = [0, 0.3, 0.6, 0.85, 1];
  const n = shape.points.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const depth: number[] = [];
  const { bbox } = shape;
  const push = (x: number, y: number, d: number) => {
    pos.push(x, y);
    uv.push((x - bbox.x) / bbox.width, (y - bbox.y) / bbox.height);
    depth.push(d);
  };
  push(shape.cx, shape.cy, 1);
  for (let r = 1; r < rings.length; r++) {
    const k = rings[r]!;
    for (let i = 0; i < n; i++) {
      const p = shape.points[i]!;
      push(shape.cx + (p.x - shape.cx) * k, shape.cy + (p.y - shape.cy) * k, 1 - Math.pow(k, 2.2));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  for (let r = 1; r < rings.length - 1; r++) {
    const a0 = 1 + (r - 1) * n;
    const b0 = 1 + r * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(a0 + i, b0 + i, b0 + j, a0 + i, b0 + j, a0 + j);
    }
  }
  return new Geometry({
    attributes: { aPosition: pos, aUV: uv, aExtra: depth },
    indexBuffer: idx,
  });
}

export class PondView {
  readonly container = new Container();
  /** Contenu sous l'eau (koïs, ombres), en coordonnées locales du rectangle englobant. */
  readonly underwater = new Container();
  /** Éléments flottants au-dessus de l'eau (nénuphars). */
  readonly surface = new Container();
  readonly field: RippleField;
  private readonly heightSource: BufferImageSource;
  private readonly koiRT: RenderTexture;
  readonly water;
  private simAcc = 0;

  constructor(
    readonly shape: PondShape,
    textures: { bed: Texture },
    quality: PondQuality,
  ) {
    const { bbox } = shape;
    const gw = quality.grid;
    const gh = Math.max(8, Math.round((gw * bbox.height) / bbox.width));
    const mask = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const wx = bbox.x + ((x + 0.5) / gw) * bbox.width;
        const wy = bbox.y + ((y + 0.5) / gh) * bbox.height;
        mask[y * gw + x] = pointInPolygon({ x: wx, y: wy }, shape.points) ? 1 : 0;
      }
    }
    this.field = new RippleField(gw, gh, mask);
    this.heightSource = new BufferImageSource({
      resource: this.field.bytes,
      width: gw,
      height: gh,
      format: 'rgba8unorm',
      scaleMode: 'linear',
    });
    this.koiRT = RenderTexture.create({
      width: Math.ceil(bbox.width),
      height: Math.ceil(bbox.height),
      resolution: quality.koiResolution,
    });

    this.water = createShaderMesh({
      name: 'water',
      fragment: WATER_FRAGMENT,
      geometry: pondGeometry(shape),
      textures: {
        uHeight: this.heightSource,
        uKoi: this.koiRT.source,
        uBed: textures.bed.source,
      },
      uniforms: {
        uSkyTop: { type: 'vec3<f32>', value: vec3() },
        uSkyHorizon: { type: 'vec3<f32>', value: vec3() },
        uAmbient: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
        uSunCol: { type: 'vec3<f32>', value: vec3(1, 1, 1) },
        uSunDir: { type: 'vec3<f32>', value: vec3(0, -0.5, 0.8) },
        uSunStrength: { type: 'f32', value: 0 },
        uMoonDir: { type: 'vec3<f32>', value: vec3(0, -0.5, 0.8) },
        uMoonStrength: { type: 'f32', value: 0 },
        uTreeCol: { type: 'vec3<f32>', value: vec3(0.1, 0.18, 0.12) },
        uDeep: { type: 'vec3<f32>', value: vec3(0.04, 0.12, 0.13) },
        uShallow: { type: 'vec3<f32>', value: vec3(0.2, 0.36, 0.31) },
        uTime: { type: 'f32', value: 0 },
        uCaustics: { type: 'f32', value: 0 },
        uWind: { type: 'f32', value: 0 },
        uFog: { type: 'f32', value: 0 },
        uFogCol: { type: 'vec3<f32>', value: vec3(0.8, 0.8, 0.85) },
        uLantern: { type: 'vec4<f32>', value: vec4() },
        uQuality: { type: 'f32', value: quality.level },
      },
    });
    this.container.addChild(this.water.mesh, drawPondRim(shape, shape.cx | 0), this.surface);
  }

  contains(x: number, y: number): boolean {
    return pointInPolygon({ x, y }, this.shape.points);
  }

  /** Coordonnées normalisées (0..1) dans le rectangle englobant. */
  toUV(x: number, y: number): { u: number; v: number } {
    const { bbox } = this.shape;
    return { u: (x - bbox.x) / bbox.width, v: (y - bbox.y) / bbox.height };
  }

  /** Crée une onde au point monde (x, y). */
  touch(x: number, y: number, strength = 1, radius = 0.025): void {
    const { u, v } = this.toUV(x, y);
    this.field.disturb(u, v, radius, strength);
  }

  heightAtWorld(x: number, y: number): number {
    const { u, v } = this.toUV(x, y);
    return this.field.heightAt(u * (this.field.w - 1), v * (this.field.h - 1));
  }

  update(dt: number, renderer: Renderer): void {
    // Simulation à pas fixe de 30 Hz, indépendante du framerate.
    this.simAcc += dt;
    let steps = 0;
    while (this.simAcc >= 1 / 30 && steps < 3) {
      this.field.step();
      this.simAcc -= 1 / 30;
      steps++;
    }
    if (steps > 0) this.heightSource.update();
    if (this.simAcc > 0.2) this.simAcc = 0;
    renderer.render({
      container: this.underwater,
      target: this.koiRT,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
  }

  destroy(): void {
    this.koiRT.destroy(true);
    this.container.destroy({ children: true });
    this.underwater.destroy({ children: true });
  }
}
