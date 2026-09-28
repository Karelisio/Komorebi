import type { TreeSpecies } from '@/render/trees';

export type Category = 'tree' | 'plant' | 'stone' | 'decor' | 'water';

export type CatalogId =
  | 'maple'
  | 'cherry'
  | 'pine'
  | 'bamboo'
  | 'moss'
  | 'fern'
  | 'azalea'
  | 'hydrangea'
  | 'iris'
  | 'camellia'
  | 'chrysanthemum'
  | 'stone'
  | 'rock'
  | 'stepping'
  | 'lantern'
  | 'lantern-yukimi'
  | 'bridge'
  | 'stream'
  | 'tsukubai'
  | 'bench'
  | 'pagoda';

export interface CatalogEntry {
  id: CatalogId;
  category: Category;
  /** Pousse depuis une graine (sinon, s'achète en pétales). */
  grows: boolean;
  /** Durée pour atteindre la maturité, en jours réels. */
  growthDays: number;
  /** Nombre de stades visibles. */
  stages: number;
  /** Coût en pétales (objets) — 0 pour les plantes (graines). */
  cost: number;
  /** Rayon d'emprise au sol (unités monde). */
  radius: number;
  /** Hauteur adulte (unités monde), pour le rendu. */
  height: number;
  tree?: TreeSpecies;
  /** Floraison : jour de l'année du pic et demi-largeur (hémisphère nord). */
  bloom?: { peak: number; width: number; color: string };
  /** Palier de déblocage (nombre de pétales récoltés au total). */
  unlockAt: number;
  /** Se place sur l'eau. */
  onWater?: boolean;
}

const E = (e: CatalogEntry): CatalogEntry => e;

export const CATALOG: Record<CatalogId, CatalogEntry> = {
  maple: E({
    id: 'maple',
    category: 'tree',
    grows: true,
    growthDays: 6,
    stages: 5,
    cost: 0,
    radius: 40,
    height: 300,
    tree: 'maple',
    unlockAt: 0,
  }),
  cherry: E({
    id: 'cherry',
    category: 'tree',
    grows: true,
    growthDays: 7,
    stages: 5,
    cost: 0,
    radius: 42,
    height: 300,
    tree: 'cherry',
    bloom: { peak: 95, width: 16, color: '#f3c1cf' },
    unlockAt: 0,
  }),
  pine: E({
    id: 'pine',
    category: 'tree',
    grows: true,
    growthDays: 9,
    stages: 5,
    cost: 0,
    radius: 40,
    height: 260,
    tree: 'pine',
    unlockAt: 60,
  }),
  bamboo: E({
    id: 'bamboo',
    category: 'tree',
    grows: true,
    growthDays: 4,
    stages: 4,
    cost: 0,
    radius: 36,
    height: 320,
    tree: 'bamboo',
    unlockAt: 120,
  }),
  moss: E({
    id: 'moss',
    category: 'plant',
    grows: true,
    growthDays: 2,
    stages: 3,
    cost: 0,
    radius: 34,
    height: 12,
    unlockAt: 0,
  }),
  fern: E({
    id: 'fern',
    category: 'plant',
    grows: true,
    growthDays: 3,
    stages: 3,
    cost: 0,
    radius: 26,
    height: 50,
    unlockAt: 0,
  }),
  azalea: E({
    id: 'azalea',
    category: 'plant',
    grows: true,
    growthDays: 4,
    stages: 4,
    cost: 0,
    radius: 30,
    height: 60,
    bloom: { peak: 130, width: 22, color: '#e8638a' },
    unlockAt: 30,
  }),
  hydrangea: E({
    id: 'hydrangea',
    category: 'plant',
    grows: true,
    growthDays: 4,
    stages: 4,
    cost: 0,
    radius: 30,
    height: 70,
    bloom: { peak: 180, width: 30, color: '#7f9fe0' },
    unlockAt: 90,
  }),
  iris: E({
    id: 'iris',
    category: 'plant',
    grows: true,
    growthDays: 3,
    stages: 3,
    cost: 0,
    radius: 20,
    height: 70,
    bloom: { peak: 160, width: 18, color: '#6a5acd' },
    unlockAt: 45,
  }),
  camellia: E({
    id: 'camellia',
    category: 'plant',
    grows: true,
    growthDays: 5,
    stages: 4,
    cost: 0,
    radius: 30,
    height: 90,
    bloom: { peak: 40, width: 40, color: '#d23c4a' },
    unlockAt: 150,
  }),
  chrysanthemum: E({
    id: 'chrysanthemum',
    category: 'plant',
    grows: true,
    growthDays: 3,
    stages: 3,
    cost: 0,
    radius: 22,
    height: 45,
    bloom: { peak: 295, width: 26, color: '#f0c24a' },
    unlockAt: 200,
  }),
  stone: E({
    id: 'stone',
    category: 'stone',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 5,
    radius: 22,
    height: 20,
    unlockAt: 0,
  }),
  rock: E({
    id: 'rock',
    category: 'stone',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 20,
    radius: 40,
    height: 50,
    unlockAt: 20,
  }),
  stepping: E({
    id: 'stepping',
    category: 'stone',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 8,
    radius: 20,
    height: 4,
    unlockAt: 0,
  }),
  lantern: E({
    id: 'lantern',
    category: 'decor',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 40,
    radius: 22,
    height: 90,
    unlockAt: 40,
  }),
  'lantern-yukimi': E({
    id: 'lantern-yukimi',
    category: 'decor',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 70,
    radius: 30,
    height: 70,
    unlockAt: 160,
  }),
  bridge: E({
    id: 'bridge',
    category: 'water',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 120,
    radius: 70,
    height: 40,
    unlockAt: 250,
    onWater: true,
  }),
  stream: E({
    id: 'stream',
    category: 'water',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 90,
    radius: 60,
    height: 4,
    unlockAt: 180,
  }),
  tsukubai: E({
    id: 'tsukubai',
    category: 'water',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 60,
    radius: 26,
    height: 40,
    unlockAt: 100,
  }),
  bench: E({
    id: 'bench',
    category: 'decor',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 45,
    radius: 34,
    height: 30,
    unlockAt: 80,
  }),
  pagoda: E({
    id: 'pagoda',
    category: 'decor',
    grows: false,
    growthDays: 0,
    stages: 1,
    cost: 150,
    radius: 26,
    height: 110,
    unlockAt: 320,
  }),
};

export const CATALOG_IDS = Object.keys(CATALOG) as CatalogId[];

/** Zones à débloquer (pétales récoltés au total). */
export const ZONES = [
  { id: 'second-pond', unlockAt: 300, cost: 200 },
  { id: 'waterfall', unlockAt: 500, cost: 300 },
  { id: 'tea-house', unlockAt: 800, cost: 450 },
] as const;
export type ZoneId = (typeof ZONES)[number]['id'];
