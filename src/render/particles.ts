import { Container, Sprite, type Texture } from 'pixi.js';

export interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Accélération verticale (gravité négative = monte). */
  gy: number;
  life: number;
  maxLife: number;
  rot: number;
  vrot: number;
  /** Oscillation latérale (feuilles, pétales). */
  sway: number;
  phase: number;
  fadeIn: number;
  baseAlpha: number;
  baseScale: number;
  /** Sol : y où la particule s'arrête (puis s'estompe). */
  floor: number;
  onLand?: (p: Particle) => void;
  landed: boolean;
}

export interface EmitOptions {
  texture: Texture;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  gy?: number;
  life: number;
  tint?: number;
  alpha?: number;
  scale?: number;
  rot?: number;
  vrot?: number;
  sway?: number;
  fadeIn?: number;
  floor?: number;
  blend?: 'normal' | 'add';
  anchorY?: number;
  onLand?: (p: Particle) => void;
}

/** Système de particules à base de sprites, avec recyclage. */
export class Particles {
  readonly container = new Container();
  private readonly alive: Particle[] = [];
  private readonly pool: Sprite[] = [];

  constructor(private readonly max = 600) {}

  get count(): number {
    return this.alive.length;
  }

  emit(o: EmitOptions): Particle | null {
    if (this.alive.length >= this.max) return null;
    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = o.texture;
    sprite.anchor.set(0.5, o.anchorY ?? 0.5);
    sprite.tint = o.tint ?? 0xffffff;
    sprite.blendMode = o.blend ?? 'normal';
    sprite.visible = true;
    this.container.addChild(sprite);
    const p: Particle = {
      sprite,
      x: o.x,
      y: o.y,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      gy: o.gy ?? 0,
      life: o.life,
      maxLife: o.life,
      rot: o.rot ?? 0,
      vrot: o.vrot ?? 0,
      sway: o.sway ?? 0,
      phase: Math.random() * Math.PI * 2,
      fadeIn: o.fadeIn ?? 0,
      baseAlpha: o.alpha ?? 1,
      baseScale: o.scale ?? 1,
      floor: o.floor ?? Infinity,
      landed: false,
      ...(o.onLand ? { onLand: o.onLand } : {}),
    };
    this.alive.push(p);
    this.place(p);
    return p;
  }

  private place(p: Particle): void {
    const s = p.sprite;
    s.position.set(p.x + Math.sin(p.phase) * p.sway, p.y);
    s.rotation = p.rot;
    const age = p.maxLife - p.life;
    const fin = p.fadeIn > 0 ? Math.min(1, age / p.fadeIn) : 1;
    const fout = Math.min(1, p.life / Math.min(1.2, p.maxLife * 0.3));
    s.alpha = p.baseAlpha * fin * fout;
    s.scale.set(p.baseScale);
  }

  update(dt: number, wind = 0): void {
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.kill(i);
        continue;
      }
      if (!p.landed) {
        p.vy += p.gy * dt;
        p.x += (p.vx + wind) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.phase += dt * 1.7;
        if (p.y >= p.floor) {
          p.y = p.floor;
          p.landed = true;
          p.life = Math.min(p.life, 2.5);
          p.onLand?.(p);
        }
      }
      this.place(p);
    }
  }

  private kill(i: number): void {
    const p = this.alive[i]!;
    p.sprite.visible = false;
    this.container.removeChild(p.sprite);
    this.pool.push(p.sprite);
    this.alive[i] = this.alive[this.alive.length - 1]!;
    this.alive.pop();
  }

  clear(): void {
    for (let i = this.alive.length - 1; i >= 0; i--) this.kill(i);
  }
}
