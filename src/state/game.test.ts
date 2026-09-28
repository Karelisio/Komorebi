import { beforeEach, describe, expect, it } from 'vitest';
import { decorBonus } from '@/garden/decor';
import { questDone } from '@/garden/quests';
import { accrue, pondCapacity, PENDING_CAP_HOURS, upgradeCost } from '@/pond/economy';
import { EGG_OFFERS, eggGenome } from '@/pond/eggs';
import { express } from '@/pond/genetics';
import { advance, NEST_SIZE, newGame, useGame } from './game';

const H = 3_600_000;
const T0 = Date.UTC(2026, 5, 1, 10);

beforeEach(() => {
  useGame.getState().replace(newGame(T0));
});

describe('économie', () => {
  it('la production s’accumule puis plafonne', () => {
    expect(accrue(0, 10, H)).toBeCloseTo(10);
    expect(accrue(0, 10, 100 * H)).toBe(10 * PENDING_CAP_HOURS);
    expect(accrue(10 * PENDING_CAP_HOURS, 10, H)).toBe(10 * PENDING_CAP_HOURS);
  });

  it('le décor et le charme augmentent la production', () => {
    const g = { ...newGame(T0), decor: newGame(T0).decor.map(() => null) };
    const base = advance({ ...g, pending: 0 }, H, T0, false).pending;
    const decorated = advance(
      { ...g, pending: 0, decor: g.decor.map(() => 'yukimi' as const) },
      H,
      T0,
      false,
    ).pending;
    expect(decorated).toBeGreaterThan(base * 2);
    const charm = advance(
      { ...g, pending: 0, upgrades: { ...g.upgrades, charm: 3 } },
      H,
      T0,
      false,
    );
    expect(charm.pending).toBeCloseTo(base * 1.6, 5);
  });

  it('les lanternes ne comptent que la nuit', () => {
    const b = decorBonus(['lantern', null]);
    expect(b.nightPetals).toBeCloseTo(0.3);
    expect(b.petals).toBe(0);
  });

  it('les alevins grandissent et deviennent adultes', () => {
    const g = newGame(T0);
    const fry = { ...g.kois[0]!, growth: 0.45, satiety: 1 };
    const after = advance({ ...g, kois: [fry] }, 12 * H, T0, false);
    expect(after.kois[0]!.growth!).toBeGreaterThan(0.5);
    expect(after.stats.grown).toBe(1);
  });

  it('coûts d’amélioration croissants, capacité du bassin', () => {
    expect(upgradeCost('pond', 1)).toBeGreaterThan(upgradeCost('pond', 0));
    expect(pondCapacity({ pond: 2, food: 0, charm: 0 })).toBe(12);
  });
});

