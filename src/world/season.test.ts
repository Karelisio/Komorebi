import { describe, expect, it } from 'vitest';
import { computeSeason } from './season';
import { activeMeteorShower, nextMeteorShowerPeak } from './events';

const d = (iso: string) => new Date(iso);

describe('saisons', () => {
  it('saisons de l’hémisphère nord', () => {
    expect(computeSeason(d('2026-01-15T12:00:00Z'), 45).season).toBe('winter');
    expect(computeSeason(d('2026-04-15T12:00:00Z'), 45).season).toBe('spring');
    expect(computeSeason(d('2026-07-15T12:00:00Z'), 45).season).toBe('summer');
    expect(computeSeason(d('2026-10-15T12:00:00Z'), 45).season).toBe('autumn');
  });

  it('hémisphère sud inversé', () => {
    expect(computeSeason(d('2026-01-15T12:00:00Z'), -34).season).toBe('summer');
  });

  it('cerisiers en fleur début avril, pas en été', () => {
    expect(computeSeason(d('2026-04-05T12:00:00Z'), 45).sakura).toBeGreaterThan(0.9);
    expect(computeSeason(d('2026-07-05T12:00:00Z'), 45).sakura).toBe(0);
  });

  it('feuillage : nu en hiver, plein en été, coloré fin octobre', () => {
    expect(computeSeason(d('2026-01-15T12:00:00Z'), 45).foliage).toBe(0);
    expect(computeSeason(d('2026-07-15T12:00:00Z'), 45).foliage).toBe(1);
    expect(computeSeason(d('2026-10-25T12:00:00Z'), 45).autumn).toBeGreaterThan(0.8);
  });
});

describe('pluies d’étoiles filantes', () => {
  it('Perséides actives le 12 août, Géminides le 14 décembre', () => {
    expect(activeMeteorShower(d('2026-08-12T22:00:00Z'))?.shower.id).toBe('perseids');
    expect(activeMeteorShower(d('2026-12-14T22:00:00Z'))?.shower.id).toBe('geminids');
  });

  it('rien début mars', () => {
    expect(activeMeteorShower(d('2026-03-05T22:00:00Z'))).toBeNull();
  });

  it('prochaine pluie après le 28 septembre : Orionides', () => {
    expect(nextMeteorShowerPeak(d('2026-09-28T12:00:00Z')).shower.id).toBe('orionids');
  });
});
