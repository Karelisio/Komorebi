import { audio } from '@/audio/engine';
import { t } from '@/i18n';
import type { DecorSystem } from '@/render/DecorSystem';
import type { HarvestSystem } from '@/render/HarvestSystem';
import type { KoiSystem } from '@/render/KoiSystem';
import type { Scene } from '@/render/Scene';
import { useGame } from '@/state/game';
import { openShop, showToast, useUi } from '@/state/ui';
import type { GestureHandlers, ScreenPoint } from './gestures';
import { tick } from './haptics';

export interface ControllerHooks {
  onFeed?(): void;
  onWaterTouch?(): void;
  onCollect?(petals: number): void;
  onInteract?(): void;
}

export interface ControllerSystems {
  decor: DecorSystem;
  harvest: HarvestSystem;
  kois: KoiSystem;
}

/** Retour visuel et sonore d'une récolte. */
export function collectFeedback(n: number, hooks: ControllerHooks): void {
  if (n <= 0) return;
  tick('light');
  audio.play('harvest', 0.7);
  showToast(t('harvest.collected', { n }), 1800);
  hooks.onCollect?.(n);
}

/**
 * Gestes simples : toucher l'eau nourrit (ou récolte une bulle, ou ouvre la fiche d'un koï),
 * toucher la berge ouvre la décoration. Le doigt posé sur l'eau attire les koïs.
 */
export function createController(
  scene: Scene,
  sys: ControllerSystems,
  hooks: ControllerHooks = {},
): GestureHandlers {
  const world = (p: ScreenPoint) => scene.screenToWorld(p);

  return {
    down: (p) => {
      const w = world(p);
      const pond = scene.pondAt(w.x, w.y);
      if (pond) {
        pond.touch(w.x, w.y, 1.1);
        tick('light', 120);
        audio.play('touch', 0.5, 0.85 + Math.random() * 0.3);
        hooks.onWaterTouch?.();
      }
      hooks.onInteract?.();
    },
    tap: (p) => {
      const w = world(p);
      const ui = useUi.getState();
      // 1. Bulles de pétales
      const n = sys.harvest.collectAt(w.x, w.y);
      if (n > 0) return collectFeedback(n, hooks);
      // 2. Nid : ouvre la boutique sur les œufs
      if (sys.harvest.nestAt(w.x, w.y)) {
        openShop('eggs');
        return;
      }
      // 3. Koï : fiche, ou second koï d'un croisement
      const koi = sys.kois.hitTest(w.x, w.y);
      if (koi) {
        tick('light');
        useUi.setState({ selectedKoi: koi.id, sheet: 'koi' });
        return;
      }
      // 4. Berge : emplacement de décor
      const slot = sys.decor.slotAt(w.x, w.y);
      if (slot >= 0 && !scene.pondAt(w.x, w.y)) {
        tick('light');
        const placed = useGame.getState().decor[slot];
        if (placed) useUi.setState({ selectedSlot: slot, sheet: 'decor' });
        else
          useUi.setState({ selectedSlot: slot, decorMode: true, sheet: 'shop', shopTab: 'decor' });
        return;
      }
      // 5. Eau : nourrir
      if (sys.kois.feedAt(w.x, w.y)) {
        audio.play('feed', 0.6, 0.9 + Math.random() * 0.2);
        hooks.onFeed?.();
        return;
      }
      if (ui.decorMode) useUi.setState({ decorMode: false });
    },
    longPress: () => false,
    dragStart: () => false,
    dragMove: () => undefined,
    dragEnd: () => undefined,
    panStart: () => scene.camera.beginDrag(),
    pan: (dx, dy, dt) => scene.camera.panBy(dx, dy, dt),
    panEnd: () => scene.camera.endDrag(),
    pinch: (f, c) => scene.camera.zoomAt(f, c.x, c.y),
    wheel: (f, c) => scene.camera.zoomAt(f, c.x, c.y),
    hover: (p) => {
      if (!p) return sys.kois.clearAttractor();
      const w = world(p);
      sys.kois.setAttractor(w.x, w.y);
    },
  };
}

/** Bouton « Nourrir » : une poignée de granulés répartie sur le bassin. */
export function feedHandful(scene: Scene, kois: KoiSystem, hooks: ControllerHooks = {}): void {
  const pond = scene.ponds[0];
  if (!pond) return;
  const { shape } = pond;
  let fed = false;
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.6;
    fed =
      kois.feedAt(shape.cx + Math.cos(a) * shape.rx * r, shape.cy + Math.sin(a) * shape.ry * r) ||
      fed;
  }
  if (fed) {
    tick('light');
    audio.play('feed', 0.6, 0.9 + Math.random() * 0.2);
    hooks.onFeed?.();
  }
}
