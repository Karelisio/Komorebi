import { Texture } from 'pixi.js';
import { mulberry32 } from '@/world/random';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  return [c, ctx];
}

/** Bruit de valeur périodique (tuilable) sur une grille de `period` cellules. */
function tileNoise(size: number, period: number, seed: number): Float32Array {
  const rng = mulberry32(seed);
  const grid = new Float32Array(period * period).map(() => rng());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period;
      const fy = (y / size) * period;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const g = (gx: number, gy: number) => grid[((gy % period) * period + (gx % period)) | 0]!;
      const a = g(x0, y0);
      const b = g(x0 + 1, y0);
      const c = g(x0, y0 + 1);
      const d = g(x0 + 1, y0 + 1);
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

function fbmTile(size: number, basePeriod: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = tileNoise(size, basePeriod << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i]! += n[i]! * amp;
    norm += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= norm;
  return out;
}

/** Texture de bruit RGBA tuilable (r, g, b, a = quatre fbm différents). */
export function makeNoiseTexture(size = 256): Texture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const chans = [
    fbmTile(size, 4, 4, 11),
    fbmTile(size, 6, 3, 23),
    fbmTile(size, 8, 3, 37),
    fbmTile(size, 5, 4, 51),
  ];
  for (let i = 0; i < size * size; i++) {
    for (let ch = 0; ch < 4; ch++) {
      const v = chans[ch]![i]!;
      // Étire le contraste pour exploiter toute la plage
      img.data[i * 4 + ch] = Math.max(0, Math.min(255, (v - 0.5) * 1.6 * 255 + 128));
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(c);
  tex.source.style.addressMode = 'repeat';
  tex.source.style.scaleMode = 'linear';
  return tex;
}


/** Halo radial doux (lucioles, lanternes, glow). */
export function makeGlowTexture(size = 64): Texture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** Vignette (bords assombris) pour l'étalonnage final. */
export function makeVignetteTexture(w = 256, h = 512): Texture {
  const [c, ctx] = canvas(w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.2, w / 2, h / 2, h * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(c);
}

/** Feuille d'érable (7 lobes) blanche, à teinter. */
export function makeMapleLeafTexture(size = 64): Texture {
  const [c, ctx] = canvas(size, size);
  const cx = size / 2;
  const cy = size * 0.56;
  const R = size * 0.46;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const lobes = 7;
  for (let i = 0; i <= lobes * 2; i++) {
    const a = -Math.PI / 2 + ((i / (lobes * 2)) * Math.PI * 2 - Math.PI) * 0.86;
    const lobe = i % 2 === 0;
    const k = Math.abs(i - lobes) / lobes;
    const r = lobe ? R * (1 - k * 0.45) : R * 0.42 * (1 - k * 0.3);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 1, cy, 2, size * 0.42);
  return Texture.from(c);
}

/** Pétale de cerisier (échancré). */
export function makePetalTexture(size = 32): Texture {
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.95);
  ctx.bezierCurveTo(size * 0.05, size * 0.6, size * 0.15, size * 0.08, size * 0.42, size * 0.12);
  ctx.lineTo(size / 2, size * 0.24);
  ctx.lineTo(size * 0.58, size * 0.12);
  ctx.bezierCurveTo(size * 0.85, size * 0.08, size * 0.95, size * 0.6, size / 2, size * 0.95);
  ctx.fill();
  return Texture.from(c);
}

/** Petit disque plein doux (gouttes, neige, poussière). */
export function makeDotTexture(size = 16): Texture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

/** Trait de pluie. */
export function makeStreakTexture(): Texture {
  const [c, ctx] = canvas(4, 48);
  const g = ctx.createLinearGradient(0, 0, 0, 48);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(1, 0, 2, 48);
  return Texture.from(c);
}






export interface SharedTextures {
  noise: Texture;
  glow: Texture;
  vignette: Texture;
  maple: Texture;
  petal: Texture;
  dot: Texture;
  streak: Texture;
}

let shared: SharedTextures | null = null;

export function sharedTextures(): SharedTextures {
  shared ??= {
    noise: makeNoiseTexture(256),
    glow: makeGlowTexture(),
    vignette: makeVignetteTexture(),
    maple: makeMapleLeafTexture(),
    petal: makePetalTexture(),
    dot: makeDotTexture(),
    streak: makeStreakTexture(),
  };
  return shared;
}
