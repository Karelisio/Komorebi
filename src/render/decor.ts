import type { Graphics } from 'pixi.js';
import { CATALOG, type CatalogId } from '@/garden/catalog';
import { hexToRgb, mixRgb, rgbToHex, type RGB } from '@/world/math';
import { mulberry32, type Rng } from '@/world/random';
import type { SeasonState } from '@/world/season';

export interface DecorLook {
  /** Toutes les entrées de CATALOG sauf category 'tree' (gérés dans trees.ts). */
  kind: CatalogId;
  /** Aléa déterministe (mulberry32). */
  seed: number;
  /** 0 = jeune pousse, 1 = adulte (1 pour les objets inertes). */
  growth: number;
  /** Intensité de floraison 0..1. */
  bloom: number;
  season: SeasonState;
  /** Neige au sol 0..1. */
  snow: number;
  /** Soif 0..1 : ternit les couleurs végétales. */
  thirst: number;
  /** Miroir horizontal. */
  flip: boolean;
}

export interface DecorResult {
  /** Position locale de la flamme, pour les lanternes. */
  light?: { x: number; y: number; radius: number };
}

interface Palette {
  dark: RGB;
  mid: RGB;
  light: RGB;
}

const C = (h: string): RGB => hexToRgb(h);
const SHADOW = 0x1a261c;
const SNOW = C('#f2f5fb');
const GREY_THIRST = C('#8a8468');

/** Ternit une palette végétale selon la soif (jamais mort). */
function dull(p: Palette, thirst: number): Palette {
  const t = thirst * 0.35;
  return {
    dark: mixRgb(p.dark, GREY_THIRST, t),
    mid: mixRgb(p.mid, GREY_THIRST, t),
    light: mixRgb(p.light, GREY_THIRST, t),
  };
}

const hx = (c: RGB): number => rgbToHex(c);

/** Ombre portée douce au sol, sous l'emprise de l'objet. */
function drawShadow(g: Graphics, rx: number, ry: number, alpha = 0.25): void {
  g.ellipse(rx * 0.08, 0, rx, ry).fill({ color: SHADOW, alpha });
}

/** Petits chapeaux de neige déposés sur des points hauts (x, y, largeur). */
function snowCaps(g: Graphics, caps: { x: number; y: number; w: number }[], snow: number): void {
  if (snow <= 0.05) return;
  for (const c of caps) {
    g.ellipse(c.x, c.y, c.w, c.w * 0.42).fill({ color: hx(SNOW), alpha: snow * 0.9 });
  }
}

// ---------------------------------------------------------------------------
// Mousse
// ---------------------------------------------------------------------------

const MOSS: Palette = { dark: C('#2c4029'), mid: C('#4f7a3a'), light: C('#7fa95a') };
const MOSS_AUTUMN: Palette = { dark: C('#4a4326'), mid: C('#6b6236'), light: C('#8f8250') };

function drawMoss(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.moss.radius * (0.3 + 0.7 * look.growth);
  drawShadow(g, r * 1.05, r * 0.45, 0.18);
  const winterMix = look.season.season === 'winter' ? 0.45 : look.season.autumn * 0.4;
  const pal = dull(
    {
      dark: mixRgb(MOSS.dark, MOSS_AUTUMN.dark, winterMix),
      mid: mixRgb(MOSS.mid, MOSS_AUTUMN.mid, winterMix),
      light: mixRgb(MOSS.light, MOSS_AUTUMN.light, winterMix),
    },
    look.thirst,
  );
  // Amas de coussinets arrondis, texture de petits points.
  const n = 6 + Math.floor(rng() * 4);
  const caps: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * r * 0.7;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d * 0.45;
    const rr = r * (0.32 + rng() * 0.26);
    g.ellipse(x, y - rr * 0.15, rr, rr * 0.55).fill(hx(pal.dark));
    g.ellipse(x - rr * 0.1, y - rr * 0.28, rr * 0.8, rr * 0.42).fill(hx(pal.mid));
    g.ellipse(x - rr * 0.22, y - rr * 0.4, rr * 0.45, rr * 0.22).fill({
      color: hx(pal.light),
      alpha: 0.85,
    });
    caps.push({ x, y: y - rr * 0.4, w: rr * 0.55 });
    for (let k = 0; k < 5; k++) {
      const pa = rng() * Math.PI * 2;
      const pd = rng() * rr * 0.7;
      g.circle(x + Math.cos(pa) * pd, y - rr * 0.2 + Math.sin(pa) * pd * 0.5, 0.8).fill({
        color: hx(pal.light),
        alpha: 0.5,
      });
    }
  }
  snowCaps(g, caps, look.snow);
  return {};
}

// ---------------------------------------------------------------------------
// Fougère
// ---------------------------------------------------------------------------

const FERN: Palette = { dark: C('#2e5230'), mid: C('#4c7a44'), light: C('#7ba468') };
const FERN_WINTER: Palette = { dark: C('#5a4a30'), mid: C('#7a6640'), light: C('#93825a') };

