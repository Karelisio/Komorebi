import type { GameState } from '@/state/types';
import { crc32 } from './checksum';
import { migrate, SaveError } from './migrations';

export interface SaveFile {
  format: 'komorebi-save';
  version: number;
  savedAt: number;
  checksum: string;
  game: GameState;
}

export function encodeSave(game: GameState, now = Date.now()): string {
  const body = JSON.stringify(game);
  const file: SaveFile = {
    format: 'komorebi-save',
    version: game.version,
    savedAt: now,
    checksum: crc32(body),
    game,
  };
  return JSON.stringify(file);
}

/** Décode et vérifie une sauvegarde ; lève SaveError si corrompue. */
export function decodeSave(text: string): { game: GameState; savedAt: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveError('JSON invalide');
  }
  const f = parsed as Partial<SaveFile>;
  if (f.format !== 'komorebi-save' || typeof f.checksum !== 'string' || !f.game)
    throw new SaveError('format inconnu');
  if (crc32(JSON.stringify(f.game)) !== f.checksum)
    throw new SaveError('somme de contrôle invalide');
  return { game: migrate(f.game), savedAt: typeof f.savedAt === 'number' ? f.savedAt : 0 };
}

/** Choisit la sauvegarde valide la plus récente parmi les emplacements. */
export function pickSlot(
  texts: readonly (string | null)[],
): { game: GameState; savedAt: number; slot: number } | null {
  let best: { game: GameState; savedAt: number; slot: number } | null = null;
  texts.forEach((t, slot) => {
    if (!t) return;
    try {
      const d = decodeSave(t);
      if (!best || d.savedAt > best.savedAt) best = { ...d, slot };
    } catch {
      /* emplacement corrompu : ignoré */
    }
  });
  return best;
}
