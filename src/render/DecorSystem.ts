import { Container, Graphics, Sprite } from 'pixi.js';
import { decor, type DecorId } from '@/garden/decor';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import { BANK_SLOTS } from '@/world/layout';
import { clamp } from '@/world/math';
import { paintDecor } from './decorArt';
import type { FrameLight, Scene, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';

interface SlotView {
  root: Container;
  sprite: Sprite | null;
  glow: Sprite | null;
  marker: Graphics;
  id: DecorId | null;
  key: string;
  phase: number;
}

const SWAYS: ReadonlySet<DecorId> = new Set(['fern', 'iris', 'azalea', 'maple', 'pine', 'cherry']);

/** Décor posé sur les emplacements de la berge, peint selon la saison. */
export class DecorSystem implements SceneSystem {
  private readonly slots: SlotView[];

  constructor(private readonly scene: Scene) {
    this.slots = BANK_SLOTS.map((p, i) => {
      const root = new Container();
      root.position.set(p.x, p.y);
      root.zIndex = p.y;
      const marker = new Graphics();
      marker.circle(0, -14, 16).fill({ color: 0xffffff, alpha: 0.16 });
      marker.circle(0, -14, 16).stroke({ color: 0xffffff, alpha: 0.7, width: 2 });
      marker.moveTo(-7, -14).lineTo(7, -14).moveTo(0, -21).lineTo(0, -7);
      marker.stroke({ color: 0xffffff, alpha: 0.9, width: 2.5, cap: 'round' });
      marker.visible = false;
      root.addChild(marker);
      scene.objects.addChild(root);
      return { root, sprite: null, glow: null, marker, id: null, key: '', phase: i * 1.3 };
    });
  }

  /** Emplacement touché (coordonnées monde), ou -1. */
  slotAt(x: number, y: number): number {
    let best = -1;
    let bd = Infinity;
    BANK_SLOTS.forEach((p, i) => {
      const id = this.slots[i]?.id;
      const size = id ? decor(id).size : 1;
      const d = Math.hypot(x - p.x, (y - (p.y - 20 * size)) * 0.8);
      if (d < 34 * Math.max(1, size * 0.8) && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  update(_dt: number, time: number, L: FrameLight, env: SceneEnv): void {
    const placed = useGame.getState().decor;
    const editing = useUi.getState().decorMode;
    const seasonKey = `${env.season.season}:${Math.round(env.season.autumn * 2)}:${Math.round(env.season.blossom * 2)}:${Math.round(env.weather.snowCover * 2)}`;
    const lanterns: { x: number; y: number }[] = [];
    this.slots.forEach((v, i) => {
      const id = placed[i] ?? null;
      const key = id ? `${id}:${seasonKey}` : '';
      if (key !== v.key) {
        v.key = key;
        v.sprite?.destroy({ texture: true, textureSource: true });
        v.glow?.destroy();
        v.sprite = null;
        v.glow = null;
        v.id = id;
        if (id) {
          const art = paintDecor(id, env.season, env.weather.snowCover);
          const s = new Sprite(art.texture);
          s.anchor.set(0.5, 1);
          // Un peu plus grand que nature : la berge est vue de près
          s.scale.set((art.width / art.texture.width) * 1.25);
          // Légère symétrie selon le côté de la berge : les objets « regardent » l'eau
          if (BANK_SLOTS[i]!.x > 340 && (id === 'shishi' || id === 'fern')) s.scale.x *= -1;
          v.root.addChildAt(s, 0);
          v.sprite = s;
          if (art.light) {
            const g = new Sprite(sharedTextures().glow);
            g.anchor.set(0.5);
            g.position.set(art.light.x, art.light.y);
            g.blendMode = 'add';
            g.tint = 0xffc36a;
            v.root.addChild(g);
            v.glow = g;
          }
        }
      }
      v.marker.visible = editing && !id;
      if (v.marker.visible) v.marker.alpha = 0.65 + 0.35 * Math.sin(time * 3 + i);
      if (v.sprite && v.id && SWAYS.has(v.id))
        v.sprite.skew.x = Math.sin(time * (0.8 + L.wind) + v.phase) * (0.015 + L.wind * 0.04);
      if (v.glow) {
        const on = clamp(L.night * 1.3 - 0.25);
        v.glow.visible = on > 0.02;
        v.glow.alpha = on * (0.85 + 0.15 * Math.sin(time * 7 + v.phase));
        v.glow.scale.set(1.6 + on * 0.6);
        if (on > 0.02) lanterns.push({ x: v.root.x, y: v.root.y });
      }
    });
    this.scene.lanterns = lanterns;
  }

  destroy(): void {
    for (const v of this.slots) v.root.destroy({ children: true });
  }
}
