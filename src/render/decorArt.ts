import { Texture } from 'pixi.js';
import type { DecorId } from '@/garden/decor';
import { mulberry32 } from '@/world/random';
import type { SeasonState } from '@/world/season';
import { rgba, wash } from './painting';

/**
 * Décors peints à l'aquarelle, vus de trois quarts, posés sur la berge.
 * Chaque dessin est centré en bas (pied de l'objet) dans un canevas `w × h` (unités monde × échelle).
 */

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

export interface DecorArt {
  texture: Texture;
  /** Taille en unités monde. */
  width: number;
  height: number;
  /** Position de la flamme (lanternes), relative au pied, en unités monde. */
  light?: { x: number; y: number };
}

const SCALE = 2;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.round(w * SCALE);
  c.height = Math.round(h * SCALE);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  ctx.scale(SCALE, SCALE);
  return [c, ctx];
}

/** Ombre portée douce au pied de l'objet. */
function footShadow(ctx: Ctx, x: number, y: number, rx: number, rng: Rng): void {
  ctx.save();
  ctx.filter = `blur(${Math.round(rx * 0.25 * SCALE)}px)`;
  wash(ctx, x + rx * 0.12, y - rx * 0.05, rx, rx * 0.32, '#122012', 0.45, rng, 0);
  ctx.restore();
}

/** Bloc de pierre peint (lumière en haut à gauche). */
function stoneBlock(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  rng: Rng,
): void {
  ctx.beginPath();
  const r = Math.min(w, h) * 0.18;
  ctx.roundRect(x - w / 2, y - h, w, h, r);
  ctx.fillStyle = rgba(base, 0.96);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba('#3d3a34', 0.35);
  ctx.stroke();
  // Face éclairée et ombre propre
  ctx.fillStyle = rgba('#efe8d6', 0.22);
  ctx.fillRect(x - w / 2 + 1, y - h + 1, w * 0.35, h - 2);
  ctx.fillStyle = rgba('#2e2c28', 0.18);
  ctx.fillRect(x + w * 0.18, y - h + 1, w * 0.32 - 1, h - 2);
  if (rng() < 0.6) wash(ctx, x - w * 0.2, y - h + 2, w * 0.25, 2.5, '#6f8f45', 0.7, rng, 0);
}

/** Toit courbe de lanterne. */
function roof(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.25, x - w * 0.12, y - h * 0.8);
  ctx.lineTo(x + w * 0.12, y - h * 0.8);
  ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.25, x + w / 2, y);
  ctx.quadraticCurveTo(x, y - h * 0.18, x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.97);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba('#3a3731', 0.4);
  ctx.stroke();
  ctx.fillStyle = rgba('#f2ecdc', 0.2);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 2, y - 1);
  ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.25, x - w * 0.1, y - h * 0.78);
  ctx.lineTo(x - w * 0.02, y - h * 0.78);
  ctx.quadraticCurveTo(x - w * 0.22, y - h * 0.3, x - w * 0.2, y - 2);
  ctx.fill();
}

function leafMass(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  colors: readonly string[],
  rng: Rng,
  n = 7,
): void {
  // Masse sombre, puis touches plus claires côté lumière
  wash(ctx, x, y, r, r * 0.8, colors[0]!, 0.9, rng, 0.5);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.6;
    const c = colors[1 + Math.floor(rng() * (colors.length - 1))]!;
    wash(
      ctx,
      x + Math.cos(a) * d - r * 0.12,
      y + Math.sin(a) * d * 0.7 - r * 0.12,
      r * (0.3 + rng() * 0.3),
      r * (0.25 + rng() * 0.2),
      c,
      0.75,
      rng,
      0.4,
    );
  }
}

function trunk(
  ctx: Ctx,
  x: number,
  y: number,
  h: number,
  w: number,
  lean: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.6 + lean * 0.5, y - h * 0.5, x - w * 0.35 + lean, y - h);
  ctx.lineTo(x + w * 0.35 + lean, y - h);
  ctx.quadraticCurveTo(x + w * 0.6 + lean * 0.5, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fillStyle = rgba(color, 0.95);
  ctx.fill();
  ctx.fillStyle = rgba('#e8dcc4', 0.18);
  ctx.fillRect(x - w * 0.7, y - h * 0.9, w * 0.4, h * 0.85);
}

interface SeasonLook {
  maple: string[];
  cherry: string[] | null;
  azalea: string[];
  bloom: boolean;
  bare: boolean;
}

