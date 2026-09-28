import { create } from 'zustand';
import type { CatalogId } from '@/garden/catalog';
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
    obj('lantern', 905, 1060),
    obj('rock', 300, 1010),
    obj('stone', 345, 1030),
    obj('stone', 880, 1400),
    obj('stepping', 620, 1480),
    obj('stepping', 660, 1540),
    obj('stepping', 630, 1600),
    obj('moss', 250, 1080),
    obj('fern', 960, 1120),
    obj('azalea', 420, 960, 0.7),
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

interface GameActions {
  replace(state: GameState): void;
  addJournal(entry: JournalEntry): void;
  discoverVariety(koi: KoiRecord, at: number): void;
  onKoiAte(koiId: string): void;
  renameKoi(id: string, name: string): void;
  toggleFavorite(id: string): void;
  addPetals(n: number): void;
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
