import { describe, expect, it } from 'vitest';
import {
  accumulate,
  kindFromCode,
  parseOpenMeteo,
  simulateHour,
  weatherHour,
  type WeatherHour,
} from './weather';

const H = 3_600_000;

describe('météo', () => {
  it('codes WMO', () => {
    expect(kindFromCode(0)).toBe('clear');
    expect(kindFromCode(3)).toBe('overcast');
    expect(kindFromCode(45)).toBe('fog');
    expect(kindFromCode(53)).toBe('drizzle');
    expect(kindFromCode(63, 2)).toBe('rain');
    expect(kindFromCode(75)).toBe('snow');
    expect(kindFromCode(96)).toBe('storm');
  });

  it('simulation déterministe et plausible (plus froid et plus de neige en hiver)', () => {
    const t = Date.UTC(2026, 0, 15, 12);
    expect(simulateHour(t, 45.19, 5.72)).toEqual(simulateHour(t, 45.19, 5.72));
    let winterSnow = 0;
    let summerSnow = 0;
    let winterT = 0;
    let summerT = 0;
    for (let h = 0; h < 24 * 60; h++) {
      const w = simulateHour(Date.UTC(2026, 0, 1) + h * H, 45.19, 5.72);
      const s = simulateHour(Date.UTC(2026, 6, 1) + h * H, 45.19, 5.72);
      winterSnow += w.snowfall;
      summerSnow += s.snowfall;
      winterT += w.temperature;
      summerT += s.temperature;
    }
    expect(summerSnow).toBe(0);
    expect(winterSnow).toBeGreaterThan(0);
    expect(summerT / (24 * 60)).toBeGreaterThan(winterT / (24 * 60) + 10);
  });

  it('la simulation varie doucement d’une heure à l’autre', () => {
    for (let h = 0; h < 200; h++) {
      const a = simulateHour(Date.UTC(2026, 3, 1) + h * H, 45, 5);
      const b = simulateHour(Date.UTC(2026, 3, 1) + (h + 1) * H, 45, 5);
      expect(Math.abs(a.temperature - b.temperature)).toBeLessThan(4);
    }
  });

  it('neige qui s’accumule puis fond ; sol mouillé qui sèche', () => {
    const snow: WeatherHour = {
      time: 0,
      code: 73,
      temperature: -2,
      precipitation: 0,
      snowfall: 1,
      cloudCover: 100,
      wind: 5,
      windDir: 0,
    };
    const sun: WeatherHour = { ...snow, code: 0, temperature: 12, snowfall: 0, cloudCover: 0 };
    let m = { lastRainAt: 0, snowCover: 0, wetness: 0 };
    for (let i = 0; i < 6; i++) m = accumulate(m, snow);
    expect(m.snowCover).toBeGreaterThan(0.8);
    for (let i = 0; i < 24; i++) m = accumulate(m, sun);
    expect(m.snowCover).toBe(0);
    m = accumulate(m, { ...sun, code: 63, precipitation: 3, time: 5 });
    expect(m.wetness).toBeGreaterThan(0.3);
    expect(m.lastRainAt).toBe(5);
  });

  it('parse Open-Meteo et bascule sur la simulation hors couverture', () => {
    const series = parseOpenMeteo({
      hourly: {
        time: [1_000_000, 1_003_600],
        temperature_2m: [10, 11],
        precipitation: [0, 2],
        snowfall: [0, 0],
        weather_code: [0, 63],
        cloud_cover: [5, 100],
        wind_speed_10m: [3, 12],
        wind_direction_10m: [90, 180],
      },
    });
    expect(series[1]!.time).toBe(1_003_600_000);
    expect(weatherHour(series, 1_003_600_000, 45, 5).simulated).toBe(false);
    expect(weatherHour(series, 1_003_600_000 + 10 * H, 45, 5).simulated).toBe(true);
  });
});
