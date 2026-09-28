import { create } from 'zustand';
import { dailyGift, type DailyGift } from '@/garden/daily';
import { decor, decorBonus, type DecorId } from '@/garden/decor';
import { ACTIVE_QUESTS, makeQuest, questDone, type Quest } from '@/garden/quests';
import {
  accrue,
  discoveryReward,
  growthPerHour,
  HOUR,
  pondCapacity,
  pondRate,
  questsForLevel,
  UPGRADE_MAX,
  upgradeCost,
  type UpgradeId,
} from '@/pond/economy';
import {
  BREED_COOLDOWN,
  BREED_COST,
  bredEgg,
  buyEgg as makeEgg,
  EGG_OFFERS,
  hatch,
  isReady,
  type Egg,
  type EggTier,
} from '@/pond/eggs';
import { express } from '@/pond/genetics';
import { ADULT_GROWTH, feedKoi, isAdult, koiGrowth, starterKois, type KoiRecord } from '@/pond/koi';
import { BANK_SLOTS, MAIN_POND } from '@/world/layout';
import type { GameState, GameStats, JournalEntry } from './types';

export const SAVE_VERSION = 2;

/** Nombre d'œufs que le nid peut contenir. */
export const NEST_SIZE = 3;

const emptyStats = (): GameStats => ({
  fed: 0,
  collected: 0,
  eggsBought: 0,
  hatched: 0,
  bred: 0,
  decorPlaced: 0,
  upgrades: 0,
  grown: 0,
  discovered: 0,
  photos: 0,
  breaths: 0,
  meditationMin: 0,
});

/** Décor de départ : quelques pierres et plantes, le reste à composer. */
export function starterDecor(): (DecorId | null)[] {
  const d: (DecorId | null)[] = BANK_SLOTS.map(() => null);
  d[0] = 'rock';
  d[3] = 'fern';
  d[6] = 'moss-stone';
  return d;
}

function initialQuests(stats: GameStats): Quest[] {
  const out: Quest[] = [];
  for (let i = 0; i < ACTIVE_QUESTS; i++) out.push(makeQuest(i, 1, stats, out));
  return out;
}

export function newGame(now: number): GameState {
  const stats = emptyStats();
  const kois = starterKois(now, MAIN_POND.id)
    .slice(0, 3)
    .map((k, i) => ({
      ...k,
      growth: 0.45 + i * 0.1,
    }));
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSimAt: now,
    petals: 40,
    petalsEarned: 0,
    // Quelques bulles dès le départ, pour apprendre à récolter
    pending: 12,
    kois,
    eggs: [],
    decor: starterDecor(),
    upgrades: { pond: 0, food: 0, charm: 0 },
    level: 1,
    levelProgress: 0,
    quests: initialQuests(stats),
    questSeq: ACTIVE_QUESTS,
    discovered: { varieties: [...new Set(kois.map((k) => express(k.genome).variety))], events: [] },
    journal: [],
    daily: { lastDay: '', streak: 0 },
    tutorial: { step: 0, done: false },
    weatherMemory: { lastRainAt: 0, snowCover: 0, wetness: 0 },
    stats,
  };
}

let journalSeq = 0;

export function journalEntry(
  kind: JournalEntry['kind'],
  key: string,
  at: number,
  params?: JournalEntry['params'],
): JournalEntry {
  return {
    id: `j-${at.toString(36)}-${(journalSeq++).toString(36)}`,
    at,
    kind,
    key,
    ...(params ? { params } : {}),
  };
}

/**
 * Fait avancer l'économie de `dtMs` : production de pétales (plafonnée), croissance et faim
 * des koïs. Pure : utilisée en jeu (chaque seconde) et pour la simulation hors ligne.
 */
export function advance(state: GameState, dtMs: number, now: number, night: boolean): GameState {
  if (dtMs <= 0) return state;
  const bonus = decorBonus(state.decor);
  const hours = dtMs / HOUR;
  let grown = 0;
  const kois = state.kois.map((k) => {
    const g0 = koiGrowth(k, now);
    const g1 = Math.min(1, g0 + growthPerHour(k, state.upgrades, bonus) * hours);
    if (g0 < ADULT_GROWTH && g1 >= ADULT_GROWTH) grown++;
    return { ...k, growth: g1, satiety: Math.max(0, k.satiety - hours / 20) };
  });
  const rate = pondRate(kois, now, state.upgrades, bonus, night);
  return {
    ...state,
    kois,
    pending: accrue(state.pending, rate, dtMs),
    stats: grown ? { ...state.stats, grown: state.stats.grown + grown } : state.stats,
  };
}