function drawFern(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const h = CATALOG.fern.height * (0.22 + 0.78 * look.growth);
  const r = CATALOG.fern.radius * (0.3 + 0.7 * look.growth);
  drawShadow(g, r, r * 0.4, 0.2);
  const isWinter = look.season.season === 'winter';
  const pal = dull(isWinter ? mixRgb2(FERN, FERN_WINTER, 0.7) : FERN, look.thirst);
  const fronds = 5 + Math.floor(rng() * 4);
  const flipK = look.flip ? -1 : 1;
  const caps: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < fronds; i++) {
    const t = fronds === 1 ? 0.5 : i / (fronds - 1);
    const spread = (t - 0.5) * 2.4 * flipK;
    const len = h * (0.6 + rng() * 0.35) * (isWinter ? 0.7 : 1);
    const baseAngle = spread;
    const curve = 0.55 + rng() * 0.25;
    const tone = pal[i % 2 === 0 ? 'mid' : 'dark'];
    const color = hx(mixRgb(tone, pal.light, 0.15 + rng() * 0.2));
    // Tige arquée + folioles en épi.
    const steps = 10;
    let px = 0;
    let py = 0;
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const a = baseAngle * curve * u;
      const x = Math.sin(a) * len * u;
      const y = -Math.cos(a * 0.8) * len * u;
      if (s > 1 && u > 0.15) {
        const nx = -(y - py);
        const ny = x - px;
        const nl = Math.hypot(nx, ny) || 1;
        const foliole = len * 0.11 * (1 - u * 0.5);
        for (const side of [-1, 1]) {
          g.moveTo(px, py)
            .lineTo(x + (nx / nl) * foliole * side, y + (ny / nl) * foliole * side)
            .stroke({ width: 1.4, color, alpha: 0.95, cap: 'round' });
        }
      }
      px = x;
      py = y;
    }
    g.moveTo(0, 0)
      .lineTo(px, py)
      .stroke({ width: 1.8, color: hx(pal.dark), cap: 'round' });
    caps.push({ x: px, y: py, w: len * 0.06 });
  }
  snowCaps(g, caps, isWinter ? look.snow : 0);
  return {};
}

function mixRgb2(a: Palette, b: Palette, t: number): Palette {
  return {
    dark: mixRgb(a.dark, b.dark, t),
    mid: mixRgb(a.mid, b.mid, t),
    light: mixRgb(a.light, b.light, t),
  };
}

// ---------------------------------------------------------------------------
// Buissons génériques (azalée, hortensia, camélia, chrysanthème)
// ---------------------------------------------------------------------------

interface BushSpec {
  leaf: Palette;
  flowerDark: string;
  flowerLight: string;
  flowerShape: 'petal' | 'pompom' | 'cluster';
  leafSize: 'small' | 'large';
  glossy?: boolean;
}

function drawBush(
  g: Graphics,
  look: DecorLook,
  rng: Rng,
  spec: BushSpec,
  catalog: CatalogId,
): DecorResult {
  const entry = CATALOG[catalog];
  const r = entry.radius * (0.3 + 0.7 * look.growth);
  const h = entry.height * (0.3 + 0.7 * look.growth);
  drawShadow(g, r * 1.02, r * 0.4, 0.22);
  const winter = look.season.season === 'winter';
  const pal = dull(spec.leaf, look.thirst);
  const dark = hx(pal.dark);
  const mid = hx(pal.mid);
  const light = hx(pal.light);

  // Masse générale (mottes superposées) formant un dôme irrégulier.
  const mounds = 4 + Math.floor(rng() * 3);
  const centers: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < mounds; i++) {
    const a = (i / mounds) * Math.PI * 2 + rng() * 0.5;
    const d = r * 0.35 * rng();
    const mr = r * (0.55 + rng() * 0.35);
    centers.push({ x: Math.cos(a) * d, y: -h * 0.55 + Math.sin(a) * d * 0.4 - mr * 0.1, r: mr });
  }
  for (const c of centers) g.ellipse(c.x + 2, c.y + c.r * 0.25, c.r, c.r * 0.75).fill(dark);
  // Touches de feuillage, plus claires vers le haut-gauche (lumière).
  const dabCount = spec.leafSize === 'large' ? 26 : 38;
  const dabs: { x: number; y: number; r: number; k: number }[] = [];
  for (const c of centers) {
    const n = Math.round((dabCount / mounds) * (0.7 + rng() * 0.6));
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * c.r * 0.9;
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d * 0.8;
      const lightK = 0.5 - (x - c.x) / (c.r * 2.2) - (y - c.y) / (c.r * 2.2) + (rng() - 0.5) * 0.3;
      dabs.push({
        x,
        y,
        r: c.r * (spec.leafSize === 'large' ? 0.22 + rng() * 0.14 : 0.13 + rng() * 0.09),
        k: lightK,
      });
    }
  }
  dabs.sort((a, b) => a.k - b.k);
  for (const d of dabs) {
    const k = Math.max(0, Math.min(1, d.k));
    const col =
      k < 0.5 ? mixRgb(pal.dark, pal.mid, k * 2) : mixRgb(pal.mid, pal.light, (k - 0.5) * 2);
    g.ellipse(d.x, d.y, d.r, d.r * 0.8).fill(hx(col));
    if (spec.glossy && rng() < 0.3) {
      g.ellipse(d.x - d.r * 0.25, d.y - d.r * 0.3, d.r * 0.35, d.r * 0.18).fill({
        color: light,
        alpha: 0.6,
      });
    }
  }
  void mid;

  // Fleurs
  if (look.bloom > 0.05 && !winter) {
    const fDark = hexToRgb(spec.flowerDark);
    const fLight = hexToRgb(spec.flowerLight);
    const count = Math.round(
      (spec.flowerShape === 'pompom' ? 5 : 9) +
        look.bloom * (spec.flowerShape === 'pompom' ? 10 : 20),
    );
    for (let i = 0; i < count; i++) {
      const c = centers[Math.floor(rng() * centers.length)]!;
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * c.r * 0.95;
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d * 0.8 - c.r * 0.15;
      const fr = (2.2 + rng() * 1.6) * (0.6 + look.bloom * 0.6);
      const tone = mixRgb(fDark, fLight, 0.3 + rng() * 0.6);
      if (spec.flowerShape === 'pompom') {
        g.circle(x, y, fr).fill(hx(mixRgb(fDark, [0, 0, 0], 0.15)));
        for (let p = 0; p < 6; p++) {
          const pa = (p / 6) * Math.PI * 2 + rng() * 0.3;
          g.ellipse(
            x + Math.cos(pa) * fr * 0.6,
            y + Math.sin(pa) * fr * 0.6 * 0.8,
            fr * 0.55,
            fr * 0.32,
          ).fill(hx(tone));
        }
        g.circle(x, y, fr * 0.35).fill(hx(fLight));
      } else if (spec.flowerShape === 'petal') {
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          g.ellipse(
            x + Math.cos(pa) * fr * 0.55,
            y + Math.sin(pa) * fr * 0.55 * 0.75,
            fr * 0.5,
            fr * 0.32,
          ).fill(hx(tone));
        }
        g.circle(x, y, fr * 0.28).fill(hx(mixRgb(fLight, [1, 1, 0.6], 0.4)));
      } else {
        // cluster (hortensia) : petite boule de 4 pétales
        g.circle(x, y, fr * 0.9).fill(hx(mixRgb(fDark, fLight, 0.4)));
        for (let p = 0; p < 4; p++) {
          const pa = (p / 4) * Math.PI * 2 + rng() * 0.4;
          g.ellipse(
            x + Math.cos(pa) * fr * 0.42,
            y + Math.sin(pa) * fr * 0.42 * 0.8,
            fr * 0.4,
            fr * 0.28,
          ).fill(hx(tone));
        }
      }
    }
  }

  if (winter && look.snow > 0.05) {
    const caps = centers.map((c) => ({ x: c.x - c.r * 0.1, y: c.y - c.r * 0.55, w: c.r * 0.6 }));
    snowCaps(g, caps, look.snow);
  }
  return {};
}

