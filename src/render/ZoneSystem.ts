import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { ZoneId } from '@/garden/catalog';
import { useGame } from '@/state/game';
import { clamp } from '@/world/math';
import { MAIN_POND, SECOND_POND } from '@/world/layout';
import { mulberry32 } from '@/world/random';
import type { KoiSystem } from './KoiSystem';
import type { LilySystem } from './LilySystem';
import { Particles } from './particles';
import { PondView } from './PondView';
import type { FrameLight, Scene, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';

export const WATERFALL = { x: 800, y: 1015 } as const;
export const TEA_HOUSE = { x: 330, y: 700 } as const;

function waterStreakTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(3);
  ctx.fillStyle = 'rgba(190,220,230,0.55)';
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`;
    ctx.fillRect(rng() * 64, rng() * 128, 1 + rng() * 2, 10 + rng() * 40);
  }
  const t = Texture.from(c);
  t.source.style.addressMode = 'repeat';
  return t;
}

function drawRocks(g: Graphics, seed: number, count: number, w: number, h: number): void {
  const rng = mulberry32(seed);
  const rocks = Array.from({ length: count }, () => ({
    x: (rng() - 0.5) * w,
    y: -rng() * h,
    r: 22 + rng() * 26,
  })).sort((a, b) => a.y - b.y);
  for (const r of rocks) {
    const pts: number[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.75 + rng() * 0.35;
      pts.push(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * 0.7 * k);
    }
    g.poly(pts).fill(0x5d5b55);
    g.ellipse(r.x - r.r * 0.2, r.y - r.r * 0.25, r.r * 0.55, r.r * 0.3).fill({
      color: 0x8e8b82,
      alpha: 0.9,
    });
    if (rng() < 0.5)
      g.ellipse(r.x + r.r * 0.15, r.y - r.r * 0.45, r.r * 0.4, r.r * 0.16).fill({
        color: 0x5f7d48,
        alpha: 0.9,
      });
  }
}

/** Pavillon de thé (chashitsu) : plancher surélevé, shōji, toit de bardeaux. */
function drawTeaHouse(g: Graphics): { window: { x: number; y: number } } {
  g.ellipse(0, 6, 150, 34).fill({ color: 0x1a261c, alpha: 0.3 });
  // Pierres de fondation
  for (let i = -3; i <= 3; i++) g.ellipse(i * 40, 0, 14, 7).fill(0x7a776e);
  // Plancher et engawa
  g.rect(-130, -26, 260, 22).fill(0x6b4f3a);
  g.rect(-130, -26, 260, 5).fill(0x8a6a4f);
  // Murs : shōji
  g.rect(-110, -130, 220, 104).fill(0xf2ecdc);
  for (let x = -110; x <= 110; x += 27.5) g.rect(x - 1.5, -130, 3, 104).fill(0x5a4636);
  for (let y = -130; y <= -26; y += 17)
    g.rect(-110, y - 1, 220, 2).fill({ color: 0x5a4636, alpha: 0.7 });
  // Poteaux
  for (const x of [-112, -38, 38, 112]) g.rect(x - 4, -134, 8, 110).fill(0x4a3829);
  // Toit : bardeaux sombres, débord important
  g.poly([-170, -128, 170, -128, 118, -205, -118, -205]).fill(0x3b3430);
  g.poly([-170, -128, 170, -128, 160, -136, -160, -136]).fill(0x524842);
  for (let i = 0; i < 9; i++) {
    const y = -140 - i * 7.5;
    const k = 1 - i / 11;
    g.rect(-160 * k, y, 320 * k, 1.6).fill({ color: 0x241f1c, alpha: 0.5 });
  }
  g.rect(-122, -212, 244, 8).fill(0x2d2724);
  // Petite entrée (nijiriguchi)
  g.rect(60, -70, 30, 44).fill(0x3e3024);
  return { window: { x: -40, y: -80 } };
}

/** Lieux à débloquer : second bassin, cascade, pavillon de thé. */
export class ZoneSystem implements SceneSystem {
  private built = new Set<ZoneId>();
  private waterfall: { sheet: TilingSprite; foam: Particles; acc: number } | null = null;
  private teaGlow: Sprite | null = null;
  private unsub: () => void;

  constructor(
    private readonly scene: Scene,
    private readonly kois: KoiSystem,
    private readonly lilies: LilySystem,
  ) {
    this.sync();
    this.unsub = useGame.subscribe((s, p) => {
      if (s.zones !== p.zones) this.sync();
    });
  }

  private sync(): void {
    for (const z of useGame.getState().zones) {
      if (this.built.has(z)) continue;
      this.built.add(z);
      if (z === 'second-pond') this.buildSecondPond();
      if (z === 'waterfall') this.buildWaterfall();
      if (z === 'tea-house') this.buildTeaHouse();
    }
  }

  private buildSecondPond(): void {
    const q = this.scene.quality;
    const pond = new PondView(SECOND_POND, sharedTextures(), {
      grid: Math.round(q.rippleGrid * 0.7),
      koiResolution: q.koiResolution,
      level: q.level,
    });
    this.scene.addPond(pond);
    this.kois.addPond(pond);
    this.lilies.addPond(pond);
  }

  private buildWaterfall(): void {
    const root = new Container();
    root.position.set(WATERFALL.x, WATERFALL.y);
    root.zIndex = WATERFALL.y + 1;
    const back = new Graphics();
    drawRocks(back, 11, 9, 170, 140);
    const sheet = new TilingSprite({ texture: waterStreakTexture(), width: 46, height: 120 });
    sheet.position.set(-23, -128);
    sheet.alpha = 0.85;
    const front = new Graphics();
    drawRocks(front, 29, 4, 150, 30);
    const foam = new Particles(120);
    root.addChild(back, sheet, front, foam.container);
    this.scene.objects.addChild(root);
    this.waterfall = { sheet, foam, acc: 0 };
  }

  private buildTeaHouse(): void {
    const root = new Container();
    root.position.set(TEA_HOUSE.x, TEA_HOUSE.y);
    root.zIndex = TEA_HOUSE.y;
    const g = new Graphics();
    const { window } = drawTeaHouse(g);
    const glow = new Sprite(sharedTextures().glow);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = 0xffc27a;
    glow.scale.set(4.5, 2.5);
    glow.position.set(window.x + 40, window.y);
    root.addChild(g, glow);
    this.scene.objects.addChild(root);
    this.teaGlow = glow;
  }

  update(dt: number, time: number, L: FrameLight, env: SceneEnv): void {
    if (this.waterfall) {
      const w = this.waterfall;
      w.sheet.tilePosition.y += dt * 140;
      w.sheet.tilePosition.x = Math.sin(time * 0.7) * 2;
      w.acc += dt * 18;
      const pond = this.scene.ponds[0];
      while (w.acc >= 1) {
        w.acc--;
        w.foam.emit({
          texture: sharedTextures().dot,
          x: (Math.random() - 0.5) * 40,
          y: -6,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 30,
          gy: 60,
          life: 0.9,
          alpha: 0.7,
          scale: 0.4 + Math.random() * 0.4,
        });
        if (pond && Math.random() < 0.3)
          pond.touch(WATERFALL.x + (Math.random() - 0.5) * 30, WATERFALL.y + 14, 0.6, 0.012);
      }
      w.foam.update(dt);
      // Gel partiel en hiver très froid
      w.sheet.alpha = env.weather.temperature < -3 ? 0.35 : 0.85;
    }
    if (this.teaGlow)
      this.teaGlow.alpha = clamp(L.night * 1.1 - 0.15) * (0.9 + 0.1 * Math.sin(time * 2));
    void MAIN_POND;
  }

  destroy(): void {
    this.unsub();
  }
}