export interface GameActions {
  replace(state: GameState): void;
  addJournal(entry: JournalEntry): void;
  /** Avance l'économie en jeu. */
  tick(dtMs: number, now: number, night: boolean): void;
  onKoiAte(koiId: string): void;
  renameKoi(id: string, name: string): void;
  toggleFavorite(id: string): void;
  /** Relâche un koï dans la rivière (libère une place) ; rapporte quelques pétales. */
  releaseKoi(id: string): number;
  addPetals(n: number): void;
  /** Récolte les pétales en attente ; renvoie la quantité. */
  collect(): number;
  buyEgg(tier: EggTier, now: number): Egg | null;
  /** Fait éclore les œufs prêts (s'il y a de la place). Renvoie les nouveaux koïs et les découvertes. */
  hatchReady(now: number): { born: KoiRecord[]; discoveries: { koi: KoiRecord; reward: number }[] };
  breed(aId: string, bId: string, now: number): Egg | null;
  placeDecor(slot: number, id: DecorId): boolean;
  removeDecor(slot: number): number;
  upgrade(id: UpgradeId): boolean;
  /** Réclame une quête accomplie : récompense, progression de niveau, nouvelle quête. */
  claimQuest(id: string): { reward: number; levelUp: boolean } | null;
  claimDaily(now: number): DailyGift | null;
  recordStat(key: 'photos' | 'breaths' | 'meditationMin', n?: number): void;
  remember(
    kind: JournalEntry['kind'],
    key: string,
    now: number,
    params?: JournalEntry['params'],
    once?: string,
  ): boolean;
}

export type GameStore = GameState & GameActions;

const withJournal = (s: GameState, e: JournalEntry) => [e, ...s.journal].slice(0, 500);