function seasonLook(s: SeasonState): SeasonLook {
  const autumn = s.season === 'autumn' || s.autumn > 0.4;
  const winter = s.season === 'winter';
  return {
    maple: winter
      ? ['#6b4a3a', '#8a5a44']
      : autumn
        ? ['#9a2f1f', '#d9532b', '#e8813a', '#c23a24']
        : ['#3f6a2e', '#5f8f3d', '#7aa84c', '#4d7a34'],
    cherry:
      s.season === 'spring' && s.blossom > 0.2
        ? ['#d98aa4', '#f7b8cb', '#fbd3df', '#f3a3bb']
        : winter
          ? null
          : autumn
            ? ['#b5652e', '#d98c3a', '#e7a94c']
            : ['#4c7a36', '#6a9a45', '#86b057'],
    azalea: autumn ? ['#7a3a22', '#b8542a', '#d9783a'] : ['#3d6a33', '#58884a', '#6e9c52'],
    bloom: s.season === 'spring' || (s.season === 'summer' && s.blossom > 0.1),
    bare: winter,
  };
}

/** Peint un décor pour la saison donnée. */
export function paintDecor(id: DecorId, season: SeasonState, snow: number): DecorArt {
  const { canvas: c, width, height, light } = paintDecorCanvas(id, season, snow);
  const texture = Texture.from(c);
  texture.source.style.scaleMode = 'linear';
  return { texture, width, height, ...(light ? { light } : {}) };
}

