import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Runtime } from '@/engine/runtime';
import { useGame } from '@/state/game';
import { useSettings } from '@/state/settings';
import { useWorld } from '@/state/world';
import { audio } from './engine';

/** Relie le moteur audio au monde (météo, heure) et aux réglages. */
export function startAudioBridge(rt: Runtime): () => void {
  const applySettings = () => {
    const s = useSettings.getState();
    audio.setMix({
      ambient: s.volumes.ambient,
      music: s.volumes.music,
      sfx: s.volumes.sfx,
      musicOn: s.music,
    });
  };
  applySettings();
  const unsub = useSettings.subscribe(applySettings);

  // Démarre au premier contact (politique d'autoplay des navigateurs)
  const unlock = () => {
    void audio.start().then(applySettings);
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  const timer = setInterval(() => {
    const w = useWorld.getState();
    if (!w.sky || !w.weather || !w.nature) return;
    const cam = rt.scene.camera;
    const pond = rt.scene.ponds[0]?.shape;
    const near = pond
      ? Math.max(0, 1 - Math.hypot(cam.x - pond.cx, cam.y - pond.cy) / 900) *
        Math.min(1, cam.zoom / (rt.scene.width / 760))
      : 0;
    audio.updateEnvironment(w.sky, w.weather, w.nature, {
      stream: useGame.getState().zones.includes('waterfall'),
      nearWater: Math.min(1, near),
    });
  }, 1000);

  rt.scene.onThunder = () =>
    setTimeout(() => audio.play('thunder', 0.8), 800 + Math.random() * 2500);

  const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume());
  document.addEventListener('visibilitychange', onVisibility);
  let appListener: { remove: () => Promise<void> } | null = null;
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) =>
      isActive ? audio.resume() : audio.suspend(),
    ).then((l) => {
      appListener = l;
    });
  }

  return () => {
    unsub();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    void appListener?.remove();
  };
}
