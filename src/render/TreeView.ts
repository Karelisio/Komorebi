import { Container, Graphics, Sprite } from 'pixi.js';
import { sharedTextures } from './textures';
import { drawTree, treeLookKey, type Clump, type TreeLook } from './trees';

/** Lumière du soleil vue par les arbres (mise à jour par la scène à chaque image). */
export interface SunLight {
  /** Côté du soleil à l'écran : -1 gauche, 1 droite. */
  side: number;
  /** Direction de l'ombre portée au sol (unitaire, espace monde). */
  dx: number;
  dy: number;
  /** Longueur relative de l'ombre (1 ≈ soleil à 45°). */
  len: number;
  /** Intensité (0 la nuit ou par temps couvert). */
  strength: number;
}

export const DEFAULT_SUN: SunLight = { side: -0.4, dx: 0.3, dy: 0.5, len: 0.8, strength: 0.5 };

interface ClumpSprite {
  sprite: Sprite;
  x: number;
  y: number;
  r: number;
  phase: number;
  depth: number;
  role: NonNullable<Clump['role']>;
}

/** Arbre complet : bois en Graphics, feuillage en amas peints, ombre portée qui suit le soleil. */
export class TreeView {
  readonly root = new Container();
  private readonly shadow: Sprite;
  private readonly wood = new Graphics();
  private readonly foliage = new Container();
  private readonly front = new Graphics();
  private clumps: ClumpSprite[] = [];
  private key = '';
  private crown = { cx: 0, cy: -100, rx: 40, ry: 60 };
  private height = 100;

  constructor() {
    this.shadow = new Sprite(sharedTextures().glow);
    this.shadow.anchor.set(0.5);
    this.shadow.tint = 0x0b150e;
    this.root.addChild(this.shadow, this.wood, this.foliage);
  }

  set(look: TreeLook): void {
    const key = treeLookKey(look);
    if (key === this.key) return;
    this.key = key;
    this.height = look.height;
    const { clumps, front, crown } = drawTree(this.wood, look);
    this.crown = crown;
    this.foliage.removeChildren().forEach((c) => {
      if (c !== this.front) c.destroy();
    });
    this.clumps = [];
    const tex = sharedTextures().clumps;
    // Rameaux avant : dessinés entre la masse principale et les touches de lumière
    this.front.clear();
    const bark = 0x4a3b33;
    for (const sgm of front) {
      const dx = sgm.x2 - sgm.x1;
      const dy = sgm.y2 - sgm.y1;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      this.front
        .poly([
          sgm.x1 + nx * sgm.w1,
          sgm.y1 + ny * sgm.w1,
          sgm.x2 + nx * sgm.w2,
          sgm.y2 + ny * sgm.w2,
          sgm.x2 - nx * sgm.w2,
          sgm.y2 - ny * sgm.w2,
          sgm.x1 - nx * sgm.w1,
          sgm.y1 - ny * sgm.w1,
        ])
        .fill({ color: bark, alpha: 0.75 });
    }
    let frontInserted = false;
    clumps.forEach((c, i) => {
      const role = c.role ?? 'main';
      if (!frontInserted && (role === 'light' || role === 'snow')) {
        this.foliage.addChild(this.front);
        frontInserted = true;
      }
      const variants = tex[c.kind];
      const s = new Sprite(variants[(i + look.seed) % variants.length]!);
      s.anchor.set(0.5);
      s.width = c.r * 2.4;
      s.height = c.r * 2.4 * c.ry;
      s.tint = c.tint;
      s.alpha = c.alpha;
      s.rotation = ((i * 2.39 + look.seed) % 1) * 0.5 - 0.25;
      s.position.set(c.x, c.y);
      this.foliage.addChild(s);
      this.clumps.push({
        sprite: s,
        x: c.x,
        y: c.y,
        r: c.r,
        phase: i * 0.7,
        depth: Math.min(1, -c.y / look.height),
        role,
      });
    });
    if (!frontInserted) this.foliage.addChild(this.front);
  }

  /** Balancement au vent, modelé selon le soleil et ombre portée au sol. */
  sway(time: number, wind: number, phase: number, sun: SunLight = DEFAULT_SUN, flip = 1): void {
    const amp = 0.5 + wind * 4;
    this.wood.skew.x = Math.sin(time * (0.6 + wind) + phase) * (0.004 + wind * 0.02);
    const side = sun.side * flip;
    for (const c of this.clumps) {
      const k = c.depth;
      // Les lumières glissent vers le soleil, les ombres à l'opposé
      const lightShift =
        c.role === 'light' ? side * c.r * 0.35 : c.role === 'shadow' ? -side * c.r * 0.2 : 0;
      c.sprite.x =
        c.x +
        lightShift +
        Math.sin(time * (0.8 + wind * 1.5) + phase + c.phase) * amp * k +
        this.wood.skew.x * -c.y;
      c.sprite.y = c.y + Math.cos(time * 1.1 + c.phase) * amp * 0.3 * k;
    }
    this.front.skew.x = this.wood.skew.x;
    // Ombre portée : part du pied de l'arbre et s'étire à l'opposé du soleil
    const w = this.crown.rx * 2;
    const len = Math.min(2.2, sun.len);
    const reach = (this.height * 0.18 - this.crown.cy * 0.28) * len;
    const dirX = sun.dx * flip;
    const dirY = sun.dy * 0.45;
    const n = Math.hypot(dirX, dirY) || 1;
    this.shadow.position.set((dirX / n) * reach * 0.5, 4 + (dirY / n) * reach * 0.5);
    this.shadow.rotation = Math.atan2(dirY, dirX);
    this.shadow.scale.set((w * 0.85 + reach) / 64, (w * 0.5) / 64);
    this.shadow.alpha = 0.18 + 0.4 * sun.strength;
  }
}
