export type WeatherKind =
  'clear' | 'cloudy' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow';

export interface WeatherState {
  kind: WeatherKind;
  /** Couverture nuageuse 0..100 %. */
  cloudCover: number;
  /** Pluie en mm/h. */
  rain: number;
  /** Neige en cm/h. */
  snow: number;
  /** Vent en km/h. */
  wind: number;
  /** Direction du vent (degrés, d'où il vient). */
  windDir: number;
  /** Brouillard 0..1. */
  fog: number;
  temperature: number;
  thunder: boolean;
  /** Heures depuis la dernière pluie. */
  hoursSinceRain: number;
  /** Neige au sol 0..1 (accumulée). */
  snowCover: number;
  /** Sol mouillé 0..1. */
  wetness: number;
  source: 'live' | 'cache' | 'simulated' | 'debug';
  updatedAt: number;
}

export const CLEAR_WEATHER: WeatherState = {
  kind: 'clear',
  cloudCover: 15,
  rain: 0,
  snow: 0,
  wind: 6,
  windDir: 270,
  fog: 0,
  temperature: 18,
  thunder: false,
  hoursSinceRain: 48,
  snowCover: 0,
  wetness: 0,
  source: 'simulated',
  updatedAt: 0,
};

/** Préréglages (debug et météo simulée). */
export function weatherPreset(kind: WeatherKind, temperature = 15): WeatherState {
  const base: WeatherState = {
    ...CLEAR_WEATHER,
    kind,
    temperature,
    source: 'debug',
    updatedAt: Date.now(),
  };
  switch (kind) {
    case 'clear':
      return { ...base, cloudCover: 10 };
    case 'cloudy':
      return { ...base, cloudCover: 55, wind: 12 };
    case 'overcast':
      return { ...base, cloudCover: 95, wind: 10 };
    case 'fog':
      return { ...base, cloudCover: 80, fog: 0.75, wind: 2 };
    case 'drizzle':
      return { ...base, cloudCover: 90, rain: 0.6, wetness: 0.6, hoursSinceRain: 0, fog: 0.15 };
    case 'rain':
      return {
        ...base,
        cloudCover: 100,
        rain: 4,
        wind: 18,
        wetness: 1,
        hoursSinceRain: 0,
        fog: 0.1,
      };
    case 'storm':
      return {
        ...base,
        cloudCover: 100,
        rain: 9,
        wind: 38,
        wetness: 1,
        thunder: true,
        hoursSinceRain: 0,
      };
    case 'snow':
      return { ...base, cloudCover: 95, snow: 1.5, temperature: -2, snowCover: 0.85, wind: 8 };
  }
}
