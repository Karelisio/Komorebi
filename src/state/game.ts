import { create } from 'zustand';
import { CATALOG, ZONES, type CatalogId, type ZoneId } from '@/garden/catalog';
import { dailyGift, objective, type DailyGift, type ObjectiveId } from '@/garden/progression';
import { canHarvest, HARVEST_INTERVAL, harvestYield, prune, water } from '@/garden/growth';
import { express } from '@/pond/genetics';
import { feedKoi, starterKois, type KoiRecord } from '@/pond/koi';
import { MAIN_POND } from '@/world/layout';
import { mulberry32 } from '@/world/random';
import type { GameState, GardenObject, JournalEntry } from './types';

export const SAVE_VERSION = 1;

function starterObjects(now: number): GardenObject[] {
  const rng = mulberry32(77);
  const obj = (kind: CatalogId, x: number, y: number, growth = 1): GardenObject => ({
    id: `obj-${kind}-${Math.round(x)}-${Math.round(y)}`,
    kind,
    x,
    y,
    seed: Math.floor(rng() * 1e9),
    placedAt: now,
    water: 1,
    lastWateredAt: now,
    prune: 0,
    pruneCount: 0,
    growth,
    flip: rng() < 0.5,
    harvestAt: now,
  });
  return [
    // Autour du bassin
    obj('lantern', 905, 1060),
    obj('rock', 300, 1010),
    obj('stone', 345, 1030),
    obj('stone', 880, 1400),
    obj('iris', 330, 1370),
    obj('iris', 860, 1120),
    obj('fern', 960, 1120),
    obj('moss', 250, 1080),
    obj('moss', 390, 1440),
    // Massifs taillés et sous-bois
    obj('azalea', 420, 960, 0.8),
    obj('azalea', 760, 900, 0.7),
    obj('azalea', 810, 930, 0.6),
    obj('fern', 690, 700),
    obj('moss', 740, 720),
    obj('stone', 780, 690),
    // Le long de l'allée
    obj('lantern-yukimi', 330, 760),
    obj('stone', 285, 780),
    obj('tsukubai', 180, 1180),
    obj('fern', 230, 1210),
    obj('bench', 265, 1560),
    // Pas japonais vers le jardin sec
    obj('stepping', 610, 1455),
    obj('stepping', 655, 1505),
    obj('stepping', 625, 1555),
    obj('stepping', 700, 1610),
    obj('stepping', 745, 1665),
    obj('stepping', 720, 1725),
    obj('stepping', 760, 1790),
    // Jardin sec
    obj('rock', 400, 2070),
    obj('stone', 458, 2105),
    obj('stone', 800, 2020),
    obj('rock', 870, 2150),
  ];
}

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSimAt: now,
    petals: 30,
    petalsEarned: 0,
    seeds: { maple: 1, cherry: 1, moss: 2, fern: 1 },
    objects: starterObjects(now),
    kois: starterKois(now, MAIN_POND.id),
    zones: [],
    discovered: { varieties: [], species: ['maple', 'pine', 'bamboo', 'cherry'], events: [] },
    journal: [],
    objectives: {},
    daily: { lastDay: '', streak: 0 },
    sand: { w: 0, h: 0, data: '' },
    tutorial: { step: 0, done: false },
    weatherMemory: { lastRainAt: 0, snowCover: 0, wetness: 0 },
    stats: { fed: 0, watered: 0, raked: 0, photos: 0, breaths: 0, meditationMin: 0, pruned: 0 },
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

export function newObject(
  kind: CatalogId,
  x: number,
  y: number,
  now: number,
  seed: number,
): GardenObject {
  const grows = CATALOG[kind].grows;
  return {
    id: `obj-${now.toString(36)}-${seed.toString(36)}`,
    kind,
    x,
    y,
    seed,
    placedAt: now,
    water: 1,
    lastWateredAt: now,
    prune: 0,
    pruneCount: 0,
    growth: grows ? 0 : 1,
    flip: seed % 2 === 0,
    harvestAt: now + HARVEST_INTERVAL,
  };
}

