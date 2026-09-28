import { describe, expect, it } from 'vitest';
import { computeLighting, computeSky, phaseFromAltitude } from './sky';

const GRENOBLE = { lat: 45.19, lon: 5.72 };
const at = (iso: string) => computeSky(new Date(iso), GRENOBLE.lat, GRENOBLE.lon);

describe('phases jour/nuit', () => {
  it('phaseFromAltitude couvre toutes les transitions', () => {
    expect(phaseFromAltitude(-20, true)).toBe('night');
    expect(phaseFromAltitude(-8, true)).toBe('dawn');
    expect(phaseFromAltitude(3, true)).toBe('morningGolden');
    expect(phaseFromAltitude(30, true)).toBe('day');
    expect(phaseFromAltitude(30, false)).toBe('day');
    expect(phaseFromAltitude(3, false)).toBe('eveningGolden');
    expect(phaseFromAltitude(-5, false)).toBe('dusk');
    expect(phaseFromAltitude(-10, false)).toBe('blueHour');
    expect(phaseFromAltitude(-20, false)).toBe('night');
  });

  it('solstice d’été à Grenoble : nuit à minuit, jour à midi', () => {
    // 00:00 UTC = 02:00 heure locale
    expect(at('2026-06-21T00:00:00Z').phase).toBe('night');
    expect(at('2026-06-21T11:30:00Z').phase).toBe('day');
  });

  it('lever du soleil vers 03:55 UTC le 21 juin → heure dorée du matin', () => {
    const s = at('2026-06-21T04:00:00Z');
    expect(s.morning).toBe(true);
    expect(s.phase).toBe('morningGolden');
  });

  it('coucher du soleil → heure dorée du soir puis crépuscule puis nuit bleue', () => {
    // Coucher ~19:20 UTC le 21 juin
    expect(at('2026-06-21T19:00:00Z').phase).toBe('eveningGolden');
    expect(at('2026-06-21T19:45:00Z').phase).toBe('dusk');
    expect(at('2026-06-21T20:35:00Z').phase).toBe('blueHour');
  });

  it('les heures de lever et coucher sont cohérentes', () => {
    const s = at('2026-12-21T12:00:00Z');
    expect(s.sunrise).not.toBeNull();
    expect(s.sunset).not.toBeNull();
    const rise = s.sunrise!.getUTCHours() + s.sunrise!.getUTCMinutes() / 60;
    const set = s.sunset!.getUTCHours() + s.sunset!.getUTCMinutes() / 60;
    expect(rise).toBeGreaterThan(6.5);
    expect(rise).toBeLessThan(7.5);
    expect(set).toBeGreaterThan(15.5);
    expect(set).toBeLessThan(16.5);
  });

  it('la lumière est continue : pas de saut entre deux minutes', () => {
    let prev = computeLighting(at('2026-03-20T04:00:00Z'));
    for (let m = 1; m < 240; m++) {
      const d = new Date(Date.parse('2026-03-20T04:00:00Z') + m * 60_000);
      const cur = computeLighting(computeSky(d, GRENOBLE.lat, GRENOBLE.lon));
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(cur.skyTop[i]! - prev.skyTop[i]!)).toBeLessThan(0.05);
        expect(Math.abs(cur.ambient[i]! - prev.ambient[i]!)).toBeLessThan(0.05);
      }
      prev = cur;
    }
  });

  it('étoiles visibles la nuit, pas en journée ; rayons le jour seulement', () => {
    const night = at('2026-06-21T00:00:00Z');
    const noon = at('2026-06-21T11:30:00Z');
    expect(night.stars).toBeGreaterThan(0.9);
    expect(noon.stars).toBe(0);
    expect(computeLighting(night).rays).toBe(0);
    expect(computeLighting(noon).rays).toBeGreaterThan(0.4);
  });

  it('phase de lune réelle : pleine lune du 3 mars 2026', () => {
    const s = at('2026-03-03T12:00:00Z');
    expect(s.moonFraction).toBeGreaterThan(0.97);
  });

  it('hémisphère sud : on regarde vers le nord', () => {
    expect(computeSky(new Date('2026-01-01T12:00:00Z'), -33.9, 18.4).viewAzimuth).toBe(0);
  });
});
