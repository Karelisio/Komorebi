import type { CatalogId, ZoneId } from '@/garden/catalog';
import type { KoiRecord } from '@/pond/koi';

export interface GardenObject {
  id: string;
  kind: CatalogId;
  x: number;
  y: number;
  seed: number;
  placedAt: number;
  /** Eau 0..1 (plantes uniquement). */
  water: number;
  lastWateredAt: number;
  /** Intensité de taille 0..1 (arbres). */
  prune: number;
  pruneCount: number;
  /** Croissance accumulée 0..1 (avance seulement si la plante a de l'eau). */
  growth: number;
  flip: boolean;
  /** Prochaine récolte possible (ms). */
  harvestAt: number;
}

export type JournalKind =
  'event' | 'birth' | 'bloom' | 'discovery' | 'unlock' | 'memory' | 'objective' | 'weather';

export interface JournalEntry {
  id: string;
  at: number;
  kind: JournalKind;
  key: string;
  params?: Record<string, string | number>;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Dernier instant simulé (temps de jeu). */
  lastSimAt: number;
  petals: number;
  /** Total récolté depuis le début (sert aux déblocages). */
  petalsEarned: number;
  seeds: Partial<Record<CatalogId, number>>;
  objects: GardenObject[];
  kois: KoiRecord[];
  zones: ZoneId[];
  discovered: { varieties: string[]; species: string[]; events: string[] };
  journal: JournalEntry[];
  objectives: Record<string, number>;
  daily: { lastDay: string; streak: number };
  /** Motif du sable : niveaux de gris encodés en base64 (RLE). */
  sand: { w: number; h: number; data: string };
  tutorial: { step: number; done: boolean };
  weatherMemory: { lastRainAt: number; snowCover: number; wetness: number };
  stats: {
    fed: number;
    watered: number;
    raked: number;
    photos: number;
    breaths: number;
    meditationMin: number;
    pruned: number;
  };
}
