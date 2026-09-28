import { Container, Sprite, Texture } from 'pixi.js';
import { SAND_ZONE } from '@/garden/placement';
import { mulberry32 } from '@/world/random';

const RAKE_WIDTH = 46;
const TINES = 5;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  return [c, ctx];
}

/**
 * Jardin sec : sable clair + calque de sillons persistant, ratissé au doigt.
 * Le calque est sauvegardé en PNG (data URL) dans la partie.
 */
export class SandView {
  readonly container = new Container();
  private readonly grooves: HTMLCanvasElement;
  private readonly gctx: CanvasRenderingContext2D;
  private readonly grooveTex: Texture;
  private readonly snow: Sprite;
  private dirty = false;
  private last: { x: number; y: number } | null = null;
  private strokeLen = 0;

  constructor() {
    const { width: w, height: h } = SAND_ZONE;
    const [base, bctx] = canvas(w, h);
    const rng = mulberry32(5);
    bctx.fillStyle = '#e4d8bf';
    bctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 190 + rng() * 60;
      bctx.fillStyle = `rgba(${v},${v * 0.95},${v * 0.85},${0.25 + rng() * 0.3})`;
      bctx.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 1 + rng() * 1.5);
    }
    // Bordure de bois / pierres basses
    bctx.strokeStyle = 'rgba(110,95,75,0.9)';
    bctx.lineWidth = 6;
    bctx.strokeRect(3, 3, w - 6, h - 6);
    bctx.strokeStyle = 'rgba(255,255,255,0.25)';
    bctx.lineWidth = 2;
    bctx.strokeRect(6, 6, w - 12, h - 12);
    const baseSprite = new Sprite(Texture.from(base));

    [this.grooves, this.gctx] = canvas(w, h);
    this.grooveTex = Texture.from(this.grooves);
    const grooveSprite = new Sprite(this.grooveTex);

    const [snowC, sctx] = canvas(64, 32);
    sctx.fillStyle = '#f3f6fb';
    sctx.fillRect(0, 0, 64, 32);
    this.snow = new Sprite(Texture.from(snowC));
    this.snow.width = w;
    this.snow.height = h;
    this.snow.alpha = 0;

    this.container.position.set(SAND_ZONE.x, SAND_ZONE.y);
    this.container.addChild(baseSprite, grooveSprite, this.snow);
    this.container.zIndex = SAND_ZONE.y - 1;
  }

  /** Motif initial : lignes droites, cercles autour des pierres. */
  drawDefault(stones: readonly { x: number; y: number; r: number }[]): void {
    const { width: w, height: h } = SAND_ZONE;
    this.gctx.clearRect(0, 0, w, h);
    for (let y = 22; y < h - 16; y += RAKE_WIDTH) this.rakeLine(14, y, w - 14, y);
    for (const s of stones) {
      const cx = s.x - SAND_ZONE.x;
      const cy = s.y - SAND_ZONE.y;
      for (let k = 0; k < 3; k++) {
        const r = s.r + 14 + k * RAKE_WIDTH * 0.9;
        this.gctx.save();
        this.gctx.globalCompositeOperation = 'destination-out';
        this.gctx.beginPath();
        this.gctx.ellipse(
          cx,
          cy,
          r + RAKE_WIDTH / 2,
          (r + RAKE_WIDTH / 2) * 0.62,
          0,
          0,
          Math.PI * 2,
        );
        this.gctx.fill();
        this.gctx.restore();
      }
      for (let k = 0; k < 3; k++) {
        const r = s.r + 14 + k * (RAKE_WIDTH / TINES) * TINES * 0.9;
        this.ringGroove(cx, cy, r);
      }
    }
    this.grooveTex.source.update();
  }

  private ringGroove(cx: number, cy: number, r: number): void {
    const spacing = RAKE_WIDTH / TINES;
    for (let t = 0; t < TINES; t++) {
      const rr = r + t * spacing * 0.9;
      this.gctx.lineWidth = 2.4;
      this.gctx.strokeStyle = 'rgba(120,100,70,0.38)';
      this.gctx.beginPath();
      this.gctx.ellipse(cx, cy + 1, rr, rr * 0.62, 0, 0, Math.PI * 2);
      this.gctx.stroke();
      this.gctx.lineWidth = 1.6;
      this.gctx.strokeStyle = 'rgba(255,252,240,0.6)';
      this.gctx.beginPath();
      this.gctx.ellipse(cx, cy - 1.2, rr, rr * 0.62, 0, 0, Math.PI * 2);
      this.gctx.stroke();
    }
  }

  private rakeLine(x0: number, y0: number, x1: number, y1: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const ctx = this.gctx;
    // Efface les anciens sillons sous le râteau
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineWidth = RAKE_WIDTH + 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
    const spacing = RAKE_WIDTH / TINES;
    ctx.lineCap = 'round';
    for (let t = 0; t < TINES; t++) {
      const o = (t - (TINES - 1) / 2) * spacing;
      const ax = x0 + nx * o;
      const ay = y0 + ny * o;
      const bx = x1 + nx * o;
      const by = y1 + ny * o;
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(120,100,70,0.38)';
      ctx.beginPath();
      ctx.moveTo(ax, ay + 1);
      ctx.lineTo(bx, by + 1);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255,252,240,0.6)';
      ctx.beginPath();
      ctx.moveTo(ax, ay - 1.2);
      ctx.lineTo(bx, by - 1.2);
      ctx.stroke();
    }
  }

  contains(x: number, y: number): boolean {
    return (
      x >= SAND_ZONE.x &&
      x <= SAND_ZONE.x + SAND_ZONE.width &&
      y >= SAND_ZONE.y &&
      y <= SAND_ZONE.y + SAND_ZONE.height
    );
  }

  /** Ratissage : appelé à chaque mouvement du doigt (coordonnées monde). Renvoie la distance ratissée. */
  rake(x: number, y: number): number {
    const lx = x - SAND_ZONE.x;
    const ly = y - SAND_ZONE.y;
    if (!this.last) {
      this.last = { x: lx, y: ly };
      return 0;
    }
    const d = Math.hypot(lx - this.last.x, ly - this.last.y);
    if (d < 6) return 0;
    this.rakeLine(this.last.x, this.last.y, lx, ly);
    this.last = { x: lx, y: ly };
    this.strokeLen += d;
    this.dirty = true;
    return d;
  }

  endStroke(): number {
    this.last = null;
    const len = this.strokeLen;
    this.strokeLen = 0;
    return len;
  }

  /** Téléverse le calque vers le GPU si nécessaire (à chaque frame). */
  update(snowCover: number, wet: number): void {
    if (this.dirty) {
      this.grooveTex.source.update();
      this.dirty = false;
    }
    this.snow.alpha = snowCover * 0.9;
    this.container.tint = wet > 0.3 ? 0xd8d0c0 : 0xffffff;
  }

  serialize(): string {
    return this.grooves.toDataURL('image/png');
  }

  async load(dataUrl: string): Promise<void> {
    if (!dataUrl) return;
    const img = new Image();
    img.src = dataUrl;
    await img.decode().catch(() => undefined);
    if (!img.width) return;
    this.gctx.clearRect(0, 0, this.grooves.width, this.grooves.height);
    this.gctx.drawImage(img, 0, 0);
    this.grooveTex.source.update();
  }
}
