import { Graphics } from 'pixi.js';
import { hexToRgb, mixRgb, rgbToHex } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { PondShape } from '@/world/layout';

/** Berge : bande de mousse, galets et quelques rochers, dessinés au-dessus du bord de l'eau. */
export function drawPondRim(shape: PondShape, seed = 1): Graphics {
  const g = new Graphics();
  const rng = mulberry32(seed);
  const pts = shape.points;
  const flat: number[] = pts.flatMap((p) => [p.x, p.y]);
  // Mousse humide autour du bassin
  g.poly(flat).stroke({ width: 26, color: 0x3b5634, alpha: 0.9, join: 'round' });
  g.poly(flat).stroke({ width: 12, color: 0x2c4029, alpha: 0.9, join: 'round' });

  const stoneBase = hexToRgb('#8d8a80');
  const stoneDark = hexToRgb('#5b5a55');
  const stones: { x: number; y: number; rx: number; ry: number; tone: number; rot: number }[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    const steps = 2;
    for (let k = 0; k < steps; k++) {
      const t = k / steps + rng() * 0.2;
      const x = p.x + (q.x - p.x) * t;
      const y = p.y + (q.y - p.y) * t;
      // Décale légèrement vers l'extérieur
      const dx = x - shape.cx;
      const dy = y - shape.cy;
      const d = Math.hypot(dx, dy) || 1;
      const out = 4 + rng() * 8;
      const big = rng() < 0.08;
      const r = big ? 22 + rng() * 14 : 8 + rng() * 9;
      stones.push({
        x: x + (dx / d) * out,
        y: y + (dy / d) * out * 0.8,
        rx: r,
        ry: r * (0.55 + rng() * 0.2),
        tone: rng(),
        rot: (rng() - 0.5) * 0.6,
      });
    }
  }
  stones.sort((a, b) => a.y - b.y);
  for (const s of stones) {
    const base = mixRgb(stoneDark, stoneBase, 0.35 + s.tone * 0.65);
    g.ellipse(s.x + 2, s.y + s.ry * 0.45, s.rx * 1.02, s.ry * 0.8).fill({
      color: 0x1b221a,
      alpha: 0.35,
    });
    g.ellipse(s.x, s.y, s.rx, s.ry).fill(rgbToHex(base));
    g.ellipse(s.x - s.rx * 0.22, s.y - s.ry * 0.3, s.rx * 0.6, s.ry * 0.45).fill({
      color: rgbToHex(mixRgb(base, [1, 1, 1], 0.28)),
      alpha: 0.8,
    });
    if (rng() < 0.35)
      g.ellipse(s.x + s.rx * 0.2, s.y - s.ry * 0.5, s.rx * 0.45, s.ry * 0.25).fill({
        color: 0x5d7a45,
        alpha: 0.85,
      });
  }
  // Touffes d'iris et de joncs
  for (let i = 0; i < 7; i++) {
    const p = pts[Math.floor(rng() * n)]!;
    for (let b = 0; b < 7; b++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 0.9;
      const l = 22 + rng() * 26;
      g.moveTo(p.x, p.y)
        .quadraticCurveTo(
          p.x + Math.cos(a) * l * 0.4,
          p.y + Math.sin(a) * l * 0.6,
          p.x + Math.cos(a) * l,
          p.y + Math.sin(a) * l,
        )
        .stroke({ width: 2.2, color: rng() < 0.5 ? 0x4f7a3a : 0x3c6a34, cap: 'round' });
    }
  }
  return g;
}
