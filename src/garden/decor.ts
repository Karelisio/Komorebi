/**
 * Décor de la berge : chaque objet se pose sur un emplacement et apporte un petit bonus.
 * Les bonus s'additionnent (en pourcentage).
 */

export type DecorId =
  | 'moss-stone'
  | 'rock'
  | 'fern'
  | 'iris'
  | 'azalea'
  | 'lantern'
  | 'yukimi'
  | 'shishi'
  | 'maple'
  | 'pine'
  | 'cherry'
  | 'pagoda';

export interface DecorEffect {
  /** Pétales produits (+%). */
  petals?: number;
  /** Pétales produits la nuit seulement (+%). */
  nightPetals?: number;
  /** Croissance des koïs (+%). */
  growth?: number;
  /** Éclosion plus rapide (+%). */
  hatch?: number;
  /** Chance de variété rare aux croisements (+%). */
  luck?: number;
}

export interface DecorEntry {
  id: DecorId;
  cost: number;
  /** Niveau du jardin requis. */
  level: number;
  effect: DecorEffect;
  /** Taille relative du dessin (1 = pierre moyenne). */
  size: number;
}

export const DECOR: readonly DecorEntry[] = [
  { id: 'moss-stone', cost: 15, level: 1, effect: { petals: 3 }, size: 0.8 },
  { id: 'fern', cost: 25, level: 1, effect: { growth: 5 }, size: 1 },
  { id: 'rock', cost: 30, level: 1, effect: { petals: 5 }, size: 1.1 },
  { id: 'iris', cost: 40, level: 2, effect: { hatch: 10 }, size: 1.1 },
  { id: 'azalea', cost: 60, level: 2, effect: { petals: 8 }, size: 1.3 },
  { id: 'lantern', cost: 90, level: 3, effect: { nightPetals: 30 }, size: 1.6 },
  { id: 'shishi', cost: 140, level: 4, effect: { hatch: 25 }, size: 1.4 },
  { id: 'maple', cost: 180, level: 5, effect: { growth: 15, petals: 5 }, size: 2.2 },
  { id: 'yukimi', cost: 220, level: 6, effect: { petals: 15 }, size: 1.6 },
  { id: 'pine', cost: 300, level: 7, effect: { growth: 20, luck: 5 }, size: 2.3 },
  { id: 'cherry', cost: 420, level: 8, effect: { petals: 25 }, size: 2.4 },
  { id: 'pagoda', cost: 600, level: 10, effect: { luck: 15, petals: 10 }, size: 2 },
];

export const DECOR_IDS = DECOR.map((d) => d.id);

export function decor(id: DecorId): DecorEntry {
  const d = DECOR.find((x) => x.id === id);
  if (!d) throw new Error(`décor inconnu ${id}`);
  return d;
}

export function isDecorId(v: unknown): v is DecorId {
  return typeof v === 'string' && (DECOR_IDS as readonly string[]).includes(v);
}

export interface DecorBonus {
  petals: number;
  nightPetals: number;
  growth: number;
  hatch: number;
  luck: number;
}

/** Somme des bonus (en fraction : 0.1 = +10 %) des objets posés. */
export function decorBonus(slots: readonly (DecorId | null)[]): DecorBonus {
  const b: DecorBonus = { petals: 0, nightPetals: 0, growth: 0, hatch: 0, luck: 0 };
  for (const id of slots) {
    if (!id) continue;
    const e = decor(id).effect;
    b.petals += (e.petals ?? 0) / 100;
    b.nightPetals += (e.nightPetals ?? 0) / 100;
    b.growth += (e.growth ?? 0) / 100;
    b.hatch += (e.hatch ?? 0) / 100;
    b.luck += (e.luck ?? 0) / 100;
  }
  return b;
}
