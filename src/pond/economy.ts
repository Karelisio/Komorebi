import type { DecorBonus } from '@/garden/decor';
import { express } from './genetics';
import { koiSize, type KoiRecord } from './koi';

export const HOUR = 3_600_000;

/** Heures de production accumulées au plus pendant l'absence (il faut revenir récolter). */
export const PENDING_CAP_HOURS = 8;

export type UpgradeId = 'pond' | 'food' | 'charm';

export interface Upgrades {
  /** Taille du bassin : plus de koïs. */
  pond: number;
  /** Qualité de la nourriture : croissance plus rapide. */
  food: number;
  /** Charme du jardin : plus de pétales. */
  charm: number;
}

export const UPGRADE_MAX: Record<UpgradeId, number> = { pond: 5, food: 5, charm: 5 };
const UPGRADE_BASE: Record<UpgradeId, number> = { pond: 80, food: 50, charm: 100 };

export function upgradeCost(id: UpgradeId, level: number): number {
  return Math.round((UPGRADE_BASE[id] * Math.pow(2.3, level)) / 5) * 5;
}

/** Nombre de koïs que le bassin accueille. */
export function pondCapacity(u: Upgrades): number {
  return 6 + u.pond * 3;
}

/** Multiplicateur de production selon la rareté (1 à 5 étoiles). */
export const RARITY_MULT = [1, 1, 1.6, 2.5, 4, 6.5] as const;

/** Pétales par heure d'un koï : grandit avec sa taille et sa rareté ; un koï affamé produit moitié moins. */
export function koiRate(k: KoiRecord, now: number): number {
  const size = koiSize(k, now);
  const rarity = express(k.genome).rarity;
  const hunger = k.satiety < 0.25 ? 0.5 : 1;
  return 4 * (0.3 + 0.7 * size) * (RARITY_MULT[Math.max(1, Math.min(5, rarity))] ?? 1) * hunger;
}

/** Production totale du bassin (pétales / heure). */
export function pondRate(
  kois: readonly KoiRecord[],
  now: number,
  u: Upgrades,
  bonus: DecorBonus,
  night: boolean,
): number {
  const base = kois.reduce((s, k) => s + koiRate(k, now), 0);
  const mult = 1 + u.charm * 0.2 + bonus.petals + (night ? bonus.nightPetals : 0);
  return base * mult;
}

/** Accumule la production en attente, plafonnée. */
export function accrue(pending: number, ratePerHour: number, dtMs: number): number {
  const cap = ratePerHour * PENDING_CAP_HOURS;
  if (pending >= cap) return pending;
  return Math.min(cap, pending + (ratePerHour * dtMs) / HOUR);
}

/** Croissance par heure (fraction de la vie d'alevin à adulte accompli). */
export function growthPerHour(k: KoiRecord, u: Upgrades, bonus: DecorBonus): number {
  // ~2 jours pour un alevin bien nourri sans amélioration
  const fed = 0.35 + 0.65 * k.satiety;
  return (1 / 48) * fed * (1 + u.food * 0.3 + bonus.growth);
}

/** Niveau du jardin : nombre de quêtes réussies nécessaires pour passer au niveau suivant. */
export function questsForLevel(level: number): number {
  return 2 + Math.floor(level * 0.75);
}

/** Récompense de découverte d'une nouvelle variété. */
export function discoveryReward(rarity: number): number {
  return 10 * rarity * rarity;
}
