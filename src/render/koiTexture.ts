import { Texture } from 'pixi.js';
import { express, type Genome, type Patch } from '@/pond/genetics';
import { mulberry32 } from '@/world/random';

export const KOI_COLORS = {
  W: '#f3efe6',
  Y: '#ecc458',
  C: '#9c7a4e',
  K: '#26262c',
  sumi: '#141418',
  asagi: '#7389a3',
};

export function hiColor(shade: number): string {
  // 0 : orangé → 1 : cramoisi
  const r = Math.round(232 - shade * 38);
  const g = Math.round(112 - shade * 80);
  const b = Math.round(58 - shade * 18);
  return `rgb(${r},${g},${b})`;
}

/** Demi-largeur relative du corps (vu de dessus) en fonction de t (0 = tête, 1 = queue). */
export function bodyProfile(t: number): number {
  if (t < 0.16) return 0.18 + 0.74 * Math.sin((t / 0.16) * (Math.PI / 2));
  if (t < 0.34) return 0.92 + 0.06 * Math.sin(((t - 0.16) / 0.18) * Math.PI);
  if (t < 0.8) {
    const k = (t - 0.34) / 0.46;
    return 0.92 - 0.72 * k * k * (3 - 2 * k) + 0.02;
  }
  return 0.2;
}

export interface KoiTextureSet {
  body: Texture;
  fin: Texture;
  /** Couleur dominante (pour les nageoires et l'UI). */
  finTint: number;
}

/**
 * Dessine un koï vu du dessus, tête à gauche, sur un canvas (W×H).
 * Le motif est entièrement dérivé du génome.
 */
