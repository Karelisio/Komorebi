import { Capacitor, registerPlugin } from '@capacitor/core';
import { create } from 'zustand';
import type { ThemeMode } from '@/state/settings';
import {
  DARK,
  LIGHT,
  materialScheme,
  NATURAL,
  tonalFromHue,
  type DynamicPalette,
  type UiScheme,
} from './palette';

export interface KomorebiNativePlugin {
  getDynamicColors(): Promise<{ available: boolean; palette?: DynamicPalette }>;
  installApk(opts: { path: string }): Promise<{ started: boolean; needsPermission?: boolean }>;
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  download(opts: {
    url: string;
    path: string;
    sha256?: string;
  }): Promise<{ path: string; sha256: string; size: number }>;
  cancelDownload(): Promise<void>;
  addListener(
    event: 'downloadProgress',
    cb: (e: { received: number; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const KomorebiNative = registerPlugin<KomorebiNativePlugin>('KomorebiNative');

interface ThemeState {
  scheme: UiScheme;
  /** Couleur d'accent (#rrggbb) pour teinter légèrement la scène. */
  accent: string;
  dynamic: DynamicPalette | null;
}

export const useTheme = create<ThemeState>(() => ({
  scheme: NATURAL,
  accent: '#e9b872',
  dynamic: null,
}));

let dynamicLoaded = false;

async function loadDynamic(): Promise<DynamicPalette> {
  if (Capacitor.getPlatform() === 'android') {
    try {
      const r = await KomorebiNative.getDynamicColors();
      if (r.available && r.palette) return r.palette;
    } catch {
      /* plugin indisponible : repli */
    }
  }
  return tonalFromHue(140, 0.3);
}

const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** Applique un thème : variables CSS (transition animée via @property) et accent. */
export async function applyTheme(mode: ThemeMode): Promise<void> {
  let scheme: UiScheme;
  let accent = '#e9b872';
  if (mode === 'material') {
    if (!dynamicLoaded) {
      useTheme.setState({ dynamic: await loadDynamic() });
      dynamicLoaded = true;
    }
    const dyn = useTheme.getState().dynamic ?? tonalFromHue(140);
    scheme = materialScheme(dyn, systemDark());
    accent = dyn.accent1[400] ?? scheme.primary;
  } else if (mode === 'light') scheme = LIGHT;
  else if (mode === 'dark') scheme = DARK;
  else scheme = NATURAL;
  if (mode !== 'material' && mode !== 'natural') accent = scheme.primary;

  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--surface': scheme.surface,
    '--surface-strong': scheme.surfaceStrong,
    '--on-surface': scheme.onSurface,
    '--on-surface-muted': scheme.onSurfaceMuted,
    '--primary': scheme.primary,
    '--on-primary': scheme.onPrimary,
    '--primary-container': scheme.primaryContainer,
    '--on-primary-container': scheme.onPrimaryContainer,
    '--outline': scheme.outline,
    '--scrim': scheme.scrim,
    '--blur': `${scheme.blur}px`,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = mode;
  root.dataset.dark = scheme.dark ? '1' : '0';
  useTheme.setState({ scheme, accent });
}

/** Suit le mode sombre du système pour Material You. */
export function watchSystemTheme(getMode: () => ThemeMode): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return () => undefined;
  const on = () => {
    if (getMode() === 'material') void applyTheme('material');
  };
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
