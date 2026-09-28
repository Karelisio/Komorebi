import { isDecorId } from '@/garden/decor';
import { newGame, SAVE_VERSION, starterDecor } from '@/state/game';
import type { GameState } from '@/state/types';
import { MAIN_POND } from '@/world/layout';

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const DAY = 86_400_000;

/**
 * Migrations successives : la clé est la version SOURCE.
 * v0 = format des prototypes (poissons dans `fish`, pas de sable ni de mémoire météo).
 * v1 = jardin libre (objets, graines, zones, sable) ; v2 = bassin rapproché (décor par
 * emplacement, œufs, améliorations, quêtes).
 */
export const MIGRATIONS: Record<number, (s: Json) => Json> = {
  0: (s) => {
    const { fish, ...rest } = s;
    return {
      ...rest,
      kois: Array.isArray(fish) ? fish : [],
      weatherMemory: { lastRainAt: 0, snowCover: 0, wetness: 0 },
      version: 1,
    };
  },
  1: (s) => {
    const now = typeof s.lastSimAt === 'number' ? s.lastSimAt : Date.now();
    // Les koïs restent, tous dans le bassin principal, avec une croissance tirée de leur âge.
    const kois = (Array.isArray(s.kois) ? s.kois : []).filter(isObj).map((k) => {
      const born = typeof k.bornAt === 'number' ? k.bornAt : now;
      return { ...k, pondId: MAIN_POND.id, growth: Math.min(1, (now - born) / DAY / 12) };
    });
    // Le jardin libre disparaît : les objets sont remboursés en pétales (forfait par objet).
    const objects = Array.isArray(s.objects) ? s.objects.length : 0;
    const petals = (typeof s.petals === 'number' ? s.petals : 0) + objects * 10;
    const {
      objects: _objects,
      seeds: _seeds,
      zones: _zones,
      sand: _sand,
      objectives: _objectives,
      stats: _stats,
      tutorial: _tutorial,
      ...rest
    } = s;
    void [_objects, _seeds, _zones, _sand, _objectives, _stats, _tutorial];
    const discovered = isObj(s.discovered) ? s.discovered : {};
    return {
      ...rest,
      kois,
      petals,
      decor: starterDecor(),
      discovered: {
        varieties: Array.isArray(discovered.varieties) ? discovered.varieties : [],
        events: Array.isArray(discovered.events) ? discovered.events : [],
      },
      version: 2,
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
  merged.upgrades = {
    ...base.upgrades,
    ...(isObj(s.upgrades) ? (s.upgrades as Partial<GameState['upgrades']>) : {}),
  };
  merged.discovered = {
    ...base.discovered,
    ...(isObj(s.discovered) ? (s.discovered as Partial<GameState['discovered']>) : {}),
  };
  if (!Array.isArray(merged.kois)) throw new SaveError('sauvegarde incomplète');
  // Décor : un emplacement par slot, ids inconnus ignorés
  const decor = Array.isArray(merged.decor) ? merged.decor : [];
  merged.decor = base.decor.map((_, i) => {
    const d: unknown = decor[i];
    return isDecorId(d) ? d : null;
  });
  if (!Array.isArray(merged.eggs)) merged.eggs = [];
  if (!Array.isArray(merged.quests) || merged.quests.length === 0) {
    merged.quests = base.quests;
    merged.questSeq = base.questSeq;
  }
  merged.version = SAVE_VERSION;
  return merged;
}