export function drawKoiCanvas(genome: Genome, W = 160, H = 56): HTMLCanvasElement {
  const ph = express(genome);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const cy = H / 2;
  const bodyLen = W * 0.8;
  /** Le corps occupe ~55 % de la hauteur : le reste accueille les nageoires pectorales. */
  const BW = 0.55;
  const rng = mulberry32(Math.round(genome.hiAmount * 1e6) ^ Math.round(genome.hiShade * 1e5));

  // Silhouette du corps
  const outline = new Path2D();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * bodyLen;
    const y = cy - bodyProfile(t) * cy * BW;
    if (i === 0) outline.moveTo(x, y);
    else outline.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    outline.lineTo(t * bodyLen, cy + bodyProfile(t) * cy * BW);
  }
  outline.closePath();

  // Nageoire caudale (translucide, fourchue)
  const tail = new Path2D();
  const tw = ph.butterfly ? 0.8 : 0.58;
  tail.moveTo(bodyLen - 4, cy - cy * 0.1);
  tail.quadraticCurveTo(W * 0.92, cy - cy * 0.3, W - 1, cy - cy * tw);
  tail.quadraticCurveTo(W * 0.9, cy - cy * 0.08, W * 0.93, cy);
  tail.quadraticCurveTo(W * 0.9, cy + cy * 0.08, W - 1, cy + cy * tw);
  tail.quadraticCurveTo(W * 0.92, cy + cy * 0.3, bodyLen - 4, cy + cy * 0.1);
  tail.closePath();
  // Nageoires pectorales (et pelviennes plus petites)
  const fins = new Path2D();
  const finLen = ph.butterfly ? 0.3 : 0.17;
  for (const side of [-1, 1]) {
    const x0 = bodyLen * 0.2;
    fins.moveTo(x0, cy + side * cy * 0.42);
    fins.quadraticCurveTo(
      x0 + bodyLen * 0.02,
      cy + side * cy * 0.98,
      x0 + bodyLen * finLen,
      cy + side * cy * 0.9,
    );
    fins.quadraticCurveTo(
      x0 + bodyLen * finLen * 0.6,
      cy + side * cy * 0.55,
      x0 + bodyLen * 0.08,
      cy + side * cy * 0.4,
    );
    const x1 = bodyLen * 0.5;
    fins.moveTo(x1, cy + side * cy * 0.3);
    fins.quadraticCurveTo(
      x1 + bodyLen * 0.03,
      cy + side * cy * 0.62,
      x1 + bodyLen * finLen * 0.6,
      cy + side * cy * 0.55,
    );
    fins.quadraticCurveTo(
      x1 + bodyLen * 0.06,
      cy + side * cy * 0.35,
      x1 + bodyLen * 0.05,
      cy + side * cy * 0.28,
    );
  }

  const ground = ph.asagi
    ? KOI_COLORS.asagi
    : ph.metallic && ph.ground === 'W'
      ? '#e8e8ea'
      : KOI_COLORS[ph.ground];
  const hi = hiColor(genome.hiShade);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ph.hi && !ph.tancho && genome.hiAmount > 0.6 ? hi : ground;
  ctx.fill(tail);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle =
    ph.ground === 'K' || (ph.sumiWrap && genome.sumiAmount > 0.5)
      ? '#3a3a40'
      : ph.asagi
        ? '#c86a4a'
        : '#f4efe4';
  ctx.fill(fins);
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(bodyLen - 2, cy + k * 1.5);
    ctx.lineTo(W - 2, cy + k * cy * 0.25);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.clip(outline);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  const blob = (p: Patch, color: string, scale = 1, soft = 3) => {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = soft;
    ctx.beginPath();
    const r = p.r * H * 0.9 * scale;
    ctx.ellipse(
      p.t * bodyLen,
      cy + p.s * cy * 0.4,
      r * 1.4,
      r * 0.6,
      (rng() - 0.5) * 0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Contour irrégulier : petits lobes
    for (let k = 0; k < 3; k++) {
      const a = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        p.t * bodyLen + Math.cos(a) * r,
        cy + p.s * cy * 0.4 + Math.sin(a) * r * 0.4,
        r * 0.6,
        r * 0.3,
        a,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };

  if (ph.asagi) {
    // Ventre et joues rouges visibles sur les flancs
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, bodyLen, H * 0.34);
    ctx.fillRect(0, H * 0.66, bodyLen, H * 0.34);
    ctx.globalAlpha = 1;
    // Réseau d'écailles clair
    ctx.strokeStyle = 'rgba(220,230,245,0.55)';
    ctx.lineWidth = 1;
    for (let x = 6; x < bodyLen; x += 7) {
      for (let y = H * 0.36; y < H * 0.64; y += 5) {
        ctx.beginPath();
        ctx.arc(x + ((y / 6) % 2) * 3.5, y, 3.5, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
    }
  }

  if (ph.hi && !ph.asagi) {
    if (ph.tancho) {
      blob({ t: 0.1, s: 0, r: 0.2 }, hi, 1, 2);
    } else {
      const scale = 0.7 + genome.hiAmount * 0.9;
      for (const p of genome.hiPatches) blob(p, hi, scale);
    }
  }
  if (ph.sumi) {
    const scale = ph.sumiWrap ? 0.9 + genome.sumiAmount * 0.8 : 0.35 + genome.sumiAmount * 0.4;
    for (const p of genome.sumiPatches)
      blob(ph.sumiWrap ? { ...p, s: p.s * 1.3 } : p, KOI_COLORS.sumi, scale, 2);
    if (ph.sumiWrap) blob({ t: 0.05, s: rng() - 0.5, r: 0.16 }, KOI_COLORS.sumi, 1, 2);
  }

  // Écailles
  if (!ph.doitsu) {
    ctx.strokeStyle = ph.ginrin ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 0.8;
    for (let x = bodyLen * 0.14; x < bodyLen * 0.8; x += 5) {
      for (let y = H * 0.25; y < H * 0.75; y += 4.5) {
        ctx.beginPath();
        ctx.arc(x + (Math.round(y / 4.5) % 2) * 2.5, y, 2.6, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
      }
    }
  } else {
    // Rangée de grosses écailles le long du dos
    ctx.fillStyle = ph.asagi ? '#40587a' : 'rgba(40,40,50,0.35)';
    for (let x = bodyLen * 0.16; x < bodyLen * 0.72; x += 7) {
      ctx.beginPath();
      ctx.ellipse(x, cy, 3, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (ph.ginrin) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++)
      ctx.fillRect(bodyLen * (0.15 + rng() * 0.6), H * (0.33 + rng() * 0.34), 1.2, 1.2);
  }

  // Modelé : dos éclairé, flancs plus sombres
  const shade = ctx.createLinearGradient(0, cy - cy * BW, 0, cy + cy * BW);
  shade.addColorStop(0, 'rgba(0,0,0,0.32)');
  shade.addColorStop(0.35, 'rgba(255,255,255,0.06)');
  shade.addColorStop(0.5, ph.metallic ? 'rgba(255,255,240,0.45)' : 'rgba(255,255,255,0.16)');
  shade.addColorStop(0.65, 'rgba(255,255,255,0.04)');
  shade.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  // Nageoire dorsale
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bodyLen * 0.3, cy);
  ctx.lineTo(bodyLen * 0.66, cy);
  ctx.stroke();
  // Yeux
  ctx.fillStyle = '#101010';
  ctx.beginPath();
  ctx.arc(bodyLen * 0.07, cy - cy * 0.26, 1.5, 0, Math.PI * 2);
  ctx.arc(bodyLen * 0.07, cy + cy * 0.26, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}

export function drawFinCanvas(butterfly: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = butterfly ? 40 : 26;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.quadraticCurveTo(32, c.height * 0.6, 16, c.height);
  ctx.quadraticCurveTo(0, c.height * 0.6, 16, 0);
  ctx.fill();
  return c;
}

export function makeKoiTextures(genome: Genome, hiRes: boolean): KoiTextureSet {
  const ph = express(genome);
  const body = Texture.from(drawKoiCanvas(genome, hiRes ? 192 : 128, hiRes ? 96 : 64));
  const fin = Texture.from(drawFinCanvas(ph.butterfly));
  const tint = ph.asagi
    ? 0xa9b8c9
    : ph.ground === 'K'
      ? 0x777780
      : ph.ground === 'C'
        ? 0xc0a070
        : ph.ground === 'Y'
          ? 0xf5dc90
          : 0xffffff;
  return { body, fin, finTint: tint };
}
