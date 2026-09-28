import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { GameClock } from './clock';

describe('GameClock', () => {
  it('suit le temps réel puis accélère sans saut', () => {
    let real = 1_000_000;
    const c = new GameClock(() => real);
    real += 1000;
    expect(c.now()).toBe(1_001_000);
    c.setSpeed(60);
    expect(c.now()).toBe(1_001_000);
    real += 1000;
    expect(c.now()).toBe(1_061_000);
    c.reset();
    expect(c.now()).toBe(real);
    expect(c.isReal).toBe(true);
  });
});

describe('Camera', () => {
  it('conversions écran ↔ monde réciproques et bornes respectées', () => {
    const cam = new Camera({ x: 0, y: 0, width: 2000, height: 3000 });
    cam.resize(400, 800);
    cam.lookAt(1000, 1500, 1);
    const w = cam.screenToWorld(123, 456);
    const s = cam.worldToScreen(w.x, w.y);
    expect(s.x).toBeCloseTo(123);
    expect(s.y).toBeCloseTo(456);
    cam.lookAt(-500, -500);
    const v = cam.visible();
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.y).toBeGreaterThanOrEqual(0);
  });

  it('le zoom au pinch garde le point sous les doigts', () => {
    const cam = new Camera({ x: 0, y: 0, width: 4000, height: 4000 });
    cam.resize(400, 800);
    cam.lookAt(2000, 2000, 1);
    const before = cam.screenToWorld(100, 200);
    cam.zoomAt(1.5, 100, 200);
    const after = cam.screenToWorld(100, 200);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});
