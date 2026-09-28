import type { DecorId } from '@/garden/decor';
import type { Quest, QuestStats } from '@/garden/quests';
import type { Upgrades } from '@/pond/economy';
import type { Egg } from '@/pond/eggs';
import type { KoiRecord } from '@/pond/koi';

export type JournalKind =
  'event' | 'birth' | 'bloom' | 'discovery' | 'unlock' | 'memory' | 'objective' | 'weather';

export interface JournalEntry {
  id: string;
  at: number;
  kind: JournalKind;
  key: string;
  params?: Record<string, string | number>;
}

export interface GameStats extends QuestStats {
  photos: number;
  breaths: number;
  meditationMin: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Dernier instant simulé (temps de jeu). */
  lastSimAt: number;
  petals: number;
  /** Total récolté depuis le début. */
  petalsEarned: number;
  /** Pétales produits par les koïs, en attente de récolte (bulles sur l'eau). */
  pending: number;
  kois: KoiRecord[];
  /** Œufs en incubation dans le nid. */
  eggs: Egg[];
  /** Décor posé sur chaque emplacement de la berge. */
  decor: (DecorId | null)[];
  upgrades: Upgrades;
  /** Niveau du jardin (débloque décors, œufs, améliorations). */
  level: number;
  /** Quêtes réussies depuis le dernier niveau. */
  levelProgress: number;
  quests: Quest[];
  questSeq: number;
  discovered: { varieties: string[]; events: string[] };
  journal: JournalEntry[];
  daily: { lastDay: string; streak: number };
  tutorial: { step: number; done: boolean };
  weatherMemory: { lastRainAt: number; snowCover: number; wetness: number };
  stats: GameStats;
}
