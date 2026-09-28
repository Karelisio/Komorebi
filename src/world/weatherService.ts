import { Preferences } from '@capacitor/preferences';
import { APP_CONFIG } from '@/config/app';
import type { GeoLocation } from './location';
import {
  fetchForecast,
  stateFromHour,
  weatherHour,
  type WeatherHour,
  type WeatherMemory,
} from './weather';
import type { WeatherState } from './weatherTypes';

const KEY = 'komorebi.weather';

interface Cache {
  fetchedAt: number;
  lat: number;
  lon: number;
  series: WeatherHour[];
}

let cache: Cache | null = null;
let inflight: Promise<void> | null = null;

export async function loadWeatherCache(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) cache = JSON.parse(value) as Cache;
  } catch {
    cache = null;
  }
}

export function weatherSeries(): readonly WeatherHour[] {
  return cache?.series ?? [];
}

/** Rafraîchit les prévisions si le cache est périmé (ou d'un autre lieu). */
export function refreshWeather(loc: GeoLocation, now = Date.now(), force = false): Promise<void> {
  const stale =
    !cache ||
    now - cache.fetchedAt > APP_CONFIG.weather.cacheMs ||
    Math.abs(cache.lat - loc.lat) > 0.3 ||
    Math.abs(cache.lon - loc.lon) > 0.3;
  if (!stale && !force) return Promise.resolve();
  if (inflight) return inflight;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  inflight = fetchForecast(loc.lat, loc.lon, ctrl.signal)
    .then(async (series) => {
      cache = { fetchedAt: now, lat: loc.lat, lon: loc.lon, series };
      await Preferences.set({ key: KEY, value: JSON.stringify(cache) }).catch(() => undefined);
    })
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timer);
      inflight = null;
    });
  return inflight;
}

/** Météo courante : réelle si disponible, sinon simulée. */
export function currentWeather(
  time: number,
  loc: GeoLocation,
  memory: WeatherMemory,
): WeatherState {
  const { hour, simulated } = weatherHour(weatherSeries(), time, loc.lat, loc.lon);
  const fresh = cache && Date.now() - cache.fetchedAt < APP_CONFIG.weather.cacheMs * 2;
  return stateFromHour(hour, memory, simulated ? 'simulated' : fresh ? 'live' : 'cache', time);
}
