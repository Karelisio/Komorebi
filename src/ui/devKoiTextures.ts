import { randomGenome, express, type Variety } from '@/pond/genetics';
import { drawKoiCanvas } from '@/render/koiTexture';

/** Planche de textures de koïs (debug : ?koitex=1). */
export function renderKoiSheet(root: HTMLElement): void {
  root.style.cssText =
    'overflow:auto;background:#1d3a3a;padding:12px;display:flex;flex-wrap:wrap;gap:10px;touch-action:auto';
  const templates: (Variety | undefined)[] = [
    'kohaku',
    'sanke',
    'showa',
    'chagoi',
    'ogon',
    'asagi',
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  templates.forEach((t, i) => {
    const g = randomGenome(100 + i * 7, t);
    const c = drawKoiCanvas(g, 192, 64);
    c.style.cssText = 'width:192px;height:64px;background:#2a4a48';
    const box = document.createElement('div');
    box.style.cssText = 'color:#fff;font:12px sans-serif';
    box.textContent = express(g).variety;
    box.prepend(c);
    root.appendChild(box);
  });
}
