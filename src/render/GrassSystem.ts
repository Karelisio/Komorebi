import { Sprite } from 'pixi.js';
import { inSand } from '@/garden/placement';
import { MAIN_POND, pointInPolygon, SECOND_POND, WORLD } from '@/world/layout';
import { clamp, hexToRgb, mixRgb, rgbToHex, type RGB } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { FrameLight, Scene, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';

interface Tuft {
  sprite: Sprite;
  x: number;
  y: number;
  phase: number;
  flower: boolean;
  tone: number;
  hue: number;
}

const FLOWER_COLORS: RGB[] = ['#ffffff', '#f7e27a', '#f3b9cc', '#b9c8f2', '#ffffff'].map(hexToRgb);

/** Touffes d'herbe et fleurs des champs, disséminées et bercées par le vent. */
export class GrassSystem implements SceneSystem {
  private readonly tufts: Tuft[] = [];
  private key = '';

  constructor(scene: Scene) {
    const rng = mulberry32(2024);
    const tex = sharedTextures();
    const n = Math.round(260 * scene.quality.particles + 60);
    for (let i = 0; i < n; i++) {
      const x = 20 + rng() * (WORLD.width - 40);
      const y = WORLD.horizon + 40 + Math.pow(rng(), 0.8) * (WORLD.height - WORLD.horizon - 60);
      const near = (s: typeof MAIN_POND) => pointInPolygon({ x, y }, s.points);
      if (near(MAIN_POND) || near(SECOND_POND) || inSand(x, y)) continue;
      const flower = rng() < 0.22;
      const s = new Sprite(
        flower ? tex.wildflower : tex.tufts[Math.floor(rng() * tex.tufts.length)]!,
      );
      s.anchor.set(0.5, flower ? 0.5 : 1);
      // Plus petit au loin (perspective)
      const persp = 0.55 + 0.6 * clamp((y - WORLD.horizon) / 1500);
      s.scale.set((flower ? 0.45 + rng() * 0.25 : 0.7 + rng() * 0.6) * persp);
      s.position.set(x, y);
      s.zIndex = y - 1;
      scene.objects.addChild(s);
      this.tufts.push({
        sprite: s,
        x,
        y,
        phase: rng() * 6,
        flower,
        tone: rng(),
        hue: Math.floor(rng() * FLOWER_COLORS.length),
      });
    }
  }

  update(_dt: number, time: number, L: FrameLight, env: SceneEnv): void {
    const s = env.season;
    const key = `${s.season}:${Math.round(s.autumn * 5)}:${Math.round(s.blossom * 5)}:${Math.round(env.weather.snowCover * 4)}`;
    if (key !== this.key) {
      this.key = key;
      const green =
        s.season === 'spring'
          ? hexToRgb('#e6f5cf')
          : s.season === 'winter'
            ? hexToRgb('#c9c4a2')
            : hexToRgb('#dbe8c6');
      const autumn = hexToRgb('#e8c98a');
      const bloom = clamp(s.blossom * 1.4 + s.fireflies * 0.5);
      for (const t of this.tufts) {
        if (t.flower) {
          t.sprite.visible = t.tone < bloom && env.weather.snowCover < 0.4;
          t.sprite.tint = rgbToHex(FLOWER_COLORS[t.hue]!);
        } else {
          t.sprite.visible = env.weather.snowCover < 0.7 || t.tone < 0.3;
          t.sprite.tint = rgbToHex(
            mixRgb(mixRgb(green, [1, 1, 1], t.tone * 0.2), autumn, s.autumn * 0.7),
          );
        }
      }
    }
    // Vague de vent qui traverse le jardin
    const amp = 0.05 + L.wind * 0.3;
    const speed = 1 + L.wind * 2;
    for (const t of this.tufts) {
      if (!t.sprite.visible) continue;
      const w = Math.sin(t.x * 0.012 + t.y * 0.004 - time * speed + t.phase * 0.3);
      if (!t.flower) t.sprite.skew.x = w * amp + Math.sin(time * 2.3 + t.phase) * 0.02;
      else t.sprite.y = t.y + Math.sin(time * 1.7 + t.phase) * 1.2;
    }
  }
}
