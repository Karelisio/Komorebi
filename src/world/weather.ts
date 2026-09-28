import { APP_CONFIG } from '@/config/app';
import { clamp, dayOfYear, lerp } from './math';
import { hash, mulberry32 } from './random';
import type { WeatherKind, WeatherState } from './weatherTypes';

/** Une heure de météo (réelle ou simulée). */
export interface WeatherHour {
  time: number;
  code: number;
  temperature: number;
  precipitation: number;
  snowfall: number;
  cloudCover: number;
  wind: number;
  windDir: number;
}

export interface WeatherMemory {
  lastRainAt: number;
  snowCover: number;
  wetness: number;
}

/** Codes météo WMO → catégorie du jeu. */
export function kindFromCode(code: number, precipitation = 0, cloudCover = 0): WeatherKind {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return precipitation > 0 && precipitation < 0.5 ? 'drizzle' : 'rain';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3 || cloudCover > 85) return 'overcast';
  if (code === 2 || cloudCover > 40) return 'cloudy';
  return 'clear';
}

export function stateFromHour(
  h: WeatherHour,
  memory: WeatherMemory,
  source: WeatherState['source'],
  now: number,
): WeatherState {
  const kind = kindFromCode(h.code, h.precipitation, h.cloudCover);
  const snowing = kind === 'snow';
  return {
    kind,
    cloudCover: h.cloudCover,
    rain: snowing
      ? 0
      : Math.max(
          h.precipitation,
          kind === 'drizzle' ? 0.3 : kind === 'rain' || kind === 'storm' ? 1.5 : 0,
        ),
    snow: snowing ? Math.max(h.snowfall, 0.5) : 0,
    wind: h.wind,
    windDir: h.windDir,
    fog: kind === 'fog' ? 0.7 : 0,
    temperature: h.temperature,
    thunder: kind === 'storm',
    hoursSinceRain: memory.lastRainAt ? Math.max(0, (now - memory.lastRainAt) / 3_600_000) : 72,
    snowCover: memory.snowCover,
    wetness: memory.wetness,
    source,
    updatedAt: now,
  };
}

/** Évolution horaire de la mémoire météo (neige au sol, sol mouillé). */
export function accumulate(m: WeatherMemory, h: WeatherHour): WeatherMemory {
  const kind = kindFromCode(h.code, h.precipitation, h.cloudCover);
  const raining = kind === 'rain' || kind === 'drizzle' || kind === 'storm';
  let snowCover = m.snowCover;
  if (kind === 'snow') snowCover += 0.12 + h.snowfall * 0.1;
  else if (h.temperature > 1) snowCover -= (h.temperature / 10) * 0.08 + (raining ? 0.1 : 0);
  let wetness = m.wetness;
  wetness = raining ? wetness + 0.4 : wetness - (h.temperature > 20 ? 0.12 : 0.06);
  return {
    lastRainAt: raining ? h.time : m.lastRainAt,
    snowCover: clamp(snowCover),
    wetness: clamp(wetness),
  };
}

/* ───────────── Météo simulée (hors ligne) ───────────── */

interface Climate {
  /** Température moyenne par mois (°C). */
  temp: number[];
  /** Probabilité de pluie par tranche de 6 h, par mois. */
  rain: number[];
}

/** Climat tempéré de montagne (proche de Grenoble). */
const TEMPERATE: Climate = {
  temp: [2.5, 4, 8, 11, 15.5, 19.5, 22, 21.5, 17.5, 12.5, 6.5, 3],
  rain: [0.22, 0.2, 0.22, 0.26, 0.3, 0.26, 0.2, 0.22, 0.24, 0.28, 0.28, 0.24],
};

function blockNoise(seed: number, block: number): number {
  return mulberry32(hash(seed, block))();
}

/** Bruit continu dans le temps (interpolation entre blocs de 6 h). */
function smoothNoise(seed: number, hours: number, blockHours = 6): number {
  const b = Math.floor(hours / blockHours);
  const t = hours / blockHours - b;
  const s = t * t * (3 - 2 * t);
  return lerp(blockNoise(seed, b), blockNoise(seed, b + 1), s);
}

