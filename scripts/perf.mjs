// Mesure de performance : Chromium headless, CPU ralenti ×4, viewport de téléphone milieu de gamme.
// Usage : node scripts/perf.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const quality of ['low', 'medium', 'high']) {
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${base}?debug=1&prof=1&quality=${quality}&t=2026-06-21T18:30:00Z&weather=rain`);
  await page.waitForTimeout(6000);
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const scene = window.__scene;
        let frames = 0;
        const t0 = performance.now();
        const js = [];
        const tick = () => {
          frames++;
          js.push(scene.loop.frameMs);
          if (performance.now() - t0 < 8000) requestAnimationFrame(tick);
          else resolve({ fps: (frames / (performance.now() - t0)) * 1000, jsMs: js.reduce((a, b) => a + b, 0) / js.length, res: scene.renderer.resolution, prof: Object.fromEntries(Object.entries(scene.profile).map(([k, v]) => [k, +v.toFixed(2)])) });
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(quality, JSON.stringify(r));
  await page.close();
}
await browser.close();
