import type { SeasonState } from './season';
import type { SkyState } from './sky';
import { clamp, dayDistance, dayOfYear } from './math';

export interface MeteorShower {
  id: 'quadrantids' | 'lyrids' | 'eta-aquariids' | 'perseids' | 'orionids' | 'leonids' | 'geminids';
  /** Mois (1-12) et jour du pic. */
  peakMonth: number;
  peakDay: number;
  /** Demi-largeur de la période active, en jours. */
  halfWidth: number;
  /** Taux zénithal horaire approximatif (intensité relative). */
  zhr: number;
}

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  { id: 'quadrantids', peakMonth: 1, peakDay: 3, halfWidth: 2, zhr: 110 },
  { id: 'lyrids', peakMonth: 4, peakDay: 22, halfWidth: 3, zhr: 18 },
  { id: 'eta-aquariids', peakMonth: 5, peakDay: 6, halfWidth: 4, zhr: 40 },
  { id: 'perseids', peakMonth: 8, peakDay: 12, halfWidth: 6, zhr: 100 },
  { id: 'orionids', peakMonth: 10, peakDay: 21, halfWidth: 4, zhr: 20 },
  { id: 'leonids', peakMonth: 11, peakDay: 17, halfWidth: 3, zhr: 15 },
  { id: 'geminids', peakMonth: 12, peakDay: 14, halfWidth: 5, zhr: 150 },
];

function peakDayOfYear(s: MeteorShower, year: number): number {
  return dayOfYear(new Date(Date.UTC(year, s.peakMonth - 1, s.peakDay)));
}

/** Pluie d'étoiles filantes active à cette date, avec intensité 0..1. */
export function activeMeteorShower(date: Date): { shower: MeteorShower; intensity: number } | null {
  const day = dayOfYear(date);
  let best: { shower: MeteorShower; intensity: number } | null = null;
  for (const s of METEOR_SHOWERS) {
    const d = dayDistance(day, peakDayOfYear(s, date.getUTCFullYear()));
    if (d > s.halfWidth) continue;
    const intensity = clamp((1 - d / (s.halfWidth + 1)) * Math.min(1, s.zhr / 100));
    if (!best || intensity > best.intensity) best = { shower: s, intensity };
  }
  return best;
}

/** Prochaine pluie d'étoiles filantes à venir (pour les notifications). */
export function nextMeteorShowerPeak(from: Date): { shower: MeteorShower; date: Date } {
  const candidates = METEOR_SHOWERS.flatMap((s) =>
    [from.getUTCFullYear(), from.getUTCFullYear() + 1].map((y) => ({
      shower: s,
      date: new Date(Date.UTC(y, s.peakMonth - 1, s.peakDay, 21)),
    })),
  ).filter((c) => c.date.getTime() > from.getTime());
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = candidates[0];
  if (!first) throw new Error('aucune pluie trouvée');
  return first;
}

export interface WeatherHint {
  /** Précipitation actuelle (mm/h). */
  rain: number;
  /** Heures depuis la dernière pluie (Infinity si inconnue). */
  hoursSinceRain: number;
  temperature: number;
  cloudCover: number;
}

export interface NatureActivity {
  fireflies: number;
  birds: number;
  frogs: number;
  crickets: number;
  meteors: number;
  cicadas: number;
}

/** Activité de la faune selon l'heure, la saison et la météo (valeurs 0..1). */
export function natureActivity(
  date: Date,
  sky: SkyState,
  season: SeasonState,
  weather: WeatherHint,
): NatureActivity {
  const raining = weather.rain > 0.2;
  const dark = sky.sunAltitude < -4;
  const warm = clamp((weather.temperature - 8) / 10);
  const clear = 1 - clamp(weather.cloudCover / 100);
  const shower = activeMeteorShower(date);

  const fireflies = dark && !raining ? season.fireflies * warm : 0;
  // Chœur de l'aube : altitude -6° → +20°, plus fort au printemps.
  const dawnChorus = sky.morning && sky.sunAltitude > -6 && sky.sunAltitude < 25 ? 1 : 0;
  const dayBirds = sky.sunAltitude > 0 ? 0.35 : 0;
  const birds = raining
    ? 0.05
    : Math.max(dawnChorus, dayBirds) * (season.season === 'winter' ? 0.4 : 1);
  const afterRain = weather.hoursSinceRain < 12 || raining;
  const frogs =
    afterRain && sky.sunAltitude < 5 && season.season !== 'winter' ? clamp(0.3 + warm * 0.7) : 0;
  const crickets =
    dark && !raining && (season.season === 'summer' || season.season === 'autumn') ? warm : 0;
  const cicadas = season.season === 'summer' && sky.sunAltitude > 15 && !raining ? warm : 0;
  const meteors = shower && dark ? shower.intensity * clear : dark ? 0.04 * clear : 0;

  return { fireflies, birds, frogs, crickets, meteors, cicadas };
}
