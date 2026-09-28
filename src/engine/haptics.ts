import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '@/state/settings';

let last = 0;

/** Retour haptique très léger, limité en fréquence. */
export function tick(style: 'light' | 'soft' | 'medium' = 'light', minGapMs = 60): void {
  if (!useSettings.getState().haptics || !Capacitor.isNativePlatform()) return;
  const now = performance.now();
  if (now - last < minGapMs) return;
  last = now;
  const s = style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  void Haptics.impact({ style: s }).catch(() => undefined);
}

export function selectionTick(): void {
  if (!useSettings.getState().haptics || !Capacitor.isNativePlatform()) return;
  const now = performance.now();
  if (now - last < 45) return;
  last = now;
  void Haptics.selectionChanged().catch(() => undefined);
}
