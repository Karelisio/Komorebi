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

/** Fond du bassin : galets, sable et quelques feuilles immergées. */
export function makeBedTexture(w = 512, h = 320, seed = 3): Texture {
  const [c, ctx] = canvas(w, h);
  const rng = mulberry32(seed);
  const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, '#3e4a3c');
  g.addColorStop(0.7, '#56604a');
  g.addColorStop(1, '#7d7a5c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 2 + rng() * rng() * 9;
    const tone = 70 + rng() * 70;
    ctx.fillStyle = `rgba(${tone},${tone * 0.95},${tone * 0.82},${0.25 + rng() * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.3), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Algues douces
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(60,${90 + rng() * 40},50,0.35)`;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    let x = rng() * w;
    let y = rng() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rng() - 0.5) * 16;
      y += (rng() - 0.5) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = Texture.from(c);
  tex.source.style.addressMode = 'clamp-to-edge';
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

/** Herbe peinte, tuilable : milliers de brins avec dégradé base sombre → pointe claire. */
export function makeGrassTexture(size = 512, seed = 17): Texture {
  const [c, ctx] = canvas(size, size);
  const rng = mulberry32(seed);
  ctx.fillStyle = '#3e5c2e';
  ctx.fillRect(0, 0, size, size);
  // Taches de fond (mottes, terre, mousse)
  for (let i = 0; i < 260; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 6 + rng() * 26;
    const tone = rng();
    ctx.fillStyle =
      tone < 0.5 ? `rgba(40,62,30,${0.25 + rng() * 0.3})` : `rgba(96,122,62,${0.15 + rng() * 0.2})`;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  const tips = ['#6f9a48', '#86ad55', '#9cbf62', '#5d8a3c', '#a9c96e', '#78a04c'];
  const blades = 22000;
  for (let i = 0; i < blades; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 3.5 + rng() * rng() * 10;
    const ang = (rng() - 0.5) * 0.5;
    const curve = (rng() - 0.5) * 3;
    const tip = tips[Math.floor(rng() * tips.length)]!;
    const w = 0.8 + rng() * 1.1;
    for (const dx of x < 20 ? [0, size] : x > size - 20 ? [0, -size] : [0]) {
      for (const dy of y < 20 ? [0, size] : [0]) {
        const bx = x + dx;
        const by = y + dy;
        const ex = bx + Math.sin(ang) * len;
        const ey = by - Math.cos(ang) * len;
        const g = ctx.createLinearGradient(bx, by, ex, ey);
        g.addColorStop(0, 'rgba(34,52,26,0.95)');
        g.addColorStop(1, tip);
        ctx.strokeStyle = g;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + curve, (by + ey) / 2, ex, ey);
        ctx.stroke();
      }
    }
  }
  const tex = Texture.from(c);
  tex.source.style.addressMode = 'repeat';
  tex.source.style.scaleMode = 'linear';
  tex.source.autoGenerateMipmaps = true;
  return tex;
}

/** Touffe d'herbe (brins en éventail), blanche-verte, à teinter. */
export function makeTuftTexture(seed: number): Texture {
  const [c, ctx] = canvas(72, 56);
  const rng = mulberry32(seed);
  const n = 14 + Math.floor(rng() * 10);
  for (let i = 0; i < n; i++) {
    const bx = 36 + (rng() - 0.5) * 18;
    const len = 20 + rng() * 32;
    const ang = (rng() - 0.5) * 1.3;
    const ex = bx + Math.sin(ang) * len;
    const ey = 54 - Math.cos(ang) * len;
    const g = ctx.createLinearGradient(bx, 54, ex, ey);
    g.addColorStop(0, '#2c4322');
    g.addColorStop(0.5, '#5f8a3e');
    g.addColorStop(1, rng() < 0.5 ? '#a6c86c' : '#8cb55a');
    ctx.fillStyle = g;
    const w = 1.6 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(bx - w, 54);
    ctx.quadraticCurveTo(bx + (ex - bx) * 0.4 - w, 54 + (ey - 54) * 0.55, ex, ey);
    ctx.quadraticCurveTo(bx + (ex - bx) * 0.4 + w, 54 + (ey - 54) * 0.55, bx + w, 54);
    ctx.fill();
  }
  return Texture.from(c);
}

