import { Container, Graphics } from 'pixi.js';
import { pointInPolygon } from '@/world/layout';
import { clamp, hexToRgb, mixRgb, rgbToHex, smoothstep } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { PondView } from './PondView';
import type { FrameLight, SceneEnv, SceneSystem } from './Scene';

interface Pad {
  root: Container;
  leaf: Graphics;
  flower: Graphics | null;
  x: number;
  y: number;
  r: number;
  rot: number;
  drift: number;
  color: number;
  flowerColor: number;
  open: number;
  key: string;
}

/** Nénuphars : feuilles flottantes et fleurs qui s'ouvrent le jour. */
export class LilySystem implements SceneSystem {
  private pads: { pond: PondView; pad: Pad }[] = [];

  constructor(ponds: PondView[]) {
    for (const pond of ponds) this.addPond(pond);
  }

  addPond(pond: PondView): void {
    const rng = mulberry32(pond.shape.cx | 0);
    const count = Math.round(pond.shape.rx / 45);
    const greens = ['#4f7d3c', '#5d8c45', '#3f6c36', '#6a9a4c'];
    const blooms = ['#f5d6e0', '#fbfbf2', '#f2b8c8', '#fbe7a8'];
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 30; tries++) {
        const a = rng() * Math.PI * 2;
        const r = 0.45 + rng() * 0.45;
        x = pond.shape.cx + Math.cos(a) * pond.shape.rx * r;
        y = pond.shape.cy + Math.sin(a) * pond.shape.ry * r;
        if (pointInPolygon({ x, y }, pond.shape.points)) break;
      }
      const root = new Container();
      const leaf = new Graphics();
      const hasFlower = rng() < 0.55;
      const flower = hasFlower ? new Graphics() : null;
      root.addChild(leaf);
      if (flower) root.addChild(flower);
      root.position.set(x, y);
      pond.surface.addChild(root);
      this.pads.push({
        pond,
        pad: {
          root,
          leaf,
          flower,
          x,
          y,
          r: 12 + rng() * 12,
          rot: rng() * Math.PI * 2,
          drift: rng() * 10,
          color: rgbToHex(hexToRgb(greens[Math.floor(rng() * greens.length)]!)),
          flowerColor: rgbToHex(hexToRgb(blooms[Math.floor(rng() * blooms.length)]!)),
          open: -1,
          key: '',
        },
      });
    }
  }

  private drawLeaf(p: Pad, season: SceneEnv['season']): void {
    const g = p.leaf;
    g.clear();
    const autumnCol = mixRgb(hexToRgb('#4f7d3c'), hexToRgb('#a88a3a'), season.autumn * 0.6);
    const col = season.season === 'autumn' ? rgbToHex(autumnCol) : p.color;
    const notch = 0.35;
    const r = p.r;
    g.ellipse(2, 3, r, r * 0.62).fill({ color: 0x0c1a14, alpha: 0.25 });
    g.moveTo(0, 0);
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = notch / 2 + (i / steps) * (Math.PI * 2 - notch);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.62);
    }
    g.closePath().fill(col);
    g.ellipse(-r * 0.25, -r * 0.18, r * 0.5, r * 0.22).fill({ color: 0xffffff, alpha: 0.08 });
    for (let k = 0; k < 6; k++) {
      const a = notch / 2 + (k / 5) * (Math.PI * 2 - notch);
      g.moveTo(0, 0)
        .lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 * 0.62)
        .stroke({ width: 0.8, color: 0x000000, alpha: 0.12 });
    }
  }

  private drawFlower(p: Pad, open: number): void {
    const g = p.flower;
    if (!g) return;
    g.clear();
    const petals = 10;
    const spread = 0.25 + open * 0.75;
    const len = 5 + open * 6;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + layer * 0.3;
        const d = len * spread * (layer ? 0.7 : 1);
        g.ellipse(
          Math.cos(a) * d * 0.6,
          Math.sin(a) * d * 0.4 - 3,
          2.6 + open * 1.2,
          5 + open * 2,
        ).fill({ color: layer ? 0xffffff : p.flowerColor, alpha: 0.95 });
      }
    }
    g.circle(0, -3, 2 + open * 1.2).fill(0xf2c94c);
  }

  update(dt: number, time: number, _light: FrameLight, env: SceneEnv): void {
    const s = env.season;
    // Pas de nénuphars au cœur de l'hiver
    const presence = clamp(s.foliage * 1.2 + 0.1) * (env.weather.snowCover > 0.5 ? 0.3 : 1);
    const open =
      smoothstep(4, 18, env.sky.sunAltitude) *
      (1 - smoothstep(0.3, 0.9, env.weather.cloudCover / 100) * 0.3) *
      smoothstep(0.1, 0.5, s.blossom + s.fireflies);
    for (const { pond, pad } of this.pads) {
      const key = `${s.season}:${Math.round(s.autumn * 4)}`;
      if (key !== pad.key) {
        this.drawLeaf(pad, s);
        pad.key = key;
      }
      const o = Math.round(open * 12) / 12;
      if (o !== pad.open) {
        this.drawFlower(pad, o);
        pad.open = o;
      }
      if (pad.flower) pad.flower.visible = o > 0.02 || s.blossom > 0.2;
      pad.drift += dt;
      const h = pond.heightAtWorld(pad.x, pad.y);
      pad.root.position.set(
        pad.x + Math.sin(pad.drift * 0.05) * 6,
        pad.y + Math.cos(pad.drift * 0.04) * 3 + h * 4,
      );
      pad.root.rotation = pad.rot + Math.sin(time * 0.1 + pad.drift) * 0.05 + h * 0.2;
      pad.root.alpha = presence;
      pad.root.visible = presence > 0.05;
    }
  }
}