interface GameActions {
  replace(state: GameState): void;
  addJournal(entry: JournalEntry): void;
  discoverVariety(koi: KoiRecord, at: number): void;
  onKoiAte(koiId: string): void;
  renameKoi(id: string, name: string): void;
  toggleFavorite(id: string): void;
  addPetals(n: number): void;
  /** Pose un objet (graine ou achat en pétales). Renvoie l'objet créé ou null. */
  placeObject(kind: CatalogId, x: number, y: number, now: number): GardenObject | null;
  moveObject(id: string, x: number, y: number): void;
  removeObject(id: string): void;
  waterObjects(ids: readonly string[], amount: number, now: number): void;
  pruneObject(id: string): boolean;
  harvestObject(
    id: string,
    now: number,
    day: number,
  ): { petals: number; seed: CatalogId | null } | null;
  setSand(data: string, w: number, h: number): void;
  canAfford(kind: CatalogId): boolean;
  /** Valide un petit moment (une seule fois). Renvoie la récompense ou null. */
  completeObjective(id: ObjectiveId, now: number): number | null;
  claimDaily(now: number): DailyGift | null;
  unlockZone(id: ZoneId, now: number): boolean;
  /** Ajoute un souvenir au journal, une seule fois par clé de dédoublonnage. */
  remember(
    kind: JournalEntry['kind'],
    key: string,
    now: number,
    params?: JournalEntry['params'],
    once?: string,
  ): boolean;
}

export type GameStore = GameState & GameActions;