export const useGame = create<GameStore>((set, get) => ({
  ...newGame(Date.now()),
  replace: (state) => set({ ...state }),
  addJournal: (entry) => set((s) => ({ journal: withJournal(s, entry) })),
  tick: (dtMs, now, night) => set((s) => advance(s, dtMs, now, night)),
  onKoiAte: (koiId) =>
    set((s) => ({
      kois: s.kois.map((k) => (k.id === koiId ? feedKoi(k) : k)),
      stats: { ...s.stats, fed: s.stats.fed + 1 },
    })),
  renameKoi: (id, name) =>
    set((s) => ({
      kois: s.kois.map((k) =>
        k.id === id ? { ...k, name: name.trim().slice(0, 24) || k.name } : k,
      ),
    })),
  toggleFavorite: (id) =>
    set((s) => ({ kois: s.kois.map((k) => (k.id === id ? { ...k, favorite: !k.favorite } : k)) })),
  releaseKoi: (id) => {
    const s = get();
    const k = s.kois.find((x) => x.id === id);
    if (!k || s.kois.length <= 1) return 0;
    const gain = 5 * express(k.genome).rarity;
    set({ kois: s.kois.filter((x) => x.id !== id), petals: s.petals + gain });
    return gain;
  },
  addPetals: (n) =>
    set((s) => ({ petals: s.petals + n, petalsEarned: s.petalsEarned + Math.max(0, n) })),
  collect: () => {
    const s = get();
    const n = Math.floor(s.pending);
    if (n <= 0) return 0;
    set({
      pending: s.pending - n,
      petals: s.petals + n,
      petalsEarned: s.petalsEarned + n,
      stats: { ...s.stats, collected: s.stats.collected + n },
    });
    return n;
  },
  buyEgg: (tier, now) => {
    const s = get();
    const offer = EGG_OFFERS.find((o) => o.tier === tier);
    if (!offer || s.level < offer.level || s.petals < offer.cost || s.eggs.length >= NEST_SIZE)
      return null;
    const egg = makeEgg(offer, Math.floor(Math.random() * 2 ** 31), now, decorBonus(s.decor).hatch);
    set({
      eggs: [...s.eggs, egg],
      petals: s.petals - offer.cost,
      stats: { ...s.stats, eggsBought: s.stats.eggsBought + 1 },
    });
    return egg;
  },
  hatchReady: (now) => {
    const s = get();
    const room = pondCapacity(s.upgrades) - s.kois.length;
    const ready = s.eggs.filter((e) => isReady(e, now)).slice(0, Math.max(0, room));
    if (!ready.length) return { born: [], discoveries: [] };
    const born: KoiRecord[] = [];
    const taken = s.kois.map((k) => k.name);
    for (const egg of ready) {
      const k = hatch(egg, Math.floor(Math.random() * 2 ** 31), now, MAIN_POND.id, [
        ...taken,
        ...born.map((b) => b.name),
      ]);
      born.push(k);
    }
    const varieties = [...s.discovered.varieties];
    const discoveries: { koi: KoiRecord; reward: number }[] = [];
    let journal = s.journal;
    for (const k of born) {
      const ph = express(k.genome);
      if (!varieties.includes(ph.variety)) {
        varieties.push(ph.variety);
        const reward = discoveryReward(ph.rarity);
        discoveries.push({ koi: k, reward });
        journal = [
          journalEntry('discovery', 'variety', now, { variety: ph.variety, name: k.name }),
          ...journal,
        ];
      }
    }
    const bonus = discoveries.reduce((n, d) => n + d.reward, 0);
    set({
      kois: [...s.kois, ...born],
      eggs: s.eggs.filter((e) => !ready.includes(e)),
      discovered: { ...s.discovered, varieties },
      petals: s.petals + bonus,
      petalsEarned: s.petalsEarned + bonus,
      journal: journal.slice(0, 500),
      stats: {
        ...s.stats,
        hatched: s.stats.hatched + born.length,
        discovered: s.stats.discovered + discoveries.length,
      },
    });
    return { born, discoveries };
  },
  breed: (aId, bId, now) => {
    const s = get();
    const a = s.kois.find((k) => k.id === aId);
    const b = s.kois.find((k) => k.id === bId);
    if (!a || !b || a === b || a.sex === b.sex) return null;
    if (!isAdult(a, now) || !isAdult(b, now)) return null;
    if ((a.lastBredAt ?? 0) + BREED_COOLDOWN > now || (b.lastBredAt ?? 0) + BREED_COOLDOWN > now)
      return null;
    if (s.petals < BREED_COST || s.eggs.length >= NEST_SIZE) return null;
    const bonus = decorBonus(s.decor);
    const egg = bredEgg(a, b, Math.floor(Math.random() * 2 ** 31), now, bonus.hatch, bonus.luck);
    set({
      eggs: [...s.eggs, egg],
      petals: s.petals - BREED_COST,
      kois: s.kois.map((k) => (k.id === aId || k.id === bId ? { ...k, lastBredAt: now } : k)),
      stats: { ...s.stats, bred: s.stats.bred + 1 },
    });
    return egg;
  },
  placeDecor: (slot, id) => {
    const s = get();
    const e = decor(id);
    if (slot < 0 || slot >= s.decor.length || s.decor[slot]) return false;
    if (s.level < e.level || s.petals < e.cost) return false;
    const next = [...s.decor];
    next[slot] = id;
    set({
      decor: next,
      petals: s.petals - e.cost,
      stats: { ...s.stats, decorPlaced: s.stats.decorPlaced + 1 },
    });
    return true;
  },
  removeDecor: (slot) => {
    const s = get();
    const id = s.decor[slot];
    if (!id) return 0;
    const refund = Math.floor(decor(id).cost / 2);
    const next = [...s.decor];
    next[slot] = null;
    set({ decor: next, petals: s.petals + refund });
    return refund;
  },
  upgrade: (id) => {
    const s = get();
    const lvl = s.upgrades[id];
    if (lvl >= UPGRADE_MAX[id]) return false;
    const cost = upgradeCost(id, lvl);
    if (s.petals < cost) return false;
    set({
      upgrades: { ...s.upgrades, [id]: lvl + 1 },
      petals: s.petals - cost,
      stats: { ...s.stats, upgrades: s.stats.upgrades + 1 },
    });
    return true;
  },
  claimQuest: (id) => {
    const s = get();
    const q = s.quests.find((x) => x.id === id);
    if (!q || !questDone(q, s.stats)) return null;
    let level = s.level;
    let progress = s.levelProgress + 1;
    let levelUp = false;
    if (progress >= questsForLevel(level)) {
      level++;
      progress = 0;
      levelUp = true;
    }
    const others = s.quests.filter((x) => x.id !== id);
    const next = makeQuest(s.questSeq, level, s.stats, others);
    const quests = s.quests.map((x) => (x.id === id ? next : x));
    set({
      quests,
      questSeq: s.questSeq + 1,
      level,
      levelProgress: progress,
      petals: s.petals + q.reward,
      petalsEarned: s.petalsEarned + q.reward,
      journal: levelUp
        ? withJournal(s, journalEntry('unlock', 'level', Date.now(), { n: level }))
        : s.journal,
    });
    return { reward: q.reward, levelUp };
  },
  claimDaily: (now) => {
    const s = get();
    const gift = dailyGift(s.daily, now);
    if (!gift) return null;
    set({
      daily: { lastDay: gift.day, streak: gift.streak },
      petals: s.petals + gift.petals,
      petalsEarned: s.petalsEarned + gift.petals,
      journal: withJournal(s, journalEntry('memory', 'daily', now, { n: gift.streak })),
    });
    return gift;
  },
  recordStat: (key, n = 1) => set((s) => ({ stats: { ...s.stats, [key]: s.stats[key] + n } })),
  remember: (kind, key, now, params, once) => {
    const s = get();
    if (once && s.discovered.events.includes(once)) return false;
    set({
      journal: withJournal(s, journalEntry(kind, key, now, params)),
      discovered: once
        ? { ...s.discovered, events: [...s.discovered.events, once].slice(-400) }
        : s.discovered,
    });
    return true;
  },
}));

/** État sérialisable (sans les actions). */
export function snapshotGame(): GameState {
  const s = useGame.getState();
  return {
    version: s.version,
    createdAt: s.createdAt,
    lastSimAt: s.lastSimAt,
    petals: s.petals,
    petalsEarned: s.petalsEarned,
    pending: s.pending,
    kois: s.kois,
    eggs: s.eggs,
    decor: s.decor,
    upgrades: s.upgrades,
    level: s.level,
    levelProgress: s.levelProgress,
    quests: s.quests,
    questSeq: s.questSeq,
    discovered: s.discovered,
    journal: s.journal,
    daily: s.daily,
    tutorial: s.tutorial,
    weatherMemory: s.weatherMemory,
    stats: s.stats,
  };
}
