import { Application, Container, Graphics, Text } from 'pixi.js';
import { CATALOG, CATALOG_IDS, type CatalogId } from '@/garden/catalog';
import { drawDecor, type DecorLook } from '@/render/decor';
import { hash } from '@/world/random';
import { computeSeason, type SeasonState } from '@/world/season';

/** Catalogue hors arbres (maple/cherry/pine/bamboo dessinés par trees.ts). */
const NON_TREE_IDS: CatalogId[] = CATALOG_IDS.filter((id) => CATALOG[id].category !== 'tree');

interface Cell {
  label: string;
  look: DecorLook;
}

const COLS = 3;
const CELL_W = 131;
const CELL_H = 190;

/** Planche de debug du décor (?decor=1) : une grille de tous les objets non-arbres. */
export async function renderDecorSheet(root: HTMLElement): Promise<void> {
  root.style.overflow = 'auto';
  root.style.touchAction = 'auto';
  root.style.background = '#5d7a4c';

  const app = new Application();
  await app.init({
    preference: 'webgl',
    background: 0x5d7a4c,
    width: 393,
    height: 1400,
    antialias: true,
  });
  root.appendChild(app.canvas);
  app.canvas.style.display = 'block';

  // Belle saison (feuillage plein, floraisons possibles) et hiver (pour la neige).
  const bloomSeason: SeasonState = computeSeason(new Date('2026-05-10T12:00:00Z'), 45);
  const winterSeason: SeasonState = computeSeason(new Date('2026-01-10T12:00:00Z'), 45);

  const baseLook = (kind: CatalogId, extra: Partial<DecorLook> = {}): DecorLook => ({
    kind,
    seed: hash(kind, 1),
    growth: 1,
    bloom: CATALOG[kind].bloom ? 1 : 0,
    season: bloomSeason,
    snow: 0,
    thirst: 0,
    flip: false,
    ...extra,
  });

  const cells: Cell[] = NON_TREE_IDS.map((id) => ({ label: id, look: baseLook(id) }));

  // Rangée supplémentaire : hiver enneigé pour deux plantes basses.
  cells.push({
    label: 'moss — hiver, neige',
    look: baseLook('moss', { seed: hash('moss', 2), season: winterSeason, snow: 0.8 }),
  });
  cells.push({
    label: 'azalea — hiver, neige',
    look: baseLook('azalea', {
      seed: hash('azalea', 2),
      season: winterSeason,
      snow: 0.8,
      bloom: 0,
    }),
  });
  // Jeune pousse.
  cells.push({
    label: 'fern — jeune (growth=0.3)',
    look: baseLook('fern', { seed: hash('fern', 3), growth: 0.3 }),
  });
  // Plante assoiffée.
  cells.push({
    label: 'hydrangea — soif=1',
    look: baseLook('hydrangea', { seed: hash('hydrangea', 4), thirst: 1 }),
  });

  const rows = Math.ceil(cells.length / COLS);
  app.renderer.resize(393, Math.max(1400, rows * CELL_H + 20));

  cells.forEach((cell, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = col * CELL_W + CELL_W / 2;
    const cellTop = row * CELL_H;

    const label = new Text({
      text: cell.label,
      style: { fontFamily: 'sans-serif', fontSize: 10.5, fill: 0xf5efe3, align: 'center' },
    });
    label.anchor.set(0.5, 0);
    label.position.set(cx, cellTop + 4);
    app.stage.addChild(label);

    const g = new Graphics();
    drawDecor(g, cell.look);
    const b = g.getLocalBounds();
    const availW = CELL_W - 20;
    const availH = CELL_H - 44;
    const scale = Math.min(availW / Math.max(b.width, 1), availH / Math.max(b.height, 1), 3);

    const holder = new Container();
    holder.addChild(g);
    holder.scale.set(scale);
    holder.position.set(cx, cellTop + CELL_H - 14);
    app.stage.addChild(holder);
  });

  app.render();
}
