import { Container, Graphics, Sprite } from 'pixi.js';
import { sharedTextures } from './textures';
import { drawTree, treeLookKey, type TreeLook } from './trees';

interface ClumpSprite {
  sprite: Sprite;
  x: number;
  y: number;
  phase: number;
  depth: number;
}

/** Arbre complet : bois en Graphics, feuillage en amas peints qui bougent au vent. */
export class TreeView {
  readonly root = new Container();
  private readonly wood = new Graphics();
  private readonly foliage = new Container();
  private clumps: ClumpSprite[] = [];
  private key = '';
  private height = 1;

  constructor() {
    this.root.addChild(this.wood, this.foliage);
  }

  set(look: TreeLook): void {
    const key = treeLookKey(look);
    if (key === this.key) return;
    this.key = key;
    this.height = look.height;
    const { clumps } = drawTree(this.wood, look);
    for (const c of this.clumps) c.sprite.destroy();
    this.clumps = [];
    const tex = sharedTextures().clumps;
    clumps.forEach((c, i) => {
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
        phase: i * 0.7,
        depth: Math.min(1, -c.y / look.height),
      });
    });
  }

  /** Balancement : le haut de l'arbre bouge plus que le bas. */
  sway(time: number, wind: number, phase: number): void {
    const amp = 0.5 + wind * 4;
    this.wood.skew.x = Math.sin(time * (0.6 + wind) + phase) * (0.004 + wind * 0.02);
    for (const c of this.clumps) {
      const k = c.depth;
      c.sprite.x =
        c.x +
        Math.sin(time * (0.8 + wind * 1.5) + phase + c.phase) * amp * k +
        this.wood.skew.x * -c.y;
      c.sprite.y = c.y + Math.cos(time * 1.1 + c.phase) * amp * 0.3 * k;
    }
    void this.height;
  }
}
