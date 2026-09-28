import { advance } from '@/state/game';
import type { GameState } from '@/state/types';
import { accumulate, kindFromCode, weatherHour, type WeatherHour } from '@/world/weather';

const HOUR = 3_600_000;
export const MAX_OFFLINE_MS = 30 * 24 * HOUR;

export interface AbsenceSummary {
  hours: number;
  /** Pétales produits pendant l'absence (en attente de récolte). */
  petals: number;
  /** Koïs devenus adultes. */
  grown: number;
  /** Œufs prêts à éclore. */
  eggsReady: number;
  rainedHours: number;
  snowedHours: number;
}

/** Nuit approximative (heure locale) pour les bonus nocturnes pendant l'absence. */
function isNight(t: number): boolean {
  const h = new Date(t).getHours();
  return h >= 21 || h < 6;
}

/**
 * Simule le bassin heure par heure entre `lastSimAt` et `now` : production de pétales
 * (plafonnée), croissance et faim des koïs, météo (prévisions en cache ou simulée). Déterministe.
 */
export function simulateAbsence(
  state: GameState,
  now: number,
  loc: { lat: number; lon: number },
  series: readonly WeatherHour[],
): { state: GameState; summary: AbsenceSummary } {
  const start = Math.max(state.lastSimAt, now - MAX_OFFLINE_MS);
  const hours = Math.floor((now - start) / HOUR);
  const summary: AbsenceSummary = {
    hours,
    petals: 0,
    grown: 0,
    eggsReady: 0,
    rainedHours: 0,
    snowedHours: 0,
  };
  if (hours <= 0) return { state, summary };

  let s = state;
  let memory = state.weatherMemory;
  for (let h = 1; h <= hours; h++) {
    const t = start + h * HOUR;
    const { hour } = weatherHour(series, t, loc.lat, loc.lon);
    memory = accumulate(memory, hour);
    const kind = kindFromCode(hour.code, hour.precipitation, hour.cloudCover);
    if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') summary.rainedHours++;
    if (kind === 'snow') summary.snowedHours++;
    s = advance(s, HOUR, t, isNight(t));
  }
  summary.petals = Math.floor(s.pending - state.pending);
  summary.grown = s.stats.grown - state.stats.grown;
  summary.eggsReady = s.eggs.filter((e) => e.hatchAt <= now).length;
  return {
    state: { ...s, weatherMemory: memory, lastSimAt: start + hours * HOUR },
    summary,
  };
}
