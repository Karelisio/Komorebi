import { mulberry32 } from '@/world/random';
import { breed, randomGenome, type Genome } from './genetics';
import { createKoi, type KoiRecord } from './koi';

const MIN = 60_000;

export type EggTier = 0 | 1 | 2;

export interface EggOffer {
  tier: EggTier;
  cost: number;
  /** Niveau du jardin requis. */
  level: number;
  /** Temps d'incubation de base (ms). */
  incubation: number;
}

export const EGG_OFFERS: readonly EggOffer[] = [
  { tier: 0, cost: 30, level: 1, incubation: 3 * MIN },
  { tier: 1, cost: 120, level: 3, incubation: 20 * MIN },
  { tier: 2, cost: 400, level: 6, incubation: 90 * MIN },
];

/** Incubation d'un œuf issu d'un croisement (ms). */
export const BRED_INCUBATION = 45 * MIN;
/** Coût d'un croisement. */
export const BREED_COST = 25;
/** Délai avant qu'un même koï puisse se reproduire à nouveau. */
export const BREED_COOLDOWN = 6 * 60 * MIN;

export interface Egg {
  id: string;
  genome: Genome;
  laidAt: number;
  hatchAt: number;
  tier: EggTier | 'bred';
  parents?: [string, string];
}

/**
 * Génome d'un œuf acheté : les paliers supérieurs favorisent les allèles rares
 * (métallique, ginrin, tancho, papillon, asagi…).
 */
export function eggGenome(seed: number, tier: EggTier): Genome {
  const g = randomGenome(seed);
  if (tier === 0) return g;
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const p = tier === 1 ? 0.35 : 0.6;
  const pick = <T>(rare: T, common: T): T => (rng() < p ? rare : common);
  return {
    ...g,
    metallic: [pick('M', 'm'), 'm'],
    ginrin: [pick('G', 'g'), 'g'],
    tancho: [pick('t', 'T'), pick('t', 'T')],
    butterfly: [pick('b', 'B'), pick('b', 'B')],
    asagi: [pick('a', 'A'), pick('a', 'A')],
    sumiStyle: [pick('U', 'p'), 'p'],
    ground: [g.ground[0], pick('K', g.ground[1])],
  };
}

export function buyEgg(offer: EggOffer, seed: number, now: number, hatchBonus: number): Egg {
  return {
    id: `egg-${now.toString(36)}-${seed.toString(36)}`,
    genome: eggGenome(seed, offer.tier),
    laidAt: now,
    hatchAt: now + offer.incubation / (1 + hatchBonus),
    tier: offer.tier,
  };
}

/** Œuf issu d'un croisement ; la chance ajoute une mutation rare possible. */
export function bredEgg(
  a: KoiRecord,
  b: KoiRecord,
  seed: number,
  now: number,
  hatchBonus: number,
  luck: number,
): Egg {
  return {
    id: `egg-${now.toString(36)}-${seed.toString(36)}`,
    genome: breed(a.genome, b.genome, seed, 0.02 * (1 + luck * 4)),
    laidAt: now,
    hatchAt: now + BRED_INCUBATION / (1 + hatchBonus),
    tier: 'bred',
    parents: [a.id, b.id],
  };
}

export function isReady(egg: Egg, now: number): boolean {
  return now >= egg.hatchAt;
}

/** Fait éclore un œuf en alevin. */
export function hatch(
  egg: Egg,
  seed: number,
  now: number,
  pondId: string,
  taken: readonly string[],
): KoiRecord {
  return {
    ...createKoi({
      seed,
      now,
      pondId,
      genome: egg.genome,
      taken,
      ...(egg.parents ? { parents: egg.parents } : {}),
    }),
    growth: 0.05,
    satiety: 0.8,
  };
}