describe('actions', () => {
  it('récolter transfère les pétales entiers', () => {
    useGame.setState({ pending: 7.6, petals: 0 });
    expect(useGame.getState().collect()).toBe(7);
    const s = useGame.getState();
    expect(s.petals).toBe(7);
    expect(s.pending).toBeCloseTo(0.6);
    expect(s.stats.collected).toBe(7);
  });

  it('acheter un œuf, puis le faire éclore avec découverte récompensée', () => {
    useGame.setState({ petals: 1000, discovered: { varieties: [], events: [] } });
    const egg = useGame.getState().buyEgg(0, T0);
    expect(egg).not.toBeNull();
    expect(useGame.getState().petals).toBe(1000 - EGG_OFFERS[0]!.cost);
    expect(useGame.getState().hatchReady(T0).born).toHaveLength(0);
    const res = useGame.getState().hatchReady(egg!.hatchAt);
    expect(res.born).toHaveLength(1);
    expect(res.discoveries).toHaveLength(1);
    const s = useGame.getState();
    expect(s.eggs).toHaveLength(0);
    expect(s.kois).toHaveLength(4);
    expect(s.stats.hatched).toBe(1);
    expect(s.petals).toBeGreaterThan(1000 - EGG_OFFERS[0]!.cost);
  });

  it('le nid est limité et les œufs rares demandent un niveau', () => {
    useGame.setState({ petals: 10_000 });
    expect(useGame.getState().buyEgg(2, T0)).toBeNull();
    for (let i = 0; i < NEST_SIZE; i++) expect(useGame.getState().buyEgg(0, T0)).not.toBeNull();
    expect(useGame.getState().buyEgg(0, T0)).toBeNull();
  });

  it('un œuf n’éclôt pas si le bassin est plein', () => {
    const g = useGame.getState();
    const full = Array.from({ length: pondCapacity(g.upgrades) }, (_, i) => ({
      ...g.kois[0]!,
      id: `k${i}`,
    }));
    useGame.setState({ kois: full, petals: 100 });
    const egg = useGame.getState().buyEgg(0, T0)!;
    expect(useGame.getState().hatchReady(egg.hatchAt + 1).born).toHaveLength(0);
    expect(useGame.getState().eggs).toHaveLength(1);
  });

  it('les œufs rares favorisent les traits rares', () => {
    let rare0 = 0;
    let rare2 = 0;
    for (let s = 1; s <= 200; s++) {
      rare0 += express(eggGenome(s, 0)).rarity;
      rare2 += express(eggGenome(s, 2)).rarity;
    }
    expect(rare2).toBeGreaterThan(rare0 * 1.3);
  });

  it('croisement : adultes de sexe opposé, coût, repos', () => {
    const [a, b] = useGame.getState().kois;
    const f = { ...a!, sex: 'f' as const, growth: 1 };
    const m = { ...b!, sex: 'm' as const, growth: 1 };
    useGame.setState({ kois: [f, m], petals: 100 });
    expect(useGame.getState().breed(f.id, f.id, T0)).toBeNull();
    const egg = useGame.getState().breed(f.id, m.id, T0);
    expect(egg?.parents).toEqual([f.id, m.id]);
    expect(useGame.getState().stats.bred).toBe(1);
    // Au repos juste après
    expect(useGame.getState().breed(f.id, m.id, T0 + 1000)).toBeNull();
  });

  it('poser et retirer un décor', () => {
    useGame.setState({ petals: 100, level: 1, decor: [null, 'rock'] });
    expect(useGame.getState().placeDecor(1, 'fern')).toBe(false);
    expect(useGame.getState().placeDecor(0, 'lantern')).toBe(false); // niveau
    expect(useGame.getState().placeDecor(0, 'fern')).toBe(true);
    expect(useGame.getState().petals).toBe(75);
    expect(useGame.getState().removeDecor(0)).toBe(12);
    expect(useGame.getState().decor[0]).toBeNull();
  });

  it('quêtes : réclamer, remplacer, monter de niveau', () => {
    const q0 = useGame.getState().quests[0]!;
    expect(q0.kind).toBe('fed');
    expect(useGame.getState().claimQuest(q0.id)).toBeNull();
    useGame.setState((s) => ({ stats: { ...s.stats, fed: s.stats.fed + q0.target } }));
    expect(questDone(q0, useGame.getState().stats)).toBe(true);
    const r = useGame.getState().claimQuest(q0.id);
    expect(r?.reward).toBe(q0.reward);
    const s = useGame.getState();
    expect(s.quests).toHaveLength(3);
    expect(s.quests.some((q) => q.id === q0.id)).toBe(false);
    expect(s.levelProgress).toBe(1);
    // Assez de quêtes → niveau 2
    const q1 = s.quests[0]!;
    useGame.setState((st) => ({
      stats: { ...st.stats, [q1.kind]: st.stats[q1.kind] + q1.target },
    }));
    expect(useGame.getState().claimQuest(q1.id)?.levelUp).toBe(true);
    expect(useGame.getState().level).toBe(2);
  });
});
