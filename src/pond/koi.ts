import type { Season } from '@/world/season';
import { mulberry32, rand } from '@/world/random';
import { breed, express, randomGenome, type Genome, type Sex, type Variety } from './genetics';

export interface KoiRecord {
  id: string;
  name: string;
  genome: Genome;
  sex: Sex;
  /** Naissance (ms, temps de jeu). */
  bornAt: number;
  pondId: string;
  parents?: [string, string];
  /** Satiété 0..1. */
  satiety: number;
  favorite?: boolean;
}

const DAY = 86_400_000;
export const ADULT_DAYS = 5;
export const FULL_SIZE_DAYS = 12;

export const KOI_NAMES = [
  'Hana',
  'Sora',
  'Kumo',
  'Yuki',
  'Tama',
  'Momo',
  'Hoshi',
  'Kaze',
  'Nami',
  'Ume',
  'Sakura',
  'Mizu',
  'Hikari',
  'Koharu',
  'Aki',
  'Natsu',
  'Fuyu',
  'Haru',
  'Kiku',
  'Tsuki',
  'Ren',
  'Suzu',
  'Kai',
  'Nagi',
  'Mochi',
  'Kinako',
  'Yuzu',
  'Sumi',
  'Akane',
  'Botan',
  'Ayame',
  'Kōri',
  'Shizuku',
  'Taiyō',
  'Iro',
  'Fuji',
  'Hotaru',
  'Mei',
  'Rin',
];

export function ageDays(k: KoiRecord, now: number): number {
  return Math.max(0, (now - k.bornAt) / DAY);
}

/** Taille relative 0.3 (alevin) → 1 (adulte). */
export function koiSize(k: KoiRecord, now: number): number {
  const t = Math.min(1, ageDays(k, now) / FULL_SIZE_DAYS);
  return 0.3 + 0.7 * (1 - (1 - t) * (1 - t));
}

export function isAdult(k: KoiRecord, now: number): boolean {
  return ageDays(k, now) >= ADULT_DAYS;
}

export function pickName(seed: number, taken: readonly string[]): string {
  const rng = mulberry32(seed);
  const free = KOI_NAMES.filter((n) => !taken.includes(n));
  const base = rand.pick(rng, free.length ? free : KOI_NAMES);
  return free.length ? base : `${base} ${rand.int(rng, 2, 99)}`;
}

export function createKoi(opts: {
  seed: number;
  now: number;
  pondId: string;
  genome?: Genome;
  template?: Variety;
  taken?: readonly string[];
  ageDays?: number;
  parents?: [string, string];
}): KoiRecord {
  const rng = mulberry32(opts.seed);
  return {
    id: `koi-${opts.seed.toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`,
    name: pickName(opts.seed, opts.taken ?? []),
    genome: opts.genome ?? randomGenome(opts.seed, opts.template),
    sex: rng() < 0.5 ? 'f' : 'm',
    bornAt: opts.now - (opts.ageDays ?? 0) * DAY,
    pondId: opts.pondId,
    satiety: 0.7,
    ...(opts.parents ? { parents: opts.parents } : {}),
  };
}

export const SPAWN_SEASON: Record<Season, number> = {
  spring: 1,
  summer: 0.6,
  autumn: 0.15,
  winter: 0,
};

export interface PondHourResult {
  kois: KoiRecord[];
  births: KoiRecord[];
}

/**
 * Une heure de vie du bassin : la faim augmente, et parfois des alevins naissent
 * (saison favorable, poissons nourris, place disponible).
 */
export function stepPondHour(
  kois: readonly KoiRecord[],
  opts: { pondId: string; capacity: number; season: Season; now: number; seed: number },
): PondHourResult {
  const rng = mulberry32(opts.seed);
  const updated = kois.map((k) =>
    k.pondId === opts.pondId ? { ...k, satiety: Math.max(0, k.satiety - 1 / 30) } : k,
  );
  const inPond = updated.filter((k) => k.pondId === opts.pondId);
  const births: KoiRecord[] = [];
  const room = opts.capacity - inPond.length;
  if (room <= 0) return { kois: updated, births };
  const adults = inPond.filter((k) => isAdult(k, opts.now) && k.satiety > 0.35);
  const mothers = adults.filter((k) => k.sex === 'f');
  const fathers = adults.filter((k) => k.sex === 'm');
  if (!mothers.length || !fathers.length) return { kois: updated, births };
  const fed = adults.reduce((s, k) => s + k.satiety, 0) / adults.length;
  const chance = 0.018 * SPAWN_SEASON[opts.season] * fed;
  if (rng() >= chance) return { kois: updated, births };
  const mother = rand.pick(rng, mothers);
  const father = rand.pick(rng, fathers);
  const count = Math.min(room, rand.int(rng, 1, 3));
  const taken = updated.map((k) => k.name);
  for (let i = 0; i < count; i++) {
    const seed = Math.floor(rng() * 2 ** 31);
    const fry = createKoi({
      seed,
      now: opts.now,
      pondId: opts.pondId,
      genome: breed(mother.genome, father.genome, seed),
      taken: [...taken, ...births.map((b) => b.name)],
      parents: [mother.id, father.id],
    });
    births.push(fry);
  }
  return { kois: [...updated, ...births], births };
}

export function feedKoi(k: KoiRecord, amount = 0.18): KoiRecord {
  return { ...k, satiety: Math.min(1, k.satiety + amount) };
}

export function varietyOf(k: KoiRecord): Variety {
  return express(k.genome).variety;
}

/** Poissons offerts au démarrage. */
export function starterKois(now: number, pondId: string): KoiRecord[] {
  const templates: Variety[] = ['kohaku', 'sanke', 'showa', 'chagoi', 'ogon'];
  const out: KoiRecord[] = [];
  templates.forEach((template, i) => {
    out.push(
      createKoi({
        seed: 1000 + i * 17,
        now,
        pondId,
        template,
        taken: out.map((k) => k.name),
        ageDays: 6 + i,
      }),
    );
  });
  // Un mâle et une femelle au moins, pour que la vie suive son cours.
  out[0] = { ...out[0]!, sex: 'f' };
  out[1] = { ...out[1]!, sex: 'm' };
  return out;
}
