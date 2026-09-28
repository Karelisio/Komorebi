import { CATALOG, CATALOG_IDS, ZONES, type CatalogId, type ZoneId } from './catalog';

export type ObjectiveId =
  | 'feed'
  | 'rake'
  | 'dawn'
  | 'rain'
  | 'firefly'
  | 'sakura'
  | 'autumn'
  | 'snow'
  | 'meteor'
  | 'fullmoon'
  | 'fry'
  | 'bonsai'
  | 'breath'
  | 'lantern'
  | 'rare'
  | 'frogs';

export interface Objective {
  id: ObjectiveId;
  reward: number;
  /** Graine offerte en plus (événements naturels). */
  seed?: CatalogId;
}

/** Petits moments facultatifs : rien n'est obligatoire, tout est récompensé doucement. */
export const OBJECTIVES: readonly Objective[] = [
  { id: 'feed', reward: 5 },
  { id: 'rake', reward: 5 },
  { id: 'breath', reward: 8 },
  { id: 'dawn', reward: 12, seed: 'azalea' },
  { id: 'rain', reward: 8, seed: 'moss' },
  { id: 'firefly', reward: 15, seed: 'iris' },
  { id: 'sakura', reward: 15, seed: 'cherry' },
  { id: 'autumn', reward: 15, seed: 'maple' },
  { id: 'snow', reward: 15, seed: 'camellia' },
  { id: 'meteor', reward: 20, seed: 'pine' },
  { id: 'fullmoon', reward: 12 },
  { id: 'frogs', reward: 10, seed: 'fern' },
  { id: 'fry', reward: 20 },
  { id: 'bonsai', reward: 25 },
  { id: 'lantern', reward: 10 },
  { id: 'rare', reward: 25 },
];

export function objective(id: ObjectiveId): Objective {
  const o = OBJECTIVES.find((x) => x.id === id);
  if (!o) throw new Error(`objectif inconnu ${id}`);
  return o;
}

/** Clé de jour locale (AAAA-MM-JJ). */
export function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86_400_000);
}

export interface DailyGift {
  day: string;
  streak: number;
  petals: number;
  seed: CatalogId;
}

/** Cadeau de retour quotidien : quelques pétales et une graine, jamais de pénalité. */
export function dailyGift(
  last: { lastDay: string; streak: number },
  now: number,
  petalsEarned: number,
  seed: number,
): DailyGift | null {
  const today = dayKey(now);
  if (last.lastDay === today) return null;
  const gap = last.lastDay ? daysBetween(last.lastDay, today) : 1;
  const streak = gap === 1 ? last.streak + 1 : 1;
  const plants = CATALOG_IDS.filter(
    (id) => CATALOG[id].grows && CATALOG[id].unlockAt <= petalsEarned,
  );
  const pick = plants[seed % plants.length] ?? 'moss';
  return { day: today, streak, petals: Math.min(15, 4 + streak), seed: pick };
}

export function unlockedCatalog(petalsEarned: number): CatalogId[] {
  return CATALOG_IDS.filter((id) => CATALOG[id].unlockAt <= petalsEarned);
}

export function newlyUnlocked(before: number, after: number): CatalogId[] {
  return CATALOG_IDS.filter((id) => CATALOG[id].unlockAt > before && CATALOG[id].unlockAt <= after);
}

export function zoneAvailable(id: ZoneId, petalsEarned: number): boolean {
  const z = ZONES.find((x) => x.id === id);
  return !!z && petalsEarned >= z.unlockAt;
}
