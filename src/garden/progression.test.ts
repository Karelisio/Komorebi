import { describe, expect, it } from 'vitest';
import { dailyGift, dayKey, newlyUnlocked, unlockedCatalog } from './progression';

describe('progression', () => {
  it('cadeau quotidien : série qui augmente, un seul par jour, pas de pénalité', () => {
    const d1 = new Date(2026, 8, 1, 10).getTime();
    const d2 = new Date(2026, 8, 2, 9).getTime();
    const d5 = new Date(2026, 8, 5, 9).getTime();
    const g1 = dailyGift({ lastDay: '', streak: 0 }, d1, 0, 3)!;
    expect(g1.streak).toBe(1);
    expect(dailyGift({ lastDay: g1.day, streak: 1 }, d1 + 3600_000, 0, 3)).toBeNull();
    const g2 = dailyGift({ lastDay: g1.day, streak: 1 }, d2, 0, 3)!;
    expect(g2.streak).toBe(2);
    expect(g2.petals).toBeGreaterThan(g1.petals);
    const g5 = dailyGift({ lastDay: g2.day, streak: 2 }, d5, 0, 3)!;
    expect(g5.streak).toBe(1);
    expect(g5.petals).toBeGreaterThan(0);
  });

  it('les graines offertes sont débloquées', () => {
    const g = dailyGift({ lastDay: '', streak: 0 }, Date.now(), 0, 7)!;
    expect(unlockedCatalog(0)).toContain(g.seed);
  });

  it('déblocages progressifs', () => {
    expect(unlockedCatalog(0)).toContain('maple');
    expect(unlockedCatalog(0)).not.toContain('bridge');
    expect(newlyUnlocked(0, 60)).toContain('pine');
    expect(dayKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
  });
});
