import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { hexToRgb, mixRgb, mulRgb, rgbToHex, type RGB } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { SeasonState } from '@/world/season';
import { WORLD } from '@/world/layout';

function ridge(g: Graphics, seed: number, base: number, amp: number, x0: number, x1: number): void {
  const rng = mulberry32(seed);
  const waves = [0, 1, 2, 3].map((i) => ({
    f: 0.0045 * (i + 1) * (0.7 + rng() * 0.6),
    a: amp / (i + 1.2),
    p: rng() * 10,
  }));
  const pts: number[] = [x0, base + 200];
  for (let x = x0; x <= x1; x += 16) {
    let h = 0;
    for (const w of waves) h += Math.sin(x * w.f + w.p) * w.a;
    pts.push(x, base - amp * 0.6 - h);
  }
  pts.push(x1, base + 200);
  g.poly(pts).fill(0xffffff);
}

/** Montagnes lointaines (3 crêtes) — teintées selon l'heure (perspective atmosphérique). */
export class Mountains {
  readonly container = new Container();
  private readonly ridges: Graphics[] = [];

  constructor() {
    const h = WORLD.horizon;
    const specs = [
      { seed: 5, base: h - 100, amp: 95 },
      { seed: 9, base: h - 85, amp: 70 },
      { seed: 17, base: h - 70, amp: 48 },
    ];
    for (const s of specs) {
      const g = new Graphics();
      ridge(g, s.seed, s.base, s.amp, -900, WORLD.width + 900);
      this.ridges.push(g);
      this.container.addChild(g);
    }
  }

  update(horizon: RGB, top: RGB, ambient: RGB, snow: number, fog: number): void {
    const far = mixRgb(horizon, top, 0.25);
    const dark = mulRgb(hexToRgb('#2c3b4a'), ambient);
    this.ridges.forEach((g, i) => {
      const t = [0.35, 0.55, 0.75][i]! * (1 - fog * 0.7);
      let c = mixRgb(far, dark, t);
      if (i === 0 && snow > 0) c = mixRgb(c, mixRgb(horizon, [1, 1, 1], 0.4), snow * 0.35);
      g.tint = rgbToHex(c);
    });
  }
}

/** Mur de jardin (tsuiji-bei) avec toit de tuiles, et rideau d'arbres derrière. */
export class GardenWall {
  readonly container = new Container();
  private readonly trees = new Graphics();
  private readonly wall = new Graphics();
  private readonly hedge = new Container();
  private seasonKey = '';

  constructor() {
    this.container.addChild(this.trees, this.wall);
    const y = WORLD.horizon;
    const x0 = -900;
    const x1 = WORLD.width + 900;
    const w = this.wall;
    w.rect(x0, y - 58, x1 - x0, 70).fill(0xe9e2d2);
    // Enduit patiné : légère salissure vers le bas
    for (let k = 0; k < 6; k++)
      w.rect(x0, y - 20 + k * 4, x1 - x0, 4).fill({ color: 0x8a7f68, alpha: 0.04 + k * 0.025 });
    w.rect(x0, y + 4, x1 - x0, 8).fill(0x8f8676);
    for (let x = x0; x < x1; x += 180) w.rect(x, y - 58, 7, 70).fill(0x6b5646);
    w.rect(x0, y - 58, x1 - x0, 5).fill({ color: 0x000000, alpha: 0.18 });
    // Toit : tuiles sombres avec léger débord
    w.poly([x0, y - 60, x1, y - 60, x1, y - 72, x0, y - 72]).fill(0x3a3f45);
    w.poly([x0, y - 72, x1, y - 72, x1, y - 80, x0, y - 80]).fill(0x4b5158);
    for (let x = x0; x < x1; x += 14)
      w.rect(x, y - 72, 2, 12).fill({ color: 0x23272c, alpha: 0.6 });
    w.rect(x0, y - 82, x1 - x0, 3).fill(0x2a2e33);
  }

  /** Haie taillée en coussins (karikomi) au pied du mur, à partir des amas peints. */
  buildHedge(clump: Texture[], parent: Container): void {
    if (this.hedge.children.length) return;
    const rng = mulberry32(7);
    const y = WORLD.horizon + 34;
    parent.addChild(this.hedge);
    this.hedge.label = 'noreflect';
    this.hedge.zIndex = y;
    for (let x = -60; x < WORLD.width + 60; x += 34 + rng() * 30) {
      const r = 26 + rng() * 22;
      const back = new Sprite(clump[Math.floor(rng() * clump.length)]!);
      back.anchor.set(0.5, 0.8);
      back.width = r * 2.6;
      back.height = r * 1.5;
      back.position.set(x + 4, y + 4);
      back.tint = 0x2f4a2c;
      const front = new Sprite(clump[Math.floor(rng() * clump.length)]!);
      front.anchor.set(0.5, 0.8);
      front.width = r * 2.3;
      front.height = r * 1.3;
      front.position.set(x, y);
      front.tint = rng() < 0.5 ? 0x7fa45a : 0x6b9450;
      this.hedge.addChild(back, front);
    }
  }

