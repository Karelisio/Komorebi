import { create } from 'zustand';
import { detectLang, type Lang } from '@/i18n';
import { defaultQuality, type QualityLevel } from '@/render/quality';

export type ThemeMode = 'natural' | 'material' | 'light' | 'dark';

export interface Settings {
  lang: Lang;
  quality: QualityLevel;
  fpsCap: 30 | 60;
  volumes: { ambient: number; music: number; sfx: number };
  music: boolean;
  theme: ThemeMode;
  /** Teinte légère du brouillard et des lanternes avec la couleur d'accent. */
  accentTint: boolean;
  keepAwake: boolean;
  haptics: boolean;
  notifications: { enabled: boolean; bloom: boolean; fry: boolean; meteors: boolean };
  updates: { auto: boolean; prerelease: boolean; lastCheck: number; skipped: string | null };
  /** Position : 'auto' (appareil) ou 'fallback' (Grenoble). */
  location: 'auto' | 'fallback';
  locationAsked: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: detectLang(),
  quality: defaultQuality(),
  fpsCap: 30,
  volumes: { ambient: 0.8, music: 0.5, sfx: 0.7 },
  music: true,
  theme: 'natural',
  accentTint: false,
  keepAwake: false,
  haptics: true,
  notifications: { enabled: false, bloom: true, fry: true, meteors: true },
  updates: { auto: true, prerelease: false, lastCheck: 0, skipped: null },
  location: 'auto',
  locationAsked: false,
};

export const useSettings = create<Settings>(() => ({ ...DEFAULT_SETTINGS }));

export function patchSettings(patch: Partial<Settings>): void {
  useSettings.setState(patch);
}