// ---------------------------------------------------------------------------
// Iris (feuilles en épée + fleurs sur tige)
// ---------------------------------------------------------------------------

const IRIS_LEAF: Palette = { dark: C('#33603a'), mid: C('#4f8a52'), light: C('#83b877') };

function drawIris(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const h = CATALOG.iris.height * (0.25 + 0.75 * look.growth);
  const r = CATALOG.iris.radius * (0.35 + 0.65 * look.growth);
  drawShadow(g, r, r * 0.4, 0.2);
  const pal = dull(IRIS_LEAF, look.thirst);
  const winter = look.season.season === 'winter';
  const nLeaves = 7 + Math.floor(rng() * 4);
  const flipK = look.flip ? -1 : 1;
  for (let i = 0; i < nLeaves; i++) {
    const t = (i / nLeaves - 0.5) * flipK;
    const lean = t * 0.55 + (rng() - 0.5) * 0.15;
    const len = h * (0.75 + rng() * 0.3) * (winter ? 0.55 : 1);
    const bx = t * r * 0.7;
    const tipX = bx + Math.sin(lean) * len;
    const tipY = -Math.cos(lean) * len;
    const midX = bx + Math.sin(lean) * len * 0.55 + (rng() - 0.5) * 4;
    const midY = -Math.cos(lean) * len * 0.55;
    const w = 2.4 + rng() * 0.8;
    const color = hx(i % 2 === 0 ? pal.mid : pal.dark);
    g.moveTo(bx, 0)
      .quadraticCurveTo(midX, midY, tipX, tipY)
      .stroke({ width: w, color, cap: 'round' });
    g.moveTo(bx, 0)
      .quadraticCurveTo(midX - w * 0.5, midY, tipX - w * 0.6, tipY + w)
      .stroke({ width: w * 0.5, color: hx(pal.light), alpha: 0.6, cap: 'round' });
  }
  if (look.bloom > 0.05 && !winter) {
    const purple = hexToRgb('#6a5acd');
    const purpleLight = hexToRgb('#a99be0');
    const nFlowers = 1 + Math.round(look.bloom * 3);
    for (let i = 0; i < nFlowers; i++) {
      const t = (rng() - 0.5) * flipK;
      const stemLen = h * (0.9 + rng() * 0.15);
      const bx = t * r * 0.4;
      const x = bx + Math.sin(t * 0.4) * stemLen * 0.2;
      const y = -stemLen;
      g.moveTo(bx, 0)
        .lineTo(x, y)
        .stroke({ width: 1.8, color: hx(pal.dark), cap: 'round' });
      const fr = (5 + rng() * 2) * (0.6 + look.bloom * 0.5);
      // 3 pétales tombants + 3 dressés, stylisés.
      for (let p = 0; p < 3; p++) {
        const pa = -Math.PI / 2 + (p - 1) * 0.75;
        g.ellipse(
          x + Math.cos(pa) * fr * 0.7,
          y + Math.sin(pa) * fr * 0.9 + fr * 0.5,
          fr * 0.5,
          fr * 0.85,
        ).fill(hx(mixRgb(purple, purpleLight, 0.2 + rng() * 0.3)));
      }
      for (let p = 0; p < 3; p++) {
        const pa = -Math.PI / 2 + (p - 1) * 0.4;
        g.ellipse(
          x + Math.cos(pa) * fr * 0.3,
          y - fr * 0.3 + Math.sin(pa) * fr * 0.3,
          fr * 0.3,
          fr * 0.55,
        ).fill({
          color: hx(purpleLight),
          alpha: 0.9,
        });
      }
      g.circle(x, y, fr * 0.18).fill(hx(hexToRgb('#f0c24a')));
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Pierres
// ---------------------------------------------------------------------------

const STONE_GREY: Palette = { dark: C('#575850'), mid: C('#8a8a7e'), light: C('#c2c1b2') };

function drawStone(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.stone.radius;
  drawShadow(g, r * 1.05, r * 0.4);
  const pal = STONE_GREY;
  const ry = r * 0.72;
  g.ellipse(0, -ry * 0.55, r, ry).fill(hx(pal.dark));
  g.ellipse(-r * 0.08, -ry * 0.65, r * 0.86, ry * 0.85).fill(hx(pal.mid));
  g.ellipse(-r * 0.25, -ry * 0.85, r * 0.45, ry * 0.4).fill({ color: hx(pal.light), alpha: 0.85 });
  // Mousse sur le dessus
  if (rng() < 0.85) {
    const moss = C('#4f7a3a');
    g.ellipse(r * 0.1, -ry * 1.02, r * 0.4, ry * 0.22).fill({ color: hx(moss), alpha: 0.75 });
  }
  snowCaps(g, [{ x: -r * 0.05, y: -ry * 0.95, w: r * 0.55 }], look.snow);
  return {};
}

function drawRock(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.rock.radius;
  const h = CATALOG.rock.height;
  drawShadow(g, r * 1.1, r * 0.42);
  const pal = STONE_GREY;
  const nFacets = 6 + Math.floor(rng() * 3);
  const top: { x: number; y: number }[] = [];
  for (let i = 0; i < nFacets; i++) {
    const a = (i / nFacets) * Math.PI * 2;
    const rr = r * (0.75 + rng() * 0.3);
    top.push({ x: Math.cos(a) * rr, y: -h * (0.55 + rng() * 0.15) + Math.sin(a) * rr * 0.3 });
  }
  const base: { x: number; y: number }[] = top.map((p) => ({ x: p.x * 1.08, y: 0 }));
  // Masse d'ombre globale
  const flat: number[] = [];
  base.forEach((p) => flat.push(p.x, p.y));
  g.poly(flat).fill(hx(pal.dark));
  // Facettes individuelles, ombrées selon l'orientation (lumière haut-gauche)
  for (let i = 0; i < nFacets; i++) {
    const a = top[i]!;
    const b = top[(i + 1) % nFacets]!;
    const ba = base[i]!;
    const bb = base[(i + 1) % nFacets]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = mx;
    const ny = my + h * 0.3;
    const nl = Math.hypot(nx, ny) || 1;
    const facing = -nx / nl - (ny / nl) * 0.3;
    const k = Math.max(0, Math.min(1, 0.5 + facing * 0.6));
    const col =
      k < 0.5 ? mixRgb(pal.dark, pal.mid, k * 2) : mixRgb(pal.mid, pal.light, (k - 0.5) * 2);
    g.poly([a.x, a.y, b.x, b.y, bb.x, bb.y, ba.x, ba.y]).fill(hx(col));
  }
  const topFlat: number[] = [];
  top.forEach((p) => topFlat.push(p.x, p.y));
  g.poly(topFlat).fill(hx(mixRgb(pal.mid, pal.light, 0.4)));
  if (rng() < 0.7) {
    const moss = C('#4f7a3a');
    g.ellipse(-r * 0.1, -h * 0.5, r * 0.3, r * 0.14).fill({ color: hx(moss), alpha: 0.6 });
  }
  const capTop = top.reduce((acc, p) => (p.y < acc.y ? p : acc), top[0]!);
  snowCaps(g, [{ x: capTop.x, y: capTop.y, w: r * 0.4 }], look.snow);
  return {};
}

function drawStepping(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.stepping.radius;
  drawShadow(g, r * 1.02, r * 0.55, 0.2);
  const pal = STONE_GREY;
  const rot = (rng() - 0.5) * 0.4;
  const rx = r * (0.95 + rng() * 0.1);
  const ry = rx * 0.62;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pts: number[] = [];
  const edges = 9;
  for (let i = 0; i < edges; i++) {
    const a = (i / edges) * Math.PI * 2;
    const jr = 0.88 + rng() * 0.14;
    const ex = Math.cos(a) * rx * jr;
    const ey = Math.sin(a) * ry * jr;
    pts.push(ex * c - ey * s, ex * s + ey * c);
  }
  g.poly(pts).fill(hx(pal.mid));
  const inner: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    inner.push(pts[i]! * 0.8, pts[i + 1]! * 0.8 - 1);
  }
  g.poly(inner).fill({ color: hx(pal.light), alpha: 0.55 });
  snowCaps(g, [{ x: 0, y: -1, w: rx * 0.7 }], look.snow);
  return {};
}

// ---------------------------------------------------------------------------
// Lanternes
// ---------------------------------------------------------------------------

const STONE_LANTERN: Palette = { dark: C('#4d5450'), mid: C('#7d857c'), light: C('#b3b8ac') };

function drawLantern(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const h = CATALOG.lantern.height;
  const w = CATALOG.lantern.radius;
  drawShadow(g, w * 1.1, w * 0.45);
  const pal = STONE_LANTERN;
  const dark = hx(pal.dark);
  const mid = hx(pal.mid);
  const light = hx(pal.light);

  // Socle
  g.ellipse(0, -2, w * 0.55, w * 0.22).fill(dark);
  g.roundRect(-w * 0.42, -h * 0.14, w * 0.84, h * 0.14, 3).fill(mid);
  g.roundRect(-w * 0.42, -h * 0.14, w * 0.84, h * 0.03, 3).fill(light);
  // Pilier
  const pw = w * 0.24;
  g.rect(-pw / 2, -h * 0.5, pw, h * 0.38).fill(mid);
  g.rect(-pw / 2, -h * 0.5, pw * 0.4, h * 0.38).fill(light);
  g.rect(-pw / 2 - 2, -h * 0.5, pw + 4, h * 0.035).fill(dark);
  // Chambre à feu (hidoro), socle de la chambre
  const cw = w * 0.62;
  const cyTop = -h * 0.72;
  const cyBot = -h * 0.5;
  g.roundRect(-cw / 2, cyTop, cw, cyBot - cyTop, 3).fill(mid);
  // Ouverture (fenêtre sombre)
  const ow = cw * 0.4;
  const oh = (cyBot - cyTop) * 0.55;
  g.roundRect(-ow / 2, cyTop + (cyBot - cyTop) * 0.2, ow, oh, 2).fill(0x1c1a14);
  g.roundRect(-cw / 2, cyTop, cw * 0.35, cyBot - cyTop, 3).fill(light);
  // Toit courbé, coins relevés
  const rw = w * 0.95;
  const ry = -h * 0.78;
  const lift = h * 0.06;
  g.poly([
    -rw / 2,
    ry + lift,
    -rw * 0.3,
    ry - h * 0.05,
    0,
    ry - h * 0.08,
    rw * 0.3,
    ry - h * 0.05,
    rw / 2,
    ry + lift,
    0,
    ry + h * 0.02,
  ]).fill(dark);
  g.poly([
    -rw / 2,
    ry + lift,
    0,
    ry + h * 0.02,
    rw * 0.05,
    ry - h * 0.02,
    -rw * 0.3,
    ry - h * 0.05,
  ]).fill(mid);
  g.poly([
    -rw * 0.05,
    ry - h * 0.04,
    0,
    ry + h * 0.02,
    rw * 0.3,
    ry - h * 0.05,
    rw * 0.1,
    ry - h * 0.07,
  ]).fill({
    color: light,
    alpha: 0.6,
  });
  // Joyau (hōju) au sommet
  g.circle(0, ry - h * 0.1, w * 0.1).fill(mid);
  g.ellipse(0, ry - h * 0.19, w * 0.07, w * 0.13).fill(dark);
  g.circle(-w * 0.02, ry - h * 0.2, w * 0.03).fill({ color: light, alpha: 0.8 });

  snowCaps(
    g,
    [
      { x: 0, y: ry - h * 0.06, w: rw * 0.35 },
      { x: 0, y: -h * 0.14, w: w * 0.35 },
    ],
    look.snow,
  );
  void rng;
  return { light: { x: 0, y: (cyTop + cyBot) / 2, radius: cw * 0.35 } };
}

function drawLanternYukimi(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const h = CATALOG['lantern-yukimi'].height;
  const w = CATALOG['lantern-yukimi'].radius;
  drawShadow(g, w * 1.3, w * 0.5);
  const pal = STONE_LANTERN;
  const dark = hx(pal.dark);
  const mid = hx(pal.mid);
  const light = hx(pal.light);
  // 3 pieds courbes
  for (const t of [-1, 0, 1]) {
    const bx = t * w * 0.55;
    g.moveTo(bx * 1.15, 0)
      .quadraticCurveTo(bx * 0.7, -h * 0.28, 0, -h * 0.4)
      .stroke({ width: w * 0.16, color: t === -1 ? mid : dark, cap: 'round' });
  }
  // Chambre à feu centrale
  const cw = w * 0.7;
  g.roundRect(-cw / 2, -h * 0.62, cw, h * 0.24, 4).fill(mid);
  const ow = cw * 0.42;
  g.roundRect(-ow / 2, -h * 0.56, ow, h * 0.14, 2).fill(0x1c1a14);
  g.roundRect(-cw / 2, -h * 0.62, cw * 0.3, h * 0.24, 4).fill(light);
  // Grand toit en parapluie
  const rw = w * 1.9;
  const ry = -h * 0.66;
  // Silhouette simplifiée en éventail (dessus incliné, ombré à droite)
  g.moveTo(-rw / 2, ry + w * 0.28)
    .quadraticCurveTo(-rw * 0.2, ry - w * 0.22, 0, ry - w * 0.3)
    .quadraticCurveTo(rw * 0.2, ry - w * 0.22, rw / 2, ry + w * 0.28)
    .quadraticCurveTo(0, ry + w * 0.5, -rw / 2, ry + w * 0.28)
    .closePath()
    .fill(dark);
  g.moveTo(-rw / 2, ry + w * 0.24)
    .quadraticCurveTo(-rw * 0.2, ry - w * 0.24, 0, ry - w * 0.32)
    .quadraticCurveTo(-rw * 0.05, ry - w * 0.05, -rw * 0.42, ry + w * 0.12)
    .closePath()
    .fill({ color: light, alpha: 0.75 });
  g.ellipse(0, ry - w * 0.28, w * 0.09, w * 0.1).fill(dark);
  snowCaps(g, [{ x: -w * 0.05, y: ry - w * 0.05, w: rw * 0.32 }], look.snow);
  void rng;
  return { light: { x: 0, y: -h * 0.5, radius: cw * 0.35 } };
}

// ---------------------------------------------------------------------------
// Pont
// ---------------------------------------------------------------------------

function drawBridge(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const len = CATALOG.bridge.radius * 2;
  const vermillon = rng() < 0.5;
  const wood = vermillon
    ? { dark: C('#7a2318'), mid: C('#c14430'), light: C('#e2735a') }
    : { dark: C('#4a3826'), mid: C('#8a6a45'), light: C('#b89468') };
  const dark = hx(wood.dark);
  const mid = hx(wood.mid);
  const light = hx(wood.light);
  const half = len / 2;
  const archH = CATALOG.bridge.height * 0.6;
  const deckT = 7;
  const railH = 15;
  drawShadow(g, half * 1.02, 15, 0.22);

  // Courbe du tablier : 0 aux deux extrémités (rive), point haut au centre.
  const arcY = (x: number): number => -archH * (1 - (x / half) * (x / half));
  const segs = 16;
  const xs: number[] = [];
  for (let i = 0; i <= segs; i++) xs.push(-half + (i / segs) * len);

  // Piliers près des rives, courts (le tablier touche presque le sol à ses extrémités).
  for (const side of [-1, 1] as const) {
    const px = side * half * 0.78;
    const topY = arcY(px) + deckT;
    g.rect(px - 4, topY, 8, -topY).fill(dark);
  }

  // Tablier : ruban suivant l'arc (face + tranche).
  const topPts: number[] = [];
  const botPts: number[] = [];
  for (const x of xs) {
    topPts.push(x, arcY(x));
    botPts.push(x, arcY(x) + deckT);
  }
  const deckPoly: number[] = [...topPts];
  for (let i = botPts.length - 2; i >= 0; i -= 2) deckPoly.push(botPts[i]!, botPts[i + 1]!);
  g.poly(deckPoly).fill(mid);
  // Liseré clair sur l'arête supérieure (lumière haut-gauche), ombre sous la tranche.
  g.moveTo(xs[0]!, arcY(xs[0]!));
  for (const x of xs) g.lineTo(x, arcY(x));
  g.stroke({ width: 1.6, color: light, alpha: 0.8, cap: 'round' });
  g.moveTo(xs[0]!, arcY(xs[0]!) + deckT);
  for (const x of xs) g.lineTo(x, arcY(x) + deckT);
  g.stroke({ width: 1.4, color: dark, alpha: 0.6, cap: 'round' });
  // Planches (traits verticaux espacés)
  for (let i = 1; i < segs; i += 2) {
    const x = xs[i]!;
    g.moveTo(x, arcY(x))
      .lineTo(x, arcY(x) + deckT)
      .stroke({ width: 1, color: dark, alpha: 0.35 });
  }

  // Rambardes : main-courante + poteaux, deux côtés légèrement décalés (vue de biais).
  for (const side of [1, -1] as const) {
    const dy = side === 1 ? 0 : -3.5;
    const railColor = side === 1 ? mid : dark;
    g.moveTo(xs[0]!, arcY(xs[0]!) - railH + dy);
    for (const x of xs) g.lineTo(x, arcY(x) - railH + dy);
    g.stroke({ width: 2.4, color: railColor, cap: 'round' });
    for (let i = 0; i <= segs; i += 3) {
      const x = xs[i]!;
      g.moveTo(x, arcY(x))
        .lineTo(x, arcY(x) - railH + dy)
        .stroke({
          width: 1.6,
          color: light,
          alpha: 0.85,
        });
    }
  }
  snowCaps(g, [{ x: 0, y: arcY(0) - railH, w: half * 0.35 }], look.snow);
  return {};
}

// ---------------------------------------------------------------------------
// Ruisseau
// ---------------------------------------------------------------------------

function drawStream(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const len = CATALOG.stream.radius * 2.3;
  const w = 15; // largeur du filet d'eau (le lit et les berges s'ajoutent autour)
  const half = len / 2;
  const amp = w * 1.5;
  // Trajectoire sinueuse (un peu plus d'un cycle sur la longueur, sans auto-intersection).
  const pts: { x: number; y: number }[] = [];
  const segs = 20;
  const phase = (look.seed % 1000) * 0.01;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -half + t * len;
    const y = Math.sin(t * Math.PI * 1.15 + phase) * amp;
    pts.push({ x, y });
  }
  const bankPts: number[] = [];
  pts.forEach((p) => bankPts.push(p.x, p.y));
  drawShadow(g, half, w * 1.6, 0.1);
  // Berges de mousse puis lit de galets.
  const moss = C('#3b5634');
  g.poly(bankPts).stroke({
    width: w * 2.1,
    color: hx(moss),
    alpha: 0.9,
    join: 'round',
    cap: 'round',
  });
  g.poly(bankPts).stroke({
    width: w * 1.5,
    color: 0x6b6559,
    alpha: 0.9,
    join: 'round',
    cap: 'round',
  });
  // Eau : lit sombre, corps moyen, reflets clairs.
  const waterDark = hx(C('#2c5654'));
  const waterMid = hx(C('#4a8a80'));
  const waterLight = hx(C('#bfe8dc'));
  g.poly(bankPts).stroke({ width: w * 1.15, color: waterDark, join: 'round', cap: 'round' });
  g.poly(bankPts).stroke({ width: w * 0.8, color: waterMid, join: 'round', cap: 'round' });
  for (let i = 1; i < pts.length - 1; i += 2) {
    const p = pts[i]!;
    g.ellipse(p.x - w * 0.1, p.y - w * 0.12, w * 0.32, w * 0.1).fill({
      color: waterLight,
      alpha: 0.7,
    });
  }
  // Galets épars visibles sur les berges et dans le lit.
  for (let i = 0; i < 16; i++) {
    const p = pts[Math.floor(rng() * pts.length)]!;
    const ox = (rng() - 0.5) * w * 1.7;
    const oy = (rng() - 0.5) * w * 0.5;
    const r = 1.4 + rng() * 2.2;
    g.ellipse(p.x + ox, p.y + oy, r, r * 0.68).fill({ color: 0x8f887a, alpha: 0.85 });
  }
  return {};
}

// ---------------------------------------------------------------------------
// Tsukubai
// ---------------------------------------------------------------------------

function drawTsukubai(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.tsukubai.radius;
  const h = CATALOG.tsukubai.height;
  drawShadow(g, r * 1.15, r * 0.5);
  const pal = STONE_LANTERN;
  // Bassin de pierre
  g.ellipse(0, -h * 0.32, r * 0.95, r * 0.55).fill(hx(pal.dark));
  g.ellipse(0, -h * 0.38, r * 0.85, r * 0.48).fill(hx(pal.mid));
  g.ellipse(0, -h * 0.4, r * 0.6, r * 0.3).fill(0x1e2c30);
  g.ellipse(-r * 0.15, -h * 0.44, r * 0.28, r * 0.13).fill({ color: hx(pal.light), alpha: 0.5 });
  // Pied
  g.rect(-r * 0.22, -h * 0.32, r * 0.44, h * 0.32).fill(hx(pal.mid));
  g.rect(-r * 0.22, -h * 0.32, r * 0.14, h * 0.32).fill(hx(pal.light));
  // Kakei (gouttière de bambou) s'avançant au-dessus
  const bamboo = C('#8a9a4c');
  const bx = -r * 0.1;
  g.moveTo(-r * 1.3, -h * 0.95)
    .lineTo(bx, -h * 0.62)
    .stroke({ width: 5, color: hx(bamboo), cap: 'round' });
  g.rect(-r * 1.35, -h * 0.98, 6, 6).fill(hx(mixRgb(bamboo, [0, 0, 0], 0.3)));
  // Support du kakei
  g.moveTo(bx, -h * 0.62)
    .lineTo(bx, -h * 0.42)
    .stroke({ width: 3, color: hx(pal.dark) });
  // Louche en bambou posée sur le bord
  const lx = r * 0.35;
  const ly = -h * 0.4;
  g.moveTo(lx, ly)
    .lineTo(lx + r * 0.35, ly - h * 0.06)
    .stroke({ width: 3, color: hx(bamboo), cap: 'round' });
  g.ellipse(lx - r * 0.05, ly + 1, r * 0.16, r * 0.09).fill(hx(mixRgb(bamboo, [0, 0, 0], 0.2)));
  void rng;
  snowCaps(g, [{ x: 0, y: -h * 0.42, w: r * 0.4 }], look.snow * 0.5);
  return {};
}

// ---------------------------------------------------------------------------
// Banc
// ---------------------------------------------------------------------------

function drawBench(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const r = CATALOG.bench.radius;
  const h = CATALOG.bench.height;
  drawShadow(g, r * 1.05, r * 0.35, 0.22);
  const wood = { dark: C('#5a4530'), mid: C('#8a6a45'), light: C('#b89468') };
  const dark = hx(wood.dark);
  const mid = hx(wood.mid);
  const light = hx(wood.light);
  const w = r * 1.9;
  const seatY = -h * 0.62;
  // Pieds
  for (const px of [-w * 0.42, w * 0.42]) {
    g.rect(px - 3, seatY, 6, h * 0.62).fill(dark);
    g.rect(px - 3, seatY, 2.4, h * 0.62).fill(mid);
  }
  // Lattes de l'assise
  const slats = 4;
  for (let i = 0; i < slats; i++) {
    const y = seatY - i * 3.2;
    g.roundRect(-w / 2, y - 2.6, w, 3, 1.4).fill(mid);
    g.roundRect(-w / 2, y - 2.6, w, 1.1, 1.4).fill(light);
  }
  void rng;
  snowCaps(g, [{ x: 0, y: seatY - slats * 3.2, w: w * 0.42 }], look.snow);
  return {};
}

// ---------------------------------------------------------------------------
// Pagode
// ---------------------------------------------------------------------------

function drawPagoda(g: Graphics, look: DecorLook, rng: Rng): DecorResult {
  const h = CATALOG.pagoda.height;
  const w = CATALOG.pagoda.radius;
  drawShadow(g, w * 1.05, w * 0.4);
  const pal = STONE_LANTERN;
  const dark = hx(pal.dark);
  const mid = hx(pal.mid);
  const light = hx(pal.light);
  const levels = 5;
  g.ellipse(0, -2, w * 0.5, w * 0.2).fill(dark);
  let y = -h * 0.1;
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const bodyW = w * (0.7 - t * 0.42);
    const bodyH = h * 0.1;
    const roofW = w * (0.95 - t * 0.5);
    const lift = h * 0.028;
    // Corps
    g.rect(-bodyW / 2, y - bodyH, bodyW, bodyH).fill(mid);
    g.rect(-bodyW / 2, y - bodyH, bodyW * 0.35, bodyH).fill(light);
    if (l === levels - 1) {
      g.roundRect(-bodyW * 0.28, y - bodyH * 0.7, bodyW * 0.56, bodyH * 0.5, 2).fill(0x1c1a14);
    }
    y -= bodyH;
    // Toit
    const ry = y - h * 0.02;
    g.poly([
      -roofW / 2,
      ry + lift,
      -roofW * 0.25,
      ry - h * 0.025,
      0,
      ry - h * 0.035,
      roofW * 0.25,
      ry - h * 0.025,
      roofW / 2,
      ry + lift,
      0,
      ry,
    ]).fill(dark);
    g.poly([-roofW / 2, ry + lift, 0, ry, -roofW * 0.2, ry - h * 0.015]).fill({
      color: light,
      alpha: 0.65,
    });
    y = ry - h * 0.005;
  }
  g.circle(0, y - h * 0.02, w * 0.05).fill(mid);
  g.rect(-1, y - h * 0.09, 2, h * 0.08).fill(dark);
  void rng;
  snowCaps(
    g,
    Array.from({ length: levels }, (_, l) => {
      const t = l / (levels - 1);
      return { x: 0, y: -h * (0.12 + t * 0.72), w: w * (0.45 - t * 0.2) };
    }),
    look.snow,
  );
  return {};
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const BUSH_SPECS: Partial<Record<CatalogId, BushSpec>> = {
  azalea: {
    leaf: { dark: C('#2e5230'), mid: C('#4c7a44'), light: C('#7ba468') },
    flowerDark: '#c23d6d',
    flowerLight: '#f2a6c4',
    flowerShape: 'petal',
    leafSize: 'small',
  },
  hydrangea: {
    leaf: { dark: C('#2e5240'), mid: C('#4c7a5e'), light: C('#7ba492') },
    flowerDark: '#5a6ec9',
    flowerLight: '#b6c4f2',
    flowerShape: 'cluster',
    leafSize: 'large',
  },
  camellia: {
    leaf: { dark: C('#1f3a26'), mid: C('#2e5a38'), light: C('#548a5c') },
    flowerDark: '#a3222f',
    flowerLight: '#e2586a',
    flowerShape: 'petal',
    leafSize: 'large',
    glossy: true,
  },
  chrysanthemum: {
    leaf: { dark: C('#33502e'), mid: C('#547a4a'), light: C('#87a86e') },
    flowerDark: '#d68a1e',
    flowerLight: '#f7d878',
    flowerShape: 'pompom',
    leafSize: 'small',
  },
};

/** Dessine un objet de décor, base au point (0, 0). */
export function drawDecor(g: Graphics, look: DecorLook): DecorResult {
  g.clear();
  const rng = mulberry32(look.seed);
  switch (look.kind) {
    case 'moss':
      return drawMoss(g, look, rng);
    case 'fern':
      return drawFern(g, look, rng);
    case 'azalea':
    case 'hydrangea':
    case 'camellia':
    case 'chrysanthemum': {
      const spec = BUSH_SPECS[look.kind];
      if (!spec) return {};
      return drawBush(g, look, rng, spec, look.kind);
    }
    case 'iris':
      return drawIris(g, look, rng);
    case 'stone':
      return drawStone(g, look, rng);
    case 'rock':
      return drawRock(g, look, rng);
    case 'stepping':
      return drawStepping(g, look, rng);
    case 'lantern':
      return drawLantern(g, look, rng);
    case 'lantern-yukimi':
      return drawLanternYukimi(g, look, rng);
    case 'bridge':
      return drawBridge(g, look, rng);
    case 'stream':
      return drawStream(g, look, rng);
    case 'tsukubai':
      return drawTsukubai(g, look, rng);
    case 'bench':
      return drawBench(g, look, rng);
    case 'pagoda':
      return drawPagoda(g, look, rng);
    case 'maple':
    case 'cherry':
    case 'pine':
    case 'bamboo':
      // Gérés par trees.ts — rien à dessiner ici.
      return {};
  }
}

/** Clé de cache : ne change que si l'apparence change visiblement. */
export function decorLookKey(look: DecorLook): string {
  const q = (v: number, steps = 10) => Math.round(v * steps);
  return [
    look.kind,
    look.seed,
    q(look.growth, 20),
    q(look.bloom, 20),
    q(look.snow, 4),
    q(look.thirst, 4),
    look.flip ? 1 : 0,
    look.season.season,
    q(look.season.autumn),
    q(look.season.foliage),
  ].join(':');
}