export const useGame = create<GameStore>((set, get) => ({
  ...newGame(Date.now()),
  replace: (state) => set({ ...state }),
  addJournal: (entry) => set((s) => ({ journal: [entry, ...s.journal].slice(0, 500) })),
  discoverVariety: (koi, at) => {
    const v = express(koi.genome).variety;
    const s = get();
    if (s.discovered.varieties.includes(v)) return;
    set({
      discovered: { ...s.discovered, varieties: [...s.discovered.varieties, v] },
      journal: [
        journalEntry('discovery', 'variety', at, { variety: v, name: koi.name }),
        ...s.journal,
      ],
    });
  },
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
  addPetals: (n) =>
    set((s) => ({ petals: s.petals + n, petalsEarned: s.petalsEarned + Math.max(0, n) })),
  canAfford: (kind) => {
    const s = get();
    const e = CATALOG[kind];
    return e.grows ? (s.seeds[kind] ?? 0) > 0 : s.petals >= e.cost;
  },
  placeObject: (kind, x, y, now) => {
    const s = get();
    if (!s.canAfford(kind)) return null;
    const e = CATALOG[kind];
    const o = newObject(kind, x, y, now, Math.floor(Math.random() * 1e9));
    set({
      objects: [...s.objects, o],
      seeds: e.grows ? { ...s.seeds, [kind]: (s.seeds[kind] ?? 0) - 1 } : s.seeds,
      petals: e.grows ? s.petals : s.petals - e.cost,
      discovered: s.discovered.species.includes(kind)
        ? s.discovered
        : { ...s.discovered, species: [...s.discovered.species, kind] },
    });
    return o;
  },
  moveObject: (id, x, y) =>
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, x, y } : o)) })),
  removeObject: (id) =>
    set((s) => {
      const o = s.objects.find((x) => x.id === id);
      if (!o) return {};
      const e = CATALOG[o.kind];
      return {
        objects: s.objects.filter((x) => x.id !== id),
        // Rien ne se perd : la graine revient, ou la moitié des pétales.
        seeds: e.grows ? { ...s.seeds, [o.kind]: (s.seeds[o.kind] ?? 0) + 1 } : s.seeds,
        petals: e.grows ? s.petals : s.petals + Math.floor(e.cost / 2),
      };
    }),
  waterObjects: (ids, amount, now) =>
    set((s) => ({
      objects: s.objects.map((o) => (ids.includes(o.id) ? water(o, amount, now) : o)),
      stats: { ...s.stats, watered: s.stats.watered + ids.length },
    })),
  pruneObject: (id) => {
    const s = get();
    const o = s.objects.find((x) => x.id === id);
    if (!o) return false;
    const next = prune(o);
    if (next === o) return false;
    set({
      objects: s.objects.map((x) => (x.id === id ? next : x)),
      stats: { ...s.stats, pruned: s.stats.pruned + 1 },
      petals: s.petals + 1,
      petalsEarned: s.petalsEarned + 1,
    });
    return true;
  },
  harvestObject: (id, now, day) => {
    const s = get();
    const o = s.objects.find((x) => x.id === id);
    if (!o || !canHarvest(o, now)) return null;
    const petals = harvestYield(o, day);
    const rng = mulberry32(Math.floor(now / 1000) ^ o.seed);
    const seed: CatalogId | null = rng() < 0.25 ? o.kind : null;
    set({
      objects: s.objects.map((x) =>
        x.id === id ? { ...x, harvestAt: now + HARVEST_INTERVAL } : x,
      ),
      petals: s.petals + petals,
      petalsEarned: s.petalsEarned + petals,
      seeds: seed ? { ...s.seeds, [seed]: (s.seeds[seed] ?? 0) + 1 } : s.seeds,
    });
    return { petals, seed };
  },
  completeObjective: (id, now) => {
    const s = get();
    if (s.objectives[id]) return null;
    const o = objective(id);
    set({
      objectives: { ...s.objectives, [id]: now },
      petals: s.petals + o.reward,
      petalsEarned: s.petalsEarned + o.reward,
      seeds: o.seed ? { ...s.seeds, [o.seed]: (s.seeds[o.seed] ?? 0) + 1 } : s.seeds,
      journal: [journalEntry('objective', 'objective', now, { id }), ...s.journal].slice(0, 500),
    });
    return o.reward;
  },
  claimDaily: (now) => {
    const s = get();
    const gift = dailyGift(s.daily, now, s.petalsEarned, Math.floor(now / 86_400_000));
    if (!gift) return null;
    set({
      daily: { lastDay: gift.day, streak: gift.streak },
      petals: s.petals + gift.petals,
      petalsEarned: s.petalsEarned + gift.petals,
      seeds: { ...s.seeds, [gift.seed]: (s.seeds[gift.seed] ?? 0) + 1 },
      journal: [journalEntry('memory', 'daily', now, { n: gift.streak }), ...s.journal].slice(
        0,
        500,
      ),
    });
    return gift;
  },
  unlockZone: (id, now) => {
    const s = get();
    const z = ZONES.find((x) => x.id === id);
    if (!z || s.zones.includes(id) || s.petalsEarned < z.unlockAt || s.petals < z.cost)
      return false;
    set({
      zones: [...s.zones, id],
      petals: s.petals - z.cost,
      journal: [journalEntry('unlock', 'unlock', now, { zone: id }), ...s.journal].slice(0, 500),
    });
    return true;
  },
  remember: (kind, key, now, params, once) => {
    const s = get();
    if (once && s.discovered.events.includes(once)) return false;
    set({
      journal: [journalEntry(kind, key, now, params), ...s.journal].slice(0, 500),
      discovered: once
        ? { ...s.discovered, events: [...s.discovered.events, once].slice(-400) }
        : s.discovered,
    });
    return true;
  },
  setSand: (data, w, h) =>
    set((s) => ({ sand: { w, h, data }, stats: { ...s.stats, raked: s.stats.raked + 1 } })),
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
    seeds: s.seeds,
    objects: s.objects,
    kois: s.kois,
    zones: s.zones,
    discovered: s.discovered,
    journal: s.journal,
    objectives: s.objectives,
    daily: s.daily,
    sand: s.sand,
    tutorial: s.tutorial,
    weatherMemory: s.weatherMemory,
    stats: s.stats,
  };
}
