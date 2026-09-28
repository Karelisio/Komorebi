import type { GardenObject } from '@/state/types';
import { clamp, dayDistance } from '@/world/math';
import type { Season } from '@/world/season';
import { CATALOG, type CatalogId } from './catalog';

const HOUR = 3_600_000;

export interface HourConditions {
  season: Season;
  /** Jour de l'année (hémisphère nord). */
  day: number;
  rain: number;
  temperature: number;
  snow: number;
}

/** Soif visuelle 0..1 : une plante sans eau devient seulement un peu terne. */
export function thirst(o: GardenObject): number {
  if (!CATALOG[o.kind].grows) return 0;
  return clamp((0.25 - o.water) / 0.25);
}

export function stageOf(o: GardenObject): number {
  const e = CATALOG[o.kind];
  if (!e.grows) return e.stages - 1;
  return Math.min(e.stages - 1, Math.floor(o.growth * e.stages));
}

export function isMature(o: GardenObject): boolean {
  return !CATALOG[o.kind].grows || o.growth >= 1;
}

/** Intensité de floraison 0..1 d'une espèce à ce jour de l'année. */
export function bloomOf(kind: CatalogId, day: number): number {
  const b = CATALOG[kind].bloom;
  if (!b) return 0;
  return clamp(1 - dayDistance(day, b.peak) / b.width) ** 0.7;
}

/** Une heure de vie d'un objet du jardin (croissance, eau). Pure et déterministe. */
export function stepObjectHour(o: GardenObject, c: HourConditions): GardenObject {
  const e = CATALOG[o.kind];
  if (!e.grows) return o;
  let water = o.water - (c.temperature > 25 ? 1.5 : c.temperature < 5 ? 0.5 : 1) / 48;
  if (c.rain > 0.1) water += Math.min(0.35, c.rain * 0.08);
  if (c.snow > 0.1) water += 0.02;
  water = clamp(water);
  const waterFactor = o.water > 0.15 ? 1 : 0.25;
  const seasonFactor = c.season === 'winter' ? 0.3 : c.season === 'autumn' ? 0.7 : 1;
  const growth = clamp(o.growth + (waterFactor * seasonFactor) / (e.growthDays * 24));
  // La taille s'estompe très lentement si on ne l'entretient pas.
  const prune = Math.max(0, o.prune - 0.02 / 24);
  return { ...o, water, growth, prune };
}

export function water(o: GardenObject, amount: number, now: number): GardenObject {
  if (!CATALOG[o.kind].grows) return o;
  return { ...o, water: clamp(o.water + amount), lastWateredAt: now };
}

export function canPrune(o: GardenObject): boolean {
  return CATALOG[o.kind].category === 'tree' && o.growth >= 0.4;
}

export function prune(o: GardenObject): GardenObject {
  if (!canPrune(o)) return o;
  return { ...o, prune: clamp(o.prune + 0.18), pruneCount: o.pruneCount + 1 };
}

/** Style de bonsaï atteint selon l'historique de taille. */
export function bonsaiStyle(o: GardenObject): 'free' | 'shaped' | 'cloud' | 'bonsai' {
  if (o.pruneCount >= 12 && o.prune > 0.6) return 'bonsai';
  if (o.pruneCount >= 6 && o.prune > 0.4) return 'cloud';
  if (o.pruneCount >= 2) return 'shaped';
  return 'free';
}

export const HARVEST_INTERVAL = 12 * HOUR;

export function canHarvest(o: GardenObject, now: number): boolean {
  return CATALOG[o.kind].grows && isMature(o) && now >= o.harvestAt;
}

/** Pétales récoltés sur une plante mûre (bonus en floraison). */
export function harvestYield(o: GardenObject, day: number): number {
  const e = CATALOG[o.kind];
  const base = e.category === 'tree' ? 6 : 3;
  const bloom = bloomOf(o.kind, day);
  return Math.round(base * (1 + bloom) * (o.water > 0.15 ? 1 : 0.6));
}