/** Petite fleur des champs (5 pétales), blanche à teinter. */
export function makeWildflowerTexture(): Texture {
  const [c, ctx] = canvas(24, 24);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(12 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, 4.2, 3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.arc(12, 12, 2.6, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

/**
 * Amas de feuillage peint en niveaux de gris (dessus clair, dessous sombre),
 * à teinter : feuilles, fleurs de cerisier ou aiguilles de pin.
 */
export function makeClumpTexture(
  kind: 'leaf' | 'maple' | 'blossom' | 'needle',
  seed: number,
): Texture {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const rng = mulberry32(seed);
  const blobs = Array.from({ length: 5 }, () => ({
    x: S / 2 + (rng() - 0.5) * 44,
    y: S / 2 + (rng() - 0.5) * 36,
    r: 26 + rng() * 16,
  }));
  const inside = (x: number, y: number) => blobs.some((b) => Math.hypot(x - b.x, y - b.y) < b.r);
  // Fond sombre pour éviter les trous
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(95,95,95,0.95)');
    g.addColorStop(0.85, 'rgba(80,80,80,0.8)');
    g.addColorStop(1, 'rgba(70,70,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const n = kind === 'needle' ? 520 : 240;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let k = 0; k < 12; k++) {
      x = 8 + rng() * (S - 16);
      y = 8 + rng() * (S - 16);
      if (inside(x, y)) break;
    }
    if (!inside(x, y) && rng() < 0.85) continue;
    // Modelé : lumière venant du haut-gauche
    const lum = Math.max(
      0.3,
      Math.min(1, 0.95 - ((y - 20) / S) * 0.65 - ((x - 20) / S) * 0.2 + (rng() - 0.5) * 0.25),
    );
    const v = Math.round(lum * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.strokeStyle = ctx.fillStyle;
    const a = rng() * Math.PI * 2;
    if (kind === 'needle') {
      const len = 5 + rng() * 6;
      const ang = (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0 : Math.PI);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.5);
      ctx.stroke();
    } else if (kind === 'maple') {
      // Petite feuille palmée à 5 lobes
      const r = 3.2 + rng() * 2.2;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const pa = a + (k / 10) * Math.PI * 2;
        const rr = k % 2 === 0 ? r : r * 0.45;
        const px = x + Math.cos(pa) * rr;
        const py = y + Math.sin(pa) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.fill();
    } else if (kind === 'blossom' && rng() < 0.8) {
      const r = 2.2 + rng() * 1.4;
      for (let p = 0; p < 5; p++) {
        const pa = a + (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(pa) * r,
          y + Math.sin(pa) * r,
          r * 0.8,
          r * 0.6,
          pa,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      const l = 5 + rng() * 4;
      const w = 2.2 + rng() * 1.3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l);
      ctx.quadraticCurveTo(
        x - Math.sin(a) * w,
        y + Math.cos(a) * w,
        x + Math.cos(a) * l,
        y + Math.sin(a) * l,
      );
      ctx.quadraticCurveTo(
        x + Math.sin(a) * w,
        y - Math.cos(a) * w,
        x - Math.cos(a) * l,
        y - Math.sin(a) * l,
      );
      ctx.fill();
    }
  }
  return Texture.from(c);
}

/** Cumulus peint : dessus blanc lumineux, dessous gris-bleu, bords doux. */
export function makeCloudTexture(seed: number): Texture {
  const W = 320;
  const H = 150;
  const [c, ctx] = canvas(W, H);
  const rng = mulberry32(seed);
  const base = H * 0.78;
  const puffs = 7 + Math.floor(rng() * 5);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const x = W * (0.14 + t * 0.72) + (rng() - 0.5) * 20;
    const hump = Math.sin(t * Math.PI);
    const r = 22 + hump * 34 + rng() * 14;
    const y = base - r * (0.45 + rng() * 0.35) - hump * 10;
    const g = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Base plate et ombrée
  ctx.globalCompositeOperation = 'destination-in';
  const cut = ctx.createLinearGradient(0, base - 6, 0, base + 10);
  cut.addColorStop(0, 'rgba(0,0,0,1)');
  cut.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cut;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, H * 0.15, 0, base);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(0.55, 'rgba(200,205,220,0.35)');
  shade.addColorStop(1, 'rgba(140,150,175,0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return Texture.from(c);
}

export interface SharedTextures {
  noise: Texture;
  bed: Texture;
  glow: Texture;
  vignette: Texture;
  maple: Texture;
  petal: Texture;
  dot: Texture;
  streak: Texture;
  grass: Texture;
  tufts: Texture[];
  wildflower: Texture;
  clumps: Record<'leaf' | 'maple' | 'blossom' | 'needle', Texture[]>;
  clouds: Texture[];
}

let shared: SharedTextures | null = null;

export function sharedTextures(): SharedTextures {
  shared ??= {
    noise: makeNoiseTexture(256),
    bed: makeBedTexture(),
    glow: makeGlowTexture(),
    vignette: makeVignetteTexture(),
    maple: makeMapleLeafTexture(),
    petal: makePetalTexture(),
    dot: makeDotTexture(),
    streak: makeStreakTexture(),
    grass: makeGrassTexture(),
    tufts: [1, 2, 3, 4].map((i) => makeTuftTexture(i * 31)),
    wildflower: makeWildflowerTexture(),
    clouds: [1, 2, 3, 4].map((i) => makeCloudTexture(i * 131)),
    clumps: {
      leaf: [1, 2, 3].map((i) => makeClumpTexture('leaf', i * 97)),
      maple: [1, 2, 3].map((i) => makeClumpTexture('maple', i * 89)),
      blossom: [1, 2].map((i) => makeClumpTexture('blossom', i * 53)),
      needle: [1, 2].map((i) => makeClumpTexture('needle', i * 71)),
    },
  };
  return shared;
}
