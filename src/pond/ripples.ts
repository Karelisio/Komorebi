/**
 * Champ de hauteur d'eau (équation d'onde discrète) sur une grille basse résolution.
 * Les cellules hors masque restent à 0 et réfléchissent les ondes (berges).
 */
export class RippleField {
  private cur: Float32Array;
  private prev: Float32Array;
  readonly mask: Uint8Array;
  /** Texture RGBA : r = hauteur, g/b = normale x/y encodées autour de 128. */
  readonly bytes: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
    mask?: Uint8Array,
  ) {
    this.cur = new Float32Array(w * h);
    this.prev = new Float32Array(w * h);
    this.mask = mask ?? new Uint8Array(w * h).fill(1);
    this.bytes = new Uint8Array(w * h * 4);
    this.encode();
  }

  heightAt(x: number, y: number): number {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0;
    return this.cur[iy * this.w + ix] ?? 0;
  }

  /** Perturbation circulaire en coordonnées normalisées (0..1). */
  disturb(u: number, v: number, radius: number, strength: number): void {
    const cx = u * (this.w - 1);
    const cy = v * (this.h - 1);
    const r = Math.max(1, radius * this.w);
    const x0 = Math.max(1, Math.floor(cx - r));
    const x1 = Math.min(this.w - 2, Math.ceil(cx + r));
    const y0 = Math.max(1, Math.floor(cy - r));
    const y1 = Math.min(this.h - 2, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const i = y * this.w + x;
        if (!this.mask[i]) continue;
        this.cur[i] = (this.cur[i] ?? 0) + strength * 0.5 * (1 + Math.cos(Math.PI * d));
      }
    }
  }

  step(damping = 0.985): void {
    const { w, h, cur, prev, mask } = this;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (!mask[i]) {
          prev[i] = 0;
          continue;
        }
        const n = (cur[i - 1]! + cur[i + 1]! + cur[i - w]! + cur[i + w]!) * 0.5 - prev[i]!;
        prev[i] = n * damping;
      }
    }
    this.cur = prev;
    this.prev = cur;
    this.encode();
  }

  /** Énergie totale (utile aux tests et pour savoir si l'eau est calme). */
  energy(): number {
    let e = 0;
    for (let i = 0; i < this.cur.length; i++) e += Math.abs(this.cur[i]!);
    return e;
  }

  private encode(): void {
    const { w, h, cur, bytes } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = cur[i]!;
        const l = x > 0 ? cur[i - 1]! : c;
        const r = x < w - 1 ? cur[i + 1]! : c;
        const t = y > 0 ? cur[i - w]! : c;
        const b = y < h - 1 ? cur[i + w]! : c;
        const o = i * 4;
        bytes[o] = clampByte(128 + c * 60);
        bytes[o + 1] = clampByte(128 + (l - r) * 90);
        bytes[o + 2] = clampByte(128 + (t - b) * 90);
        bytes[o + 3] = 255;
      }
    }
  }
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