/** Heure de météo plausible et déterministe pour un lieu et un instant donnés. */
export function simulateHour(time: number, lat: number, lon: number): WeatherHour {
  const d = new Date(time);
  let month = d.getUTCMonth();
  if (lat < 0) month = (month + 6) % 12;
  const seed = hash(Math.round(lat * 10), Math.round(lon * 10));
  const hours = time / 3_600_000;
  const localHour = (d.getUTCHours() + lon / 15 + 24) % 24;
  const climate = TEMPERATE;
  const next = (month + 1) % 12;
  const mt = d.getUTCDate() / 31;
  const baseTemp = lerp(climate.temp[month]!, climate.temp[next]!, mt);
  const diurnal = Math.cos(((localHour - 15) / 24) * Math.PI * 2) * 5;
  const drift = (smoothNoise(seed + 7, hours, 24) - 0.5) * 8;
  const temperature = baseTemp + diurnal + drift;

  const wetness = smoothNoise(seed + 1, hours);
  const pRain = climate.rain[month]!;
  const cloud = clamp(smoothNoise(seed + 2, hours, 8) * 1.1 + wetness * 0.4 - 0.2) * 100;
  const precipitating = wetness > 1 - pRain;
  const intensity = precipitating ? (wetness - (1 - pRain)) / pRain : 0;
  const precipitation = precipitating ? 0.2 + intensity * 5 : 0;
  const wind = 4 + smoothNoise(seed + 3, hours, 4) * 18 + intensity * 12;
  const foggy =
    !precipitating &&
    cloud > 60 &&
    (localHour < 9 || localHour > 21) &&
    smoothNoise(seed + 4, hours) > 0.75;
  const stormy = precipitating && intensity > 0.75 && temperature > 16;

  let code = cloud > 85 ? 3 : cloud > 40 ? 2 : cloud > 15 ? 1 : 0;
  let snowfall = 0;
  if (foggy) code = 45;
  if (precipitating) {
    if (temperature < 1) {
      code = 73;
      snowfall = precipitation * 0.7;
    } else code = stormy ? 95 : precipitation < 0.5 ? 51 : 63;
  }
  return {
    time,
    code,
    temperature: Math.round(temperature * 10) / 10,
    precipitation: temperature < 1 ? 0 : precipitation,
    snowfall,
    cloudCover: Math.round(precipitating ? Math.max(cloud, 85) : cloud),
    wind: Math.round(wind),
    windDir: Math.round(smoothNoise(seed + 5, hours, 12) * 360),
  };
}

/* ───────────── Open-Meteo ───────────── */

interface OpenMeteoResponse {
  hourly?: {
    time: number[];
    temperature_2m: number[];
    precipitation: number[];
    snowfall: number[];
    weather_code: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
}

export function parseOpenMeteo(json: OpenMeteoResponse): WeatherHour[] {
  const h = json.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error('réponse météo invalide');
  return h.time.map((t, i) => ({
    time: t * 1000,
    code: h.weather_code[i] ?? 0,
    temperature: h.temperature_2m[i] ?? 15,
    precipitation: h.precipitation[i] ?? 0,
    snowfall: h.snowfall[i] ?? 0,
    cloudCover: h.cloud_cover[i] ?? 0,
    wind: h.wind_speed_10m[i] ?? 0,
    windDir: h.wind_direction_10m[i] ?? 0,
  }));
}

export async function fetchForecast(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<WeatherHour[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    hourly:
      'temperature_2m,precipitation,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    past_days: '2',
    forecast_days: '3',
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  const res = await fetch(`${APP_CONFIG.weather.endpoint}?${params.toString()}`, {
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`météo HTTP ${res.status}`);
  return parseOpenMeteo((await res.json()) as OpenMeteoResponse);
}

/** Heure la plus proche dans une série, si elle couvre l'instant (±1 h). */
export function hourAt(series: readonly WeatherHour[], time: number): WeatherHour | null {
  let best: WeatherHour | null = null;
  let bd = Infinity;
  for (const h of series) {
    const d = Math.abs(h.time - time);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best && bd <= 3_600_000 ? best : null;
}

/** Météo d'une heure : prévisions en cache si elles couvrent l'instant, sinon simulation. */
export function weatherHour(
  series: readonly WeatherHour[],
  time: number,
  lat: number,
  lon: number,
): { hour: WeatherHour; simulated: boolean } {
  const h = hourAt(series, time);
  return h
    ? { hour: h, simulated: false }
    : { hour: simulateHour(time, lat, lon), simulated: true };
}

export function seasonHintDay(time: number): number {
  return dayOfYear(new Date(time));
}
