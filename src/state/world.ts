import { create } from 'zustand';
import type { NatureActivity } from '@/world/events';
import type { GeoLocation } from '@/world/location';
import { FALLBACK_LOCATION } from '@/world/location';
import type { SeasonState } from '@/world/season';
import type { Lighting, SkyState } from '@/world/sky';

/** Instantané de l'environnement, rafraîchi par le moteur (~1 Hz). */
export interface WorldSnapshot {
  time: number;
  location: GeoLocation;
  sky: SkyState | null;
  lighting: Lighting | null;
  season: SeasonState | null;
  nature: NatureActivity | null;
}

export const useWorld = create<WorldSnapshot>(() => ({
  time: Date.now(),
  location: FALLBACK_LOCATION,
  sky: null,
  lighting: null,
  season: null,
  nature: null,
}));
