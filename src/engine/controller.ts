import { CATALOG } from '@/garden/catalog';
import { canPlace } from '@/garden/placement';
import type { GardenSystem } from '@/render/GardenSystem';
import type { KoiSystem } from '@/render/KoiSystem';
import type { Scene } from '@/render/Scene';
import { useGame } from '@/state/game';
import { showToast, useUi } from '@/state/ui';
import { t } from '@/i18n';
import { clock } from './clock';
import type { GestureHandlers, ScreenPoint } from './gestures';
import { selectionTick, tick } from './haptics';
import { audio } from '@/audio/engine';

export interface ControllerHooks {
  onFeed?(): void;
  onWaterTouch?(): void;
  onRake?(distance: number): void;
  onHarvest?(petals: number): void;
  onInteract?(): void;
}

/** Relie les gestes aux actions de jeu selon l'outil actif. */
export function createController(
  scene: Scene,
  garden: GardenSystem,
  kois: KoiSystem,
  hooks: ControllerHooks = {},
): GestureHandlers {
  let dragKind: 'water' | 'rake' | 'move' | 'ghost' | null = null;
  const world = (p: ScreenPoint) => scene.screenToWorld(p);
  const ponds = () => scene.ponds.map((p) => p.shape);
  let sandSaveTimer: ReturnType<typeof setTimeout> | undefined;

  const updateGhost = (x: number, y: number) => {
    const ui = useUi.getState();
    if (!ui.placing) return;
    const res = canPlace(ui.placing, x, y, useGame.getState().objects, ponds());
    useUi.setState({ ghost: { x, y, valid: res.ok } });
  };

  const moveTarget = (x: number, y: number) => {
    const id = useUi.getState().movingObject;
    const o = useGame.getState().objects.find((v) => v.id === id);
    if (!o) return;
    if (canPlace(o.kind, x, y, useGame.getState().objects, ponds(), o.id).ok)
      useGame.getState().moveObject(o.id, x, y);
  };

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
      if (ui.tool === 'place') return updateGhost(w.x, w.y);
      if (ui.movingObject) {
        moveTarget(w.x, w.y);
        useUi.setState({ movingObject: null });
        return;
      }
      if (ui.tool === 'water') {
        garden.waterAt(w.x, w.y, 0.4);
        return;
      }
      if (ui.tool === 'prune') {
        const o = garden.hitTest(w.x, w.y);
        if (o && useGame.getState().pruneObject(o.id)) {
          garden.pruneFx(o);
          tick('medium');
          audio.play('rake', 0.4, 1.6);
        } else if (o) showToast(t('garden.cannotPrune'));
        return;
      }
      const koi = kois.hitTest(w.x, w.y);
      if (koi) {
        useUi.setState({ selectedKoi: koi.id, sheet: 'koi' });
        tick('light');
        return;
      }
      const o = garden.hitTest(w.x, w.y);
      if (o) {
        const now = clock.now();
        const res = useGame.getState().harvestObject(o.id, now, scene.env?.season.day ?? 0);
        if (res) {
          garden.harvestFx(o);
          tick('light');
          audio.play('harvest', 0.7);
          hooks.onHarvest?.(res.petals);
          showToast(
            res.seed
              ? t('garden.harvestSeed', {
                  n: res.petals,
                  seed: t(`species.${res.seed}.name` as never),
                })
              : t('garden.harvest', { n: res.petals }),
          );
          return;
        }
        useUi.setState({ selectedObject: o.id, sheet: 'object' });
        return;
      }
      if (kois.feedAt(w.x, w.y)) {
        audio.play('feed', 0.6, 0.9 + Math.random() * 0.2);
        hooks.onFeed?.();
        return;
      }
      if (ui.selectedObject) useUi.setState({ selectedObject: null, sheet: 'none' });
    },
    longPress: (p) => {
      const w = world(p);
      const ui = useUi.getState();
      if (ui.tool !== 'none') return false;
      const o = garden.hitTest(w.x, w.y);
      if (!o) return false;
      useUi.setState({ movingObject: o.id, selectedObject: null, sheet: 'none' });
      dragKind = 'move';
      tick('medium');
      return true;
    },
    dragStart: (p) => {
      const w = world(p);
      const ui = useUi.getState();
      if (ui.movingObject) {
        dragKind = 'move';
        moveTarget(w.x, w.y);
        return true;
      }
      if (ui.tool === 'water') {
        dragKind = 'water';
        return true;
      }
      if (ui.tool === 'rake' && garden.sand.contains(w.x, w.y)) {
        dragKind = 'rake';
        garden.sand.rake(w.x, w.y);
        return true;
      }
      if (ui.tool === 'place') {
        dragKind = 'ghost';
        updateGhost(w.x, w.y);
        return true;
      }
      return false;
    },
    dragMove: (p) => {
      const w = world(p);
      if (dragKind === 'water') {
        const hits = garden.waterAt(w.x, w.y, 1 / 30);
        if (hits.length) tick('light', 200);
        const pond = scene.pondAt(w.x, w.y);
        if (pond) pond.touch(w.x, w.y, 0.4, 0.015);
      } else if (dragKind === 'rake') {
        const d = garden.sand.rake(w.x, w.y);
        if (d > 0) {
          selectionTick();
          if (Math.random() < 0.35) audio.play('rake', 0.35, 0.8 + Math.random() * 0.4);
          hooks.onRake?.(d);
        }
      } else if (dragKind === 'ghost') updateGhost(w.x, w.y);
      else if (dragKind === 'move') moveTarget(w.x, w.y);
    },
    dragEnd: () => {
      if (dragKind === 'rake') {
        garden.sand.endStroke();
        if (sandSaveTimer) clearTimeout(sandSaveTimer);
        sandSaveTimer = setTimeout(() => {
          const data = garden.sand.serialize();
          useGame.getState().setSand(data, 0, 0);
        }, 800);
      }
      if (dragKind === 'move') useUi.setState({ movingObject: null });
      dragKind = null;
    },
    panStart: () => scene.camera.beginDrag(),
    pan: (dx, dy, dt) => scene.camera.panBy(dx, dy, dt),
    panEnd: () => scene.camera.endDrag(),
    pinch: (f, c) => scene.camera.zoomAt(f, c.x, c.y),
    wheel: (f, c) => scene.camera.zoomAt(f, c.x, c.y),
    hover: (p) => {
      if (!p) return kois.clearAttractor();
      const w = world(p);
      kois.setAttractor(w.x, w.y);
    },
  };
}

/** Confirme le placement de l'aperçu. */
export function confirmPlacement(): boolean {
  const ui = useUi.getState();
  if (!ui.placing || !ui.ghost?.valid) return false;
  const o = useGame.getState().placeObject(ui.placing, ui.ghost.x, ui.ghost.y, clock.now());
  if (!o) {
    showToast(t('garden.notEnough'));
    return false;
  }
  tick('medium');
  const e = CATALOG[ui.placing];
  if (!useGame.getState().canAfford(ui.placing) || e.grows)
    useUi.setState({ tool: 'none', placing: null, ghost: null });
  return true;
}
