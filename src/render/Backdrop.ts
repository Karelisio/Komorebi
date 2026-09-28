import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { hexToRgb, mixRgb, rgbToHex } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { SeasonState } from '@/world/season';

interface Leaf {
  sprite: Sprite;
  baseRot: number;
  phase: number;
  x: number;
  y: number;
}

/** Branche d'érable au premier plan, en haut de l'écran : c'est elle qui filtre la lumière. */
export class Canopy {
  readonly container = new Container();
  private readonly branch = new Graphics();
  private readonly leafLayer = new Container();
  private leaves: Leaf[] = [];
  private seasonKey = '';

  constructor(private readonly leafTex: Texture) {
    this.container.addChild(this.branch, this.leafLayer);
  }

  build(width: number, season: SeasonState): void {
    const key = `${Math.round(width)}:${season.season}:${Math.round(season.autumn * 6)}:${Math.round(season.foliage * 6)}`;
    if (key === this.seasonKey) return;
    this.seasonKey = key;
    this.branch.clear();
    this.leafLayer.removeChildren().forEach((c) => c.destroy());
    this.leaves = [];
    const rng = mulberry32(42);
    const bark = 0x4a3a2e;
    const tips: { x: number; y: number }[] = [];
    // Branche organique qui entre par le coin supérieur gauche
    const limb = (
      x: number,
      y: number,
      ang: number,
      len: number,
      w: number,
      depth: number,
    ): void => {
      const segs = 5;
      let px = x;
      let py = y;
      let a = ang;
      for (let i = 0; i < segs; i++) {
        a += (rng() - 0.5) * 0.35 + 0.04;
        const nx = px + Math.cos(a) * (len / segs);
        const ny = py + Math.sin(a) * (len / segs);
        const w0 = w * (1 - i / segs) + 1;
        const w1 = w * (1 - (i + 1) / segs) + 1;
        const dx = nx - px;
        const dy = ny - py;
        const l = Math.hypot(dx, dy) || 1;
        const ox = -dy / l;
        const oy = dx / l;
        this.branch
          .poly([
            px + ox * w0,
            py + oy * w0,
            nx + ox * w1,
            ny + oy * w1,
            nx - ox * w1,
            ny - oy * w1,
            px - ox * w0,
            py - oy * w0,
          ])
          .fill(bark);
        if (depth > 0 && i >= 1 && rng() < 0.55)
          limb(
            nx,
            ny,
            a + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.5),
            len * 0.45,
            w1 * 0.7,
            depth - 1,
          );
        px = nx;
        py = ny;
      }
      tips.push({ x: px, y: py });
    };
    limb(-20, 26, 0.12, width * 0.42, 6, 2);
    const green = hexToRgb('#3d6a34');
    const spring = hexToRgb('#86b653');
    const autumn = ['#c23a24', '#e0602c', '#f0a040', '#a82a30'].map(hexToRgb);
    const count = Math.round(70 * Math.max(0.06, season.foliage));
    for (let i = 0; i < count; i++) {
      const anchor = tips[Math.floor(rng() * tips.length)]!;
      const s = new Sprite(this.leafTex);
      s.anchor.set(0.5, 0.1);
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * 42;
      const x = anchor.x + Math.cos(a) * d;
      const y = anchor.y + Math.sin(a) * d * 0.7 + 6;
      s.position.set(x, y);
      s.scale.set(0.3 + rng() * 0.28);
      let col =
        season.season === 'spring'
          ? mixRgb(spring, green, rng() * 0.5)
          : mixRgb(green, spring, rng() * 0.4);
      col = mixRgb(
        col,
        autumn[Math.floor(rng() * autumn.length)]!,
        season.autumn * (0.6 + rng() * 0.4),
      );
      s.tint = rgbToHex(col);
      s.alpha = 0.92;
      const baseRot = (rng() - 0.5) * 1.8;
      s.rotation = baseRot;
      this.leafLayer.addChild(s);
      this.leaves.push({ sprite: s, baseRot, phase: rng() * Math.PI * 2, x, y });
    }
  }

  update(time: number, wind: number): void {
    const sway = 0.06 + wind * 0.25;
    for (const l of this.leaves) {
      l.sprite.rotation = l.baseRot + Math.sin(time * (1.1 + wind) + l.phase) * sway;
    }
    this.container.rotation = Math.sin(time * 0.35) * 0.006 * (1 + wind * 3);
  }
}
