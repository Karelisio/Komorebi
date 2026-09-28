import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { clock } from '@/engine/clock';
import { NEST_SIZE, useGame } from '@/state/game';
import { clamp } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { KoiSystem } from './KoiSystem';
import { rgba, wash } from './painting';
import type { PondView } from './PondView';
import type { FrameLight, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';

interface Bubble {
  root: Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  /** 0 → 1 à l'apparition ; < 0 pendant l'envol après récolte. */
  life: number;
}

/** Pétales par bulle affichée. */
const PER_BUBBLE = 6;
const MAX_BUBBLES = 9;

function paintBubble(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(7);
  // Pétale de lotus rose posé dans une bulle nacrée
  const g = ctx.createRadialGradient(32, 30, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,230,240,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    wash(
      ctx,
      32 + Math.cos(a) * 8,
      32 + Math.sin(a) * 8,
      9,
      5.5,
      i % 2 ? '#f59ab8' : '#f7b8cc',
      0.9,
      rng,
      0.5,
    );
  }
  wash(ctx, 32, 32, 4, 4, '#ffe08a', 0.95, rng, 0.3);
  ctx.strokeStyle = rgba('#ffffff', 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(32, 32, 24, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
  return Texture.from(c);
}

function paintEgg(): Texture {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(3);
  const g = ctx.createRadialGradient(16, 18, 2, 20, 24, 22);
  g.addColorStop(0, '#fffdf6');
  g.addColorStop(0.6, '#f6e7d8');
  g.addColorStop(1, '#e2c9b8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(20, 25, 14, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 9; i++)
    wash(
      ctx,
      12 + rng() * 16,
      14 + rng() * 22,
      1.5 + rng() * 2,
      1.2 + rng() * 1.5,
      '#e98fa9',
      0.5,
      rng,
      0,
    );
  ctx.strokeStyle = rgba('#8a6a5a', 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  return Texture.from(c);
}

/**
 * Récolte et nid : les pétales produits par les koïs apparaissent comme des bulles à toucher ;
 * les œufs en incubation reposent sur une grande feuille de nénuphar.
 */
export class HarvestSystem implements SceneSystem {
  private readonly bubbles: Bubble[] = [];
  private readonly layer = new Container();
  private readonly nest = new Container();
  private readonly eggs: Sprite[] = [];
  private readonly bubbleTex = paintBubble();
  private readonly eggTex = paintEgg();
  private readonly rng = mulberry32(99);
  /** Position monde du nid. */
  readonly nestPos: { x: number; y: number };

  constructor(
    private readonly pond: PondView,
    private readonly kois: KoiSystem,
  ) {
    const { shape } = pond;
    // La surface est en coordonnées monde ; on travaille relativement au rectangle du bassin
    const offset = new Container();
    offset.position.set(shape.bbox.x, shape.bbox.y);
    offset.addChild(this.nest, this.layer);
    pond.surface.addChild(offset);
    this.nestPos = { x: shape.cx - shape.rx * 0.45, y: shape.cy + shape.ry * 0.62 };
    const leaf = new Graphics();
    leaf
      .ellipse(0, 0, 44, 30)
      .fill({ color: 0x4f7f3a, alpha: 0.95 })
      .ellipse(-6, -4, 30, 18)
      .fill({ color: 0x6e9c4c, alpha: 0.6 });
    leaf.moveTo(0, 0).lineTo(40, -8).stroke({ color: 0x2e5a2a, width: 3 });
    this.nest.addChild(leaf);
    for (let i = 0; i < NEST_SIZE; i++) {
      const s = new Sprite(this.eggTex);
      s.anchor.set(0.5, 0.8);
      s.scale.set(0.62);
      s.position.set(-16 + i * 16, 4 - (i % 2) * 6);
      s.visible = false;
      this.nest.addChild(s);
      this.eggs.push(s);
    }
    this.nest.position.set(this.nestPos.x - shape.bbox.x, this.nestPos.y - shape.bbox.y);
    this.nest.visible = false;
  }

  /** Le nid (œufs) est-il sous le doigt ? */
  nestAt(x: number, y: number): boolean {
    return this.nest.visible && Math.hypot(x - this.nestPos.x, (y - this.nestPos.y) * 1.3) < 52;
  }

  /** Touche une bulle : récolte tout ce qui attend. Renvoie la quantité récoltée. */
  collectAt(x: number, y: number): number {
    const { bbox } = this.pond.shape;
    const hit = this.bubbles.some(
      (b) => b.life > 0 && Math.hypot(b.x + bbox.x - x, b.y + bbox.y - y) < 42,
    );
    return hit ? this.collectAll() : 0;
  }

  collectAll(): number {
    const n = useGame.getState().collect();
    if (n > 0)
      for (const b of this.bubbles) {
        b.life = -1;
        this.pond.touch(b.x + this.pond.shape.bbox.x, b.y + this.pond.shape.bbox.y, 0.5, 0.015);
      }
    return n;
  }

  update(dt: number, time: number, _L: FrameLight, _env: SceneEnv): void {
    const g = useGame.getState();
    const { bbox } = this.pond.shape;
    const want = g.pending < 1 ? 0 : clamp(Math.ceil(g.pending / PER_BUBBLE), 1, MAX_BUBBLES);
    const alive = this.bubbles.filter((b) => b.life >= 0).length;
    if (alive < want && this.rng() < dt * 2) {
      // Une bulle monte là où nage un koï
      const kois = g.kois;
      const k = kois[Math.floor(this.rng() * kois.length)];
      const a = k ? this.kois.agentOf(k.id) : undefined;
      let x = a ? a.x : this.pond.shape.cx;
      let y = a ? a.y : this.pond.shape.cy;
      if (!this.pond.contains(x, y)) {
        x = this.pond.shape.cx;
        y = this.pond.shape.cy;
      }
      const root = new Container();
      const halo = new Sprite(sharedTextures().glow);
      halo.anchor.set(0.5);
      halo.scale.set(1.2);
      halo.tint = 0xffd6e4;
      halo.alpha = 0.5;
      halo.blendMode = 'add';
      const s = new Sprite(this.bubbleTex);
      s.anchor.set(0.5);
      s.scale.set(0.85);
      root.addChild(halo, s);
      this.layer.addChild(root);
      this.bubbles.push({
        root,
        x: x - bbox.x,
        y: y - bbox.y,
        vx: (this.rng() - 0.5) * 6,
        vy: (this.rng() - 0.5) * 4,
        phase: this.rng() * 6,
        life: 0,
      });
      this.pond.touch(x, y, 0.4, 0.012);
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      if (b.life >= 0) {
        b.life = Math.min(1, b.life + dt * 1.5);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // Reste sur l'eau
        if (!this.pond.contains(b.x + bbox.x, b.y + bbox.y)) {
          b.vx = -b.vx;
          b.vy = -b.vy;
          b.x += b.vx * dt * 2;
          b.y += b.vy * dt * 2;
        }
        const h = this.pond.heightAtWorld(b.x + bbox.x, b.y + bbox.y);
        b.root.position.set(b.x, b.y + Math.sin(time * 1.4 + b.phase) * 2 + h * 4);
        b.root.scale.set(0.4 + 0.6 * b.life + Math.sin(time * 2 + b.phase) * 0.03);
        b.root.alpha = b.life;
      } else {
        // Envol après la récolte
        b.life -= dt * 1.6;
        b.root.y -= dt * 160;
        b.root.alpha = Math.max(0, 1 + b.life);
        b.root.scale.set(1 - b.life * 0.4);
        if (b.life <= -1) {
          b.root.destroy({ children: true });
          this.bubbles.splice(i, 1);
        }
      }
    }
    // Nid
    const now = clock.now();
    this.nest.visible = g.eggs.length > 0;
    this.eggs.forEach((s, i) => {
      const egg = g.eggs[i];
      s.visible = !!egg;
      if (!egg) return;
      const ready = now >= egg.hatchAt;
      const p = clamp((now - egg.laidAt) / Math.max(1, egg.hatchAt - egg.laidAt));
      s.rotation = ready ? Math.sin(time * 9 + i) * 0.18 : Math.sin(time * 0.8 + i) * 0.04 * p;
      s.tint = ready ? 0xfff1c8 : 0xffffff;
    });
    const h = this.pond.heightAtWorld(this.nestPos.x, this.nestPos.y);
    this.nest.y = this.nestPos.y - bbox.y + h * 3;
  }

  destroy(): void {
    this.layer.destroy({ children: true });
    this.nest.destroy({ children: true });
    this.bubbleTex.destroy(true);
    this.eggTex.destroy(true);
  }
}
