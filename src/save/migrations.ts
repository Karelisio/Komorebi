import { newGame, SAVE_VERSION } from '@/state/game';
import type { GameState } from '@/state/types';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Migrations successives : la clé est la version SOURCE.
 * v0 = format des prototypes (poissons dans `fish`, pas de sable ni de mémoire météo).
 */
export const MIGRATIONS: Record<number, (s: Json) => Json> = {
  0: (s) => {
    const { fish, ...rest } = s;
    return {
      ...rest,
      kois: Array.isArray(fish) ? fish : [],
      sand: { w: 0, h: 0, data: '' },
      weatherMemory: { lastRainAt: 0, snowCover: 0, wetness: 0 },
      version: 1,
    };
  },
};

export class SaveError extends Error {}

/** Amène une sauvegarde brute à la version courante, en complétant les champs manquants. */
export function migrate(raw: unknown): GameState {
  if (!isObj(raw)) throw new SaveError('sauvegarde illisible');
  let s: Json = raw;
  let v = typeof s.version === 'number' ? s.version : 0;
  if (v > SAVE_VERSION) throw new SaveError(`sauvegarde d’une version plus récente (${v})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new SaveError(`migration manquante depuis v${v}`);
    s = m(s);
    v = typeof s.version === 'number' ? s.version : v + 1;
  }
  // Complète avec les valeurs par défaut (champs ajoutés sans changement de version).
  const base = newGame(typeof s.createdAt === 'number' ? s.createdAt : Date.now());
  const merged = { ...base, ...s } as GameState;
  merged.stats = {
    ...base.stats,
    ...(isObj(s.stats) ? (s.stats as Partial<GameState['stats']>) : {}),
  };
  merged.discovered = {
    ...base.discovered,
    ...(isObj(s.discovered) ? (s.discovered as Partial<GameState['discovered']>) : {}),
  };
  if (!Array.isArray(merged.objects) || !Array.isArray(merged.kois))
    throw new SaveError('sauvegarde incomplète');
  merged.version = SAVE_VERSION;
  return merged;
}
