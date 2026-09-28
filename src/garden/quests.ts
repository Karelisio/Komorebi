import { mulberry32 } from '@/world/random';

/** Compteurs suivis pour les quêtes. */
export interface QuestStats {
  fed: number;
  collected: number;
  eggsBought: number;
  hatched: number;
  bred: number;
  decorPlaced: number;
  upgrades: number;
  grown: number;
  discovered: number;
}

export type QuestKind = keyof QuestStats;

export interface Quest {
  id: string;
  kind: QuestKind;
  /** Valeur du compteur à la création. */
  base: number;
  target: number;
  reward: number;
}

export const ACTIVE_QUESTS = 3;

/** Premières quêtes, fixes : elles servent de fil conducteur au début. */
const FIRST: readonly [QuestKind, number, number][] = [
  ['fed', 3, 10],
  ['collected', 15, 15],
  ['eggsBought', 1, 20],
  ['decorPlaced', 1, 20],
  ['hatched', 1, 25],
  ['discovered', 1, 30],
];

interface Template {
  kind: QuestKind;
  minLevel: number;
  /** Cible selon le niveau. */
  target: (level: number) => number;
  /** Récompense selon la cible et le niveau. */
  reward: (target: number, level: number) => number;
  weight: number;
}

const TEMPLATES: readonly Template[] = [
  { kind: 'fed', minLevel: 1, target: (l) => 8 + l * 4, reward: (t) => 10 + t, weight: 3 },
  {
    kind: 'collected',
    minLevel: 1,
    target: (l) => Math.round((40 * Math.pow(1.5, l)) / 10) * 10,
    reward: (t) => Math.round(t * 0.35),
    weight: 3,
  },
  {
    kind: 'eggsBought',
    minLevel: 1,
    target: (l) => 1 + Math.floor(l / 3),
    reward: (t, l) => 25 * t + l * 5,
    weight: 2,
  },
  {
    kind: 'hatched',
    minLevel: 1,
    target: (l) => 1 + Math.floor(l / 3),
    reward: (t, l) => 25 * t + l * 5,
    weight: 2,
  },
  { kind: 'decorPlaced', minLevel: 1, target: () => 1, reward: (_t, l) => 20 + l * 10, weight: 2 },
  { kind: 'upgrades', minLevel: 2, target: () => 1, reward: (_t, l) => 30 + l * 12, weight: 2 },
  { kind: 'bred', minLevel: 3, target: () => 1, reward: (_t, l) => 40 + l * 10, weight: 2 },
  { kind: 'grown', minLevel: 2, target: () => 1, reward: (_t, l) => 35 + l * 10, weight: 2 },
  { kind: 'discovered', minLevel: 2, target: () => 1, reward: (_t, l) => 50 + l * 15, weight: 1 },
];

export function questProgress(q: Quest, stats: QuestStats): number {
  return Math.max(0, Math.min(q.target, stats[q.kind] - q.base));
}

export function questDone(q: Quest, stats: QuestStats): boolean {
  return questProgress(q, stats) >= q.target;
}

/** Crée la quête numéro `seq`, différente des quêtes actives. */
export function makeQuest(
  seq: number,
  level: number,
  stats: QuestStats,
  active: readonly Quest[],
): Quest {
  const first = FIRST[seq];
  if (first) {
    const [kind, target, reward] = first;
    return { id: `q${seq}`, kind, base: stats[kind], target, reward };
  }
  const rng = mulberry32(seq * 7919 + level * 31);
  const pool = TEMPLATES.filter(
    (t) => t.minLevel <= level && !active.some((q) => q.kind === t.kind),
  );
  const list = pool.length ? pool : TEMPLATES.filter((t) => t.minLevel <= level);
  const total = list.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  let tpl = list[0]!;
  for (const t of list) {
    r -= t.weight;
    if (r <= 0) {
      tpl = t;
      break;
    }
  }
  const target = tpl.target(level);
  return {
    id: `q${seq}`,
    kind: tpl.kind,
    base: stats[tpl.kind],
    target,
    reward: tpl.reward(target, level),
  };
}
