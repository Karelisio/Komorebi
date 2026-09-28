// Captures de la scène à différents moments (validation visuelle et perf).
// Usage : node scripts/shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });

const cases = (
  process.env.SHOTS ??
  [
    'aube:t=2026-06-21T03:45:00Z',
    'matin:t=2026-06-21T05:30:00Z',
    'midi:t=2026-06-21T10:30:00Z',
    'heure-doree:t=2026-06-21T18:45:00Z',
    'crepuscule:t=2026-06-21T19:50:00Z',
    'nuit:t=2026-06-21T22:30:00Z',
    'pluie:t=2026-06-21T10:30:00Z&weather=rain',
    'neige:t=2026-01-20T11:00:00Z&weather=snow',
    'automne:t=2026-10-28T14:00:00Z',
    'sakura:t=2026-04-05T09:00:00Z',
    'brouillard:t=2026-11-10T08:30:00Z&weather=fog',
  ].join(',')
).split(',');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const c of cases) {
  const i = c.indexOf(':');
  const name = c.slice(0, i);
  const query = c.slice(i + 1);
  await page.goto(`${base}?${query}`);
  await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('ok', name);
}
await browser.close();
