import { stepObjectHour } from '@/garden/growth';
import { stepPondHour } from '@/pond/koi';
import { journalEntry } from '@/state/game';
import type { GameState, JournalEntry } from '@/state/types';
import type { KoiRecord } from '@/pond/koi';
import { computeSeason } from '@/world/season';
import { accumulate, kindFromCode, weatherHour, type WeatherHour } from '@/world/weather';
import { hash } from '@/world/random';
import { MAIN_POND, SECOND_POND } from '@/world/layout';

const HOUR = 3_600_000;
export const MAX_OFFLINE_MS = 30 * 24 * HOUR;

export interface AbsenceSummary {
  hours: number;
  grew: number;
  rainedHours: number;
  snowedHours: number;
  births: KoiRecord[];
}

export const POND_CAPACITY: Record<string, number> = { [MAIN_POND.id]: 14, [SECOND_POND.id]: 9 };

/**
 * Simule le jardin heure par heure entre `lastSimAt` et `now` : croissance, eau, météo
 * (prévisions en cache ou simulée), faim et naissances des koïs. Déterministe.
 */
export function simulateAbsence(
  state: GameState,
  now: number,
  loc: { lat: number; lon: number },
  series: readonly WeatherHour[],
): { state: GameState; summary: AbsenceSummary } {
  const start = Math.max(state.lastSimAt, now - MAX_OFFLINE_MS);
  const hours = Math.floor((now - start) / HOUR);
  const summary: AbsenceSummary = { hours, grew: 0, rainedHours: 0, snowedHours: 0, births: [] };
  if (hours <= 0) return { state, summary };

  let objects = state.objects;
  let kois = state.kois;
  let memory = state.weatherMemory;
  const journal: JournalEntry[] = [];
  const growthBefore = new Map(objects.map((o) => [o.id, o.growth]));
  const ponds = [MAIN_POND.id, ...(state.zones.includes('second-pond') ? [SECOND_POND.id] : [])];

  for (let h = 1; h <= hours; h++) {
    const t = start + h * HOUR;
    const { hour } = weatherHour(series, t, loc.lat, loc.lon);
    memory = accumulate(memory, hour);
    const kind = kindFromCode(hour.code, hour.precipitation, hour.cloudCover);
    if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') summary.rainedHours++;
    if (kind === 'snow') summary.snowedHours++;
    const season = computeSeason(new Date(t), loc.lat);
    const cond = {
      season: season.season,
      day: season.day,
      rain: kind === 'snow' ? 0 : hour.precipitation,
      temperature: hour.temperature,
      snow: hour.snowfall,
    };
    objects = objects.map((o) => stepObjectHour(o, cond));
    for (const pondId of ponds) {
      const res = stepPondHour(kois, {
        pondId,
        capacity: POND_CAPACITY[pondId] ?? 10,
        season: season.season,
        now: t,
        seed: hash('pond', pondId, Math.floor(t / HOUR)),
      });
      kois = res.kois;
      if (res.births.length) {
        summary.births.push(...res.births);
        const first = res.births[0]!;
        const [a, b] = first.parents ?? ['', ''];
        journal.push(
          journalEntry('birth', 'birth', t, {
            n: res.births.length,
            a: kois.find((k) => k.id === a)?.name ?? '?',
            b: kois.find((k) => k.id === b)?.name ?? '?',
          }),
        );
      }
    }
  }
  summary.grew = objects.filter(
    (o) => o.growth - (growthBefore.get(o.id) ?? o.growth) > 0.05,
  ).length;
  return {
    state: {
      ...state,
      objects,
      kois,
      weatherMemory: memory,
      lastSimAt: start + hours * HOUR,
      journal: [...journal.reverse(), ...state.journal].slice(0, 500),
    },
    summary,
  };
}
