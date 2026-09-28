import { setLang } from '@/i18n';
import { simulateAbsence, type AbsenceSummary } from '@/save/offline';
import { loadGame, loadSettings, saveGame, startAutosave } from '@/save/storage';
import { newGame, snapshotGame, useGame } from '@/state/game';
import { patchSettings, useSettings } from '@/state/settings';
import { useWorld } from '@/state/world';
import { FALLBACK_LOCATION, loadStoredLocation, requestLocation } from '@/world/location';
import { loadWeatherCache, weatherSeries } from '@/world/weatherService';
import { clock } from './clock';

export interface BootResult {
  isNew: boolean;
  away: AbsenceSummary | null;
  stopAutosave: () => void;
}

/** Fait avancer la partie jusqu'à maintenant (au retour, puis toutes les minutes). */
export function catchUp(): AbsenceSummary | null {
  const now = clock.now();
  const state = snapshotGame();
  if (now - state.lastSimAt < 3_600_000) return null;
  const { location } = useWorld.getState();
  const { state: next, summary } = simulateAbsence(state, now, location, weatherSeries());
  useGame.getState().replace(next);
  return summary;
}

export async function boot(): Promise<BootResult> {
  const settings = await loadSettings();
  // Qualité forcée par l'URL (mesures de performance)
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') settings.quality = q;
  useSettings.setState(settings);
  setLang(settings.lang);

  const stored = await loadStoredLocation();
  useWorld.setState({
    location: settings.location === 'fallback' ? FALLBACK_LOCATION : stored.location,
  });
  if (settings.location === 'auto' && !stored.asked) {
    // Demandée une seule fois ; la scène démarre sans attendre.
    void requestLocation().then((loc) => {
      useWorld.setState({ location: loc });
      patchSettings({ locationAsked: true });
    });
  }
  await loadWeatherCache();

  const saved = await loadGame();
  const isNew = !saved;
  useGame.getState().replace(saved ?? newGame(clock.now()));
  const away = isNew ? null : catchUp();
  if (isNew) void saveGame();
  const stopAutosave = startAutosave();
  return { isNew, away, stopAutosave };
}