/** Même dessin, en canevas (vignettes de la boutique). */
export function paintDecorCanvas(
  id: DecorId,
  season: SeasonState,
  snow: number,
): { canvas: HTMLCanvasElement; width: number; height: number; light?: { x: number; y: number } } {
  const rng = mulberry32(id.length * 977 + id.charCodeAt(0));
  const look = seasonLook(season);
  const stone = '#a39d90';
  let w = 70;
  let h = 70;
  let light: DecorArt['light'];
  const draw: (ctx: Ctx) => void = (() => {
    switch (id) {
      case 'moss-stone':
        w = 64;
        h = 36;
        return (ctx) => {
          footShadow(ctx, w / 2, h - 4, 28, rng);
          wash(ctx, w / 2, h - 13, 26, 13, '#8e897d', 0.97, rng, 0.7);
          wash(ctx, w / 2 - 6, h - 18, 16, 7, '#cfc8b6', 0.3, rng, 0);
          wash(ctx, w / 2 + 3, h - 20, 20, 8, '#5f8a3c', 0.85, rng, 0.5);
          wash(ctx, w / 2 - 4, h - 22, 10, 4, '#8fb35a', 0.7, rng, 0);
        };
      case 'rock':
        w = 76;
        h = 64;
        return (ctx) => {
          footShadow(ctx, w / 2, h - 5, 32, rng);
          wash(ctx, w / 2, h - 26, 30, 24, '#8d887d', 0.97, rng, 0.7);
          wash(ctx, w / 2 - 8, h - 36, 18, 12, '#d6cfbd', 0.35, rng, 0);
          wash(ctx, w / 2 + 10, h - 18, 16, 9, '#4d4a44', 0.25, rng, 0);
          wash(ctx, w / 2 + 2, h - 44, 14, 5, '#648c3f', 0.8, rng, 0.4);
        };
      case 'fern':
        w = 90;
        h = 70;
        return (ctx) => {
          footShadow(ctx, w / 2, h - 6, 30, rng);
          for (let f = 0; f < 9; f++) {
            const a = -Math.PI / 2 + (f / 8 - 0.5) * 2.6;
            const len = 30 + rng() * 12;
            let px = w / 2;
            let py = h - 8;
            for (let k = 1; k <= 7; k++) {
              const t = k / 7;
              const ang = a + t * 0.35 * Math.sign(Math.cos(a));
              const nx = w / 2 + Math.cos(ang) * len * t;
              const ny = h - 8 + Math.sin(ang) * len * t * 0.8;
              ctx.strokeStyle = rgba('#355f2a', 0.8);
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(nx, ny);
              ctx.stroke();
              const l = 7 * (1 - t * 0.6);
              wash(
                ctx,
                nx + Math.cos(ang + 1.3) * l * 0.5,
                ny + Math.sin(ang + 1.3) * l * 0.5,
                l * 0.55,
                l * 0.22,
                '#5c8f3e',
                0.8,
                rng,
                0.3,
              );
              wash(
                ctx,
                nx + Math.cos(ang - 1.3) * l * 0.5,
                ny + Math.sin(ang - 1.3) * l * 0.5,
                l * 0.55,
                l * 0.22,
                '#7aab4d',
                0.75,
                rng,
                0.3,
              );
              px = nx;
              py = ny;
            }
          }
        };
      case 'iris':
        w = 60;
        h = 92;
        return (ctx) => {
          footShadow(ctx, w / 2, h - 5, 20, rng);
          for (let b = 0; b < 11; b++) {
            const x0 = w / 2 + (rng() - 0.5) * 16;
            const a = -Math.PI / 2 + (rng() - 0.5) * 0.7;
            const len = 40 + rng() * 34;
            ctx.beginPath();
            ctx.moveTo(x0 - 2, h - 6);
            ctx.quadraticCurveTo(
              x0 + Math.cos(a) * len * 0.5 - 1,
              h - 6 + Math.sin(a) * len * 0.5,
              x0 + Math.cos(a) * len,
              h - 6 + Math.sin(a) * len,
            );
            ctx.quadraticCurveTo(
              x0 + Math.cos(a) * len * 0.5 + 2,
              h - 6 + Math.sin(a) * len * 0.5,
              x0 + 2,
              h - 6,
            );
            ctx.fillStyle = rgba(rng() < 0.5 ? '#3f6d33' : '#5b8c40', 0.85);
            ctx.fill();
          }
          if (look.bloom)
            for (let f = 0; f < 3; f++) {
              const fx = w / 2 + (f - 1) * 13 + (rng() - 0.5) * 4;
              const fy = 22 + rng() * 14;
              for (let p = 0; p < 3; p++) {
                const a = -Math.PI / 2 + (p - 1) * 1.1;
                wash(
                  ctx,
                  fx + Math.cos(a) * 5,
                  fy + Math.sin(a) * 4,
                  5,
                  3,
                  '#6a4fb3',
                  0.9,
                  rng,
                  0.5,
                );
              }
              wash(ctx, fx, fy + 3, 3.5, 2.5, '#8b73d6', 0.9, rng, 0);
              wash(ctx, fx, fy + 2, 1.2, 1.2, '#f2c94c', 0.95, rng, 0);
            }
        };
      case 'azalea':
        w = 96;
        h = 70;
        return (ctx) => {
          footShadow(ctx, w / 2, h - 6, 40, rng);
          leafMass(ctx, w / 2, h - 30, 36, look.azalea, rng, 12);
          if (look.bloom)
            for (let i = 0; i < 46; i++) {
              const a = rng() * Math.PI * 2;
              const d = Math.sqrt(rng()) * 30;
              wash(
                ctx,
                w / 2 + Math.cos(a) * d,
                h - 32 + Math.sin(a) * d * 0.72,
                3.4,
                2.8,
                rng() < 0.5 ? '#e05a8a' : '#f38fb2',
                0.9,
                rng,
                0.3,
              );
            }
        };
      case 'lantern':
        w = 64;
        h = 120;
        light = { x: 0, y: -66 };
        return (ctx) => {
          const cx = w / 2;
          const b = h - 6;
          footShadow(ctx, cx, b, 24, rng);
          stoneBlock(ctx, cx, b, 34, 10, stone, rng);
          stoneBlock(ctx, cx, b - 10, 12, 30, stone, rng);
          stoneBlock(ctx, cx, b - 40, 30, 8, stone, rng);
          // Chambre de lumière avec fenêtre
          stoneBlock(ctx, cx, b - 48, 24, 22, stone, rng);
          ctx.fillStyle = rgba('#3a2a1c', 0.85);
          ctx.fillRect(cx - 6, b - 66, 12, 13);
          ctx.fillStyle = rgba('#f2c26b', 0.35);
          ctx.fillRect(cx - 5, b - 65, 10, 11);
          roof(ctx, cx, b - 70, 46, 20, '#8f897c');
          wash(ctx, cx, b - 90, 4, 5, '#8f897c', 0.95, rng, 0.6);
        };
      case 'yukimi':
        w = 92;
        h = 90;
        light = { x: 0, y: -44 };
        return (ctx) => {
          const cx = w / 2;
          const b = h - 6;
          footShadow(ctx, cx, b, 36, rng);
          for (const dx of [-22, 0, 22]) {
            ctx.strokeStyle = rgba('#7f796d', 0.95);
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(cx + dx, b);
            ctx.quadraticCurveTo(cx + dx * 0.8, b - 16, cx + dx * 0.5, b - 30);
            ctx.stroke();
          }
          stoneBlock(ctx, cx, b - 30, 30, 20, stone, rng);
          ctx.fillStyle = rgba('#3a2a1c', 0.85);
          ctx.fillRect(cx - 7, b - 46, 14, 11);
          ctx.fillStyle = rgba('#f2c26b', 0.35);
          ctx.fillRect(cx - 6, b - 45, 12, 9);
          roof(ctx, cx, b - 50, 86, 26, '#8b8579');
          wash(ctx, cx, b - 76, 4, 5, '#8b8579', 0.95, rng, 0.6);
        };
      case 'shishi':
        w = 96;
        h = 76;
        return (ctx) => {
          const b = h - 8;
          footShadow(ctx, w / 2, b, 40, rng);
          // Bassin de pierre avec eau
          wash(ctx, w * 0.62, b - 8, 22, 10, '#8b867a', 0.97, rng, 0.7);
          wash(ctx, w * 0.62, b - 11, 15, 5, '#4f7f86', 0.9, rng, 0.3);
          wash(ctx, w * 0.6, b - 12, 7, 2, '#cfe6ea', 0.6, rng, 0);
          // Poteaux et bascule en bambou
          const bamboo = (x1: number, y1: number, x2: number, y2: number, wd: number) => {
            ctx.strokeStyle = rgba('#a59a4a', 0.95);
            ctx.lineWidth = wd;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.strokeStyle = rgba('#e8e0a0', 0.35);
            ctx.lineWidth = wd * 0.35;
            ctx.beginPath();
            ctx.moveTo(x1 - wd * 0.2, y1);
            ctx.lineTo(x2 - wd * 0.2, y2);
            ctx.stroke();
          };
          bamboo(w * 0.22, b, w * 0.22, b - 40, 5);
          bamboo(w * 0.36, b, w * 0.36, b - 40, 5);
          bamboo(w * 0.1, b - 50, w * 0.58, b - 26, 8);
          bamboo(w * 0.18, b - 58, w * 0.3, b - 62, 4);
        };
      case 'pagoda':
        w = 70;
        h = 130;
        return (ctx) => {
          const cx = w / 2;
          let y = h - 6;
          footShadow(ctx, cx, y, 26, rng);
          stoneBlock(ctx, cx, y, 30, 14, stone, rng);
          y -= 14;
          for (let tier = 0; tier < 3; tier++) {
            const tw = 50 - tier * 9;
            stoneBlock(ctx, cx, y, 16 - tier * 2, 14, stone, rng);
            roof(ctx, cx, y - 14, tw, 14, '#8a8478');
            y -= 26;
          }
          ctx.strokeStyle = rgba('#7a746a', 0.95);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, y + 4);
          ctx.lineTo(cx, y - 14);
          ctx.stroke();
          for (let r = 0; r < 4; r++) wash(ctx, cx, y - 2 - r * 4, 3, 1.4, '#7a746a', 0.95, rng, 0);
        };
      case 'maple':
      case 'pine':
      case 'cherry':
        w = 150;
        h = 170;
        return (ctx) => {
          const cx = w / 2;
          const b = h - 6;
          footShadow(ctx, cx, b, 50, rng);
          const bark = id === 'pine' ? '#5a4535' : id === 'cherry' ? '#4f3a33' : '#5b4032';
          trunk(ctx, cx, b, 70, 8, id === 'pine' ? 10 : -6, bark);
          const leaves =
            id === 'pine'
              ? ['#244a2e', '#35603a', '#4a7a45', '#2f5634']
              : id === 'maple'
                ? look.maple
                : look.cherry;
          if (!leaves || (look.bare && id !== 'pine')) {
            // Branches nues en hiver
            ctx.strokeStyle = rgba(bark, 0.9);
            ctx.lineCap = 'round';
            for (let i = 0; i < 9; i++) {
              const a = -Math.PI / 2 + (rng() - 0.5) * 2.2;
              const l = 28 + rng() * 34;
              ctx.lineWidth = 2 + rng() * 2;
              ctx.beginPath();
              ctx.moveTo(cx, b - 60);
              ctx.lineTo(cx + Math.cos(a) * l, b - 60 + Math.sin(a) * l * 0.8);
              ctx.stroke();
            }
            return;
          }
          if (id === 'pine') {
            // Plateaux étagés
            for (let tier = 0; tier < 4; tier++) {
              const ty = b - 60 - tier * 22;
              const tx = cx + (tier % 2 ? 14 : -12) + 10;
              leafMass(ctx, tx, ty, 34 - tier * 5, leaves, rng, 6);
            }
          } else {
            leafMass(ctx, cx - 6, b - 100, 56, leaves, rng, 18);
            leafMass(ctx, cx - 34, b - 82, 30, leaves, rng, 6);
            leafMass(ctx, cx + 30, b - 86, 32, leaves, rng, 6);
          }
        };
    }
  })();
  const [c, ctx] = canvas(w, h);
  draw(ctx);
  if (snow > 0.2) {
    // Neige posée sur le dessus
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba('#f5f7fb', 0.5 * snow);
    ctx.fillRect(0, 0, w, h * 0.35);
    ctx.globalCompositeOperation = 'source-over';
  }
  return { canvas: c, width: w, height: h, ...(light ? { light } : {}) };
}
