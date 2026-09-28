import { create } from 'zustand';
import type { Season } from '@/world/season';
import type { WeatherKind } from '@/world/weatherTypes';
import { clock } from './clock';

export interface DebugState {
  enabled: boolean;
  season: Season | null;
  weather: WeatherKind | null;
  showFps: boolean;
  /** Caméra forcée (captures). */
  camera: { x: number; y: number; zoom: number } | null;
}

export const useDebug = create<DebugState>(() => ({
  enabled: false,
  season: null,
  weather: null,
  showFps: false,
  camera: null,
}));

/** Date représentative d'une saison forcée (on garde l'heure courante). */
export function seasonDate(season: Season, now: Date): Date {
  const month = { spring: 3, summer: 6, autumn: 9, winter: 0 }[season];
  const day = { spring: 5, summer: 10, autumn: 28, winter: 20 }[season];
  const d = new Date(now);
  d.setMonth(month, day);
  return d;
}

/**
 * Paramètres d'URL de debug (utiles en dev et pour les captures) :
 * ?t=2026-06-21T19:00:00Z&speed=60&season=autumn&weather=rain&debug=1
 */
export function applyUrlDebug(search: string): void {
  const q = new URLSearchParams(search);
  const t = q.get('t');
  if (t && !Number.isNaN(Date.parse(t))) clock.setTime(Date.parse(t));
  const speed = Number(q.get('speed'));
  if (speed > 0) clock.setSpeed(speed);
  const season = q.get('season') as Season | null;
  const weather = q.get('weather') as WeatherKind | null;
  useDebug.setState({
    enabled: q.get('debug') === '1',
    season: season && ['spring', 'summer', 'autumn', 'winter'].includes(season) ? season : null,
    weather: weather ?? null,
    showFps: q.get('fps') === '1',
    camera: q.get('zoom')
      ? {
          x: Number(q.get('cx') ?? 600),
          y: Number(q.get('cy') ?? 1190),
          zoom: Number(q.get('zoom')),
        }
      : null,
  });
}
