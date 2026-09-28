/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entier stable d'une chaîne ou de nombres (FNV-1a). */
export function hash(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = () => number;

export const rand = {
  range: (rng: Rng, min: number, max: number): number => min + (max - min) * rng(),
  int: (rng: Rng, min: number, maxInclusive: number): number =>
    Math.floor(min + (maxInclusive - min + 1) * rng()),
  pick: <T>(rng: Rng, items: readonly T[]): T => {
    const item = items[Math.floor(rng() * items.length)];
    if (item === undefined) throw new Error('pick: liste vide');
    return item;
  },
  chance: (rng: Rng, p: number): boolean => rng() < p,
};

export function uid(rng: Rng = Math.random): string {
  return Math.floor(rng() * 0xffffffff)
    .toString(36)
    .padStart(7, '0')
    .concat(Date.now().toString(36).slice(-4));
}
