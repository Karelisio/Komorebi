import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { APP_CONFIG } from '@/config/app';
import { snapshotGame, useGame } from '@/state/game';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '@/state/settings';
import type { GameState } from '@/state/types';
import { decodeSave, encodeSave, pickSlot } from './format';

const SLOTS = ['komorebi-save-a.json', 'komorebi-save-b.json'] as const;
const SLOT_KEY = 'komorebi.save.slot';
const SETTINGS_KEY = 'komorebi.settings';

async function readSlot(path: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return typeof r.data === 'string' ? r.data : null;
  } catch {
    return null;
  }
}

let lastSlot = 0;
let saving: Promise<void> | null = null;

/** Charge la sauvegarde valide la plus récente (ou null pour une nouvelle partie). */
export async function loadGame(): Promise<GameState | null> {
  const texts = await Promise.all(SLOTS.map(readSlot));
  const best = pickSlot(texts);
  if (!best) return null;
  lastSlot = best.slot;
  return best.game;
}

/** Écrit dans l'emplacement le plus ancien, puis bascule le pointeur : jamais de fichier à moitié écrit. */
export function saveGame(game: GameState = snapshotGame()): Promise<void> {
  if (saving) return saving;
  const next = (lastSlot + 1) % SLOTS.length;
  saving = Filesystem.writeFile({
    path: SLOTS[next]!,
    directory: Directory.Data,
    data: encodeSave(game),
    encoding: Encoding.UTF8,
  })
    .then(async () => {
      lastSlot = next;
      await Preferences.set({ key: SLOT_KEY, value: String(next) });
    })
    .catch((e: unknown) => console.warn('sauvegarde impossible', e))
    .finally(() => {
      saving = null;
    });
  return saving;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (value) {
      const s = JSON.parse(value) as Partial<Settings>;
      return {
        ...DEFAULT_SETTINGS,
        ...s,
        volumes: { ...DEFAULT_SETTINGS.volumes, ...s.volumes },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...s.notifications },
        updates: { ...DEFAULT_SETTINGS.updates, ...s.updates },
      };
    }
  } catch {
    /* réglages par défaut */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): Promise<void> {
  return Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(s) }).catch(() => undefined);
}

/** Autosauvegarde régulière + à la mise en arrière-plan. */
export function startAutosave(beforeSave?: () => void): () => void {
  let dirty = true;
  const unsubGame = useGame.subscribe(() => {
    dirty = true;
  });
  const unsubSettings = useSettings.subscribe((s) => void saveSettings(s));
  const flush = () => {
    beforeSave?.();
    dirty = false;
    return saveGame();
  };
  const timer = setInterval(() => {
    if (dirty) void flush();
  }, APP_CONFIG.save.autosaveMs);
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  let appListener: { remove: () => Promise<void> } | null = null;
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) void flush();
    }).then((l) => {
      appListener = l;
    });
  }
  return () => {
    clearInterval(timer);
    unsubGame();
    unsubSettings();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
    void appListener?.remove();
  };
}

/** Export : fichier JSON partagé (Android) ou téléchargé (web). */
export async function exportSave(): Promise<void> {
  const text = encodeSave(snapshotGame());
  const name = `komorebi-${new Date().toISOString().slice(0, 10)}.komorebi.json`;
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: name,
      directory: Directory.Cache,
      data: text,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: 'Komorebi', files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Import : valide et migre avant de remplacer la partie. */
export async function importSave(file: File): Promise<GameState> {
  const { game } = decodeSave(await file.text());
  useGame.getState().replace(game);
  await saveGame(game);
  return game;
}