  setHedgeTint(season: SeasonState): void {
    // Les azalées fleurissent en mai : quelques coussins roses
    const bloom = season.blossom > 0.6 && season.season === 'spring';
    this.hedge.children.forEach((c, i) => {
      if (i % 2 === 1 && c instanceof Sprite)
        c.tint = bloom && i % 6 === 1 ? 0xe89ab8 : i % 4 === 1 ? 0x7fa45a : 0x6b9450;
    });
  }

  updateSeason(season: SeasonState): void {
    const key = `${season.season}:${Math.round(season.autumn * 5)}:${Math.round(season.foliage * 5)}:${Math.round(season.sakura * 5)}`;
    if (key === this.seasonKey) return;
    this.seasonKey = key;
    this.setHedgeTint(season);
    const g = this.trees;
    g.clear();
    const rng = mulberry32(99);
    const y = WORLD.horizon - 60;
    // La forêt lointaine est désormais peinte par le shader du ciel : seules quelques
    // cimes dépassent du mur.
    if (rng() >= 0) {
      for (let x = -900; x < WORLD.width + 900; x += 90 + rng() * 140) {
        const h = 26 + rng() * 40;
        const shade = rgbToHex(mixRgb(hexToRgb('#23392c'), hexToRgb('#2f4a36'), rng()));
        g.poly([x - 16, y + 8, x, y - h, x + 16, y + 8]).fill(shade);
        g.poly([x - 11, y - h * 0.35, x, y - h - 10, x + 8, y - h * 0.35]).fill(
          rgbToHex(mixRgb(hexToRgb('#2f4a36'), hexToRgb('#4d6b4f'), rng())),
        );
      }
      return;
    }
    const green = hexToRgb('#2f4a34');
    const autumnCols = ['#9c3a2a', '#c0612e', '#b98a34'].map(hexToRgb);
    for (let x = -900; x < WORLD.width + 900; x += 38) {
      // Haie basse clairsemée : on laisse voir le paysage emprunté (shakkei)
      if (rng() < 0.55) continue;
      const conifer = rng() < 0.4;
      const deciduousAmount = season.foliage;
      let col = green;
      if (!conifer) {
        const a = autumnCols[Math.floor(rng() * 3)]!;
        col = mixRgb(green, a, season.autumn * (0.5 + rng() * 0.5));
        if (season.sakura > 0.2 && rng() < 0.25)
          col = mixRgb(col, hexToRgb('#e8b8c4'), season.sakura);
        if (deciduousAmount < 0.2) col = mixRgb(hexToRgb('#5a4d48'), hexToRgb('#6a6058'), rng());
      }
      col = mixRgb(col, [0.2, 0.26, 0.3], 0.25);
      const hgt = 30 + rng() * 55;
      const r = conifer ? 26 + rng() * 10 : 34 + rng() * 22;
      const c = rgbToHex(col);
      const shade = rgbToHex(mixRgb(col, [0, 0, 0], 0.25));
      if (conifer) {
        g.poly([x - r, y + 10, x, y - hgt, x + r, y + 10]).fill(shade);
        g.poly([x - r * 0.7, y - hgt * 0.3, x, y - hgt - 20, x + r * 0.5, y - hgt * 0.3]).fill(c);
      } else {
        const sparse = deciduousAmount < 0.2 ? 0.55 : 1;
        g.circle(x, y - hgt * 0.55, r * sparse).fill(shade);
        g.circle(x - r * 0.35, y - hgt * 0.65, r * 0.75 * sparse).fill(c);
        g.circle(x + r * 0.4, y - hgt * 0.5, r * 0.7 * sparse).fill(c);
      }
    }
  }
}

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
    const bark = 0x2b2320;
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

interface Cloud {
  sprite: Sprite;
  x: number;
  h: number;
  speed: number;
  rank: number;
}

/** Cumulus peints qui dérivent au-dessus des montagnes (espace écran). */
export class SkyClouds {
  readonly container = new Container();
  private readonly clouds: Cloud[] = [];

  constructor(textures: Texture[]) {
    const rng = mulberry32(12);
    for (let i = 0; i < 9; i++) {
      const s = new Sprite(textures[i % textures.length]!);
      s.anchor.set(0.5, 0.78);
      this.container.addChild(s);
      const h = 0.28 + rng() * 0.55;
      this.clouds.push({
        sprite: s,
        x: rng() * 1.4 - 0.2,
        h,
        speed: 0.004 + rng() * 0.006,
        rank: rng(),
      });
    }
  }

  update(
    dt: number,
    w: number,
    horizonY: number,
    skyH: number,
    cover: number,
    wind: number,
    lit: RGB,
    shade: RGB,
  ): void {
    const visible = 0.18 + cover * 0.82;
    for (const c of this.clouds) {
      c.x += c.speed * (0.4 + wind * 2.5) * dt;
      if (c.x > 1.35) c.x = -0.35;
      const s = c.sprite;
      // Plus hauts = plus proches = plus grands
      const scale = (w / 393) * (0.16 + c.h * 0.42);
      s.scale.set(scale);
      s.position.set(c.x * w, horizonY - c.h * skyH);
      s.alpha = c.rank < visible ? Math.min(1, (visible - c.rank) * 4) * 0.95 : 0;
      s.visible = s.alpha > 0.01;
      s.tint = rgbToHex(mixRgb(shade, lit, 0.75));
    }
  }
}
