import { Application, Container, Text } from 'pixi.js';
import { TreeView } from '@/render/TreeView';
import type { TreeSpecies } from '@/render/trees';
import { computeSeason } from '@/world/season';

/** Planche de debug des arbres (?trees=1) : essences × saisons. */
export async function renderTreeSheet(root: HTMLElement): Promise<void> {
  root.style.cssText = 'overflow:auto;touch-action:auto;background:#5d7a4c';
  const app = new Application();
  await app.init({
    preference: 'webgl',
    background: 0x6b8a58,
    width: 393,
    height: 1500,
    antialias: true,
  });
  root.appendChild(app.canvas);
  const seasons = [
    ['summer', '2026-07-10'],
    ['spring', '2026-04-05'],
    ['autumn', '2026-10-28'],
    ['winter', '2026-01-20'],
  ] as const;
  const species: TreeSpecies[] = ['maple', 'cherry', 'pine', 'bamboo'];
  const cellW = 393 / 2;
  const cellH = 360;
  species.forEach((sp, i) => {
    seasons.slice(0, 2).forEach(([name, date], j) => {
      const c = new Container();
      c.position.set(j * cellW + cellW / 2, i * cellH + cellH - 30);
      const tv = new TreeView();
      tv.set({
        species: sp,
        seed: 12 + i,
        growth: 1,
        prune: 0.15,
        season: computeSeason(new Date(`${date}T12:00:00Z`), 45),
        snow: 0,
        thirst: 0,
        height: 300,
      });
      c.addChild(tv.root);
      const label = new Text({ text: `${sp} ${name}`, style: { fontSize: 12, fill: 0xffffff } });
      label.position.set(-cellW / 2 + 6, 6);
      c.addChild(label);
      app.stage.addChild(c);
    });
  });
  app.render();
}
