import { Container, Graphics } from 'pixi.js';
import { CATALOG, type CatalogId } from '@/garden/catalog';
import { computeSeason } from '@/world/season';
import { drawDecor } from './decor';
import type { Scene } from './Scene';
import { drawTree } from './trees';

const cache = new Map<string, string>();

/** Vignette (data URL) d'un élément du catalogue, dessinée avec le moteur du jeu. */
export function thumbnail(scene: Scene, kind: CatalogId): string {
  const hit = cache.get(kind);
  if (hit) return hit;
  const e = CATALOG[kind];
  const season = scene.env?.season ?? computeSeason(new Date(), 45);
  const g = new Graphics();
  if (e.tree)
    drawTree(g, {
      species: e.tree,
      seed: 7,
      growth: 0.85,
      prune: 0.2,
      season,
      snow: 0,
      thirst: 0,
      height: e.height,
    });
  else
    drawDecor(g, {
      kind,
      seed: 7,
      growth: 1,
      bloom: e.bloom ? 1 : 0,
      season,
      snow: 0,
      thirst: 0,
      flip: false,
    });
  const box = new Container();
  box.addChild(g);
  const b = box.getLocalBounds();
  const scale = 96 / Math.max(b.width, b.height, 1);
  g.scale.set(scale);
  const canvas = scene.renderer.extract.canvas({
    target: box,
    resolution: 2,
    antialias: true,
  }) as HTMLCanvasElement;
  const url = canvas.toDataURL('image/png');
  box.destroy({ children: true });
  cache.set(kind, url);
  return url;
}

export function clearThumbnails(): void {
  cache.clear();
}
