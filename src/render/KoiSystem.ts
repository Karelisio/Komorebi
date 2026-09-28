import { Container, MeshRope, Point, Sprite } from 'pixi.js';
import { clock } from '@/engine/clock';
import { spawnAgent, stepBoids, type BoidsWorld, type FishAgent, type Pellet } from '@/pond/boids';
import { express } from '@/pond/genetics';
import { koiSize, type KoiRecord } from '@/pond/koi';
import { useGame } from '@/state/game';
import { mixRgb, rgbToHex } from '@/world/math';
import { mulberry32 } from '@/world/random';
import type { PondView } from './PondView';
import type { FrameLight, SceneEnv, SceneSystem } from './Scene';
import { makeKoiTextures, type KoiTextureSet } from './koiTexture';
import { sharedTextures } from './textures';

const SEGMENTS = 10;

/**
 * MeshRope de Pixi v8 réimpose la hauteur de la texture comme largeur à chaque rendu :
 * on remplace ce callback pour garder notre largeur.
 */
function makeRope(texture: MeshRope['texture'], points: Point[], width: () => number): MeshRope {
  const rope = new MeshRope({ texture, points, width: width() });
  const geom = rope.geometry as unknown as { _width: number; update(): void };
  rope.onRender = () => {
    geom._width = width();
    geom.update();
  };
  return rope;
}
/** Longueur d'un koï adulte (unités monde). */
const ADULT_LENGTH = 96;

interface KoiView {
  record: KoiRecord;
  agent: FishAgent;
  tex: KoiTextureSet;
  base: Point[];
  points: Point[];
  rope: MeshRope;
  shadow: MeshRope;
  shadowPoints: Point[];
  length: number;
}

interface PondRuntime {
  pond: PondView;
  world: BoidsWorld;
  shadows: Container;
  fish: Container;
  pellets: Map<number, Sprite>;
}

export class KoiSystem implements SceneSystem {
  private readonly views = new Map<string, KoiView>();
  private readonly ponds = new Map<string, PondRuntime>();
  private readonly rng = mulberry32(Date.now() & 0xffff);
  private pelletSeq = 1;
  private lastSync = -1;
  private hiRes: boolean;
  onEat?: (koi: KoiRecord) => void;

  constructor(ponds: PondView[], hiRes: boolean) {
    this.hiRes = hiRes;
    for (const p of ponds) this.addPond(p);
  }

  addPond(pond: PondView): void {
    const shadows = new Container();
    const fish = new Container();
    fish.sortableChildren = true;
    pond.underwater.addChild(shadows, fish);
    this.ponds.set(pond.shape.id, {
      pond,
      world: { shape: pond.shape, food: [], attractor: null, time: 0 },
      shadows,
      fish,
      pellets: new Map(),
    });
  }

  /** Nourrit : dépose quelques granulés autour du point touché. */
  feedAt(x: number, y: number): boolean {
    for (const rt of this.ponds.values()) {
      if (!rt.pond.contains(x, y)) continue;
      const n = 3 + Math.floor(this.rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = this.rng() * Math.PI * 2;
        const r = this.rng() * 22;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.7;
        if (!rt.pond.contains(px, py)) continue;
        const pellet: Pellet = { id: this.pelletSeq++, x: px, y: py, age: 0 };
        rt.world.food.push(pellet);
        const s = new Sprite(sharedTextures().dot);
        s.anchor.set(0.5);
        s.scale.set(0.42);
        s.tint = 0x9a6a3a;
        s.position.set(px, py);
        rt.pond.surface.addChild(s);
        rt.pellets.set(pellet.id, s);
        rt.pond.touch(px, py, 0.35, 0.012);
      }
      return true;
    }
    return false;
  }

  /** Le doigt attire les koïs curieux. */
  setAttractor(x: number, y: number): void {
    for (const rt of this.ponds.values())
      rt.world.attractor = rt.pond.contains(x, y) ? { x, y } : null;
  }

  clearAttractor(): void {
    for (const rt of this.ponds.values()) rt.world.attractor = null;
  }

  /** Koï sous le doigt (coordonnées monde). */
  hitTest(x: number, y: number): KoiRecord | null {
    let best: KoiView | null = null;
    let bd = Infinity;
    for (const v of this.views.values()) {
      const rt = this.ponds.get(v.record.pondId);
      if (!rt) continue;
      const hx = v.agent.x;
      const hy = v.agent.y;
      // Centre du corps : un peu derrière la tête
      const p = v.base[3] ?? v.base[0]!;
      const cx = (hx + p.x + rt.pond.shape.bbox.x) / 2;
      const cy = (hy + p.y + rt.pond.shape.bbox.y) / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < v.length * 0.55 && d < bd) {
        bd = d;
        best = v;
      }
    }
    return best?.record ?? null;
  }

  agentOf(id: string): FishAgent | undefined {
    return this.views.get(id)?.agent;
  }

  private sync(now: number): void {
    const kois = useGame.getState().kois;
    const alive = new Set(kois.map((k) => k.id));
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        v.rope.destroy();
        v.shadow.destroy();
        v.tex.body.destroy(true);
        v.tex.fin.destroy(true);
        this.views.delete(id);
      }
    }
    for (const k of kois) {
      const rt = this.ponds.get(k.pondId);
      if (!rt) continue;
      const existing = this.views.get(k.id);
      if (existing) {
        existing.record = k;
        existing.agent.size = koiSize(k, now);
        existing.length = ADULT_LENGTH * existing.agent.size;
        continue;
      }
      this.views.set(k.id, this.createView(k, rt, now));
      useGame.getState().discoverVariety(k, now);
    }
  }

  private createView(k: KoiRecord, rt: PondRuntime, now: number): KoiView {
    const size = koiSize(k, now);
    const agent = spawnAgent(k.id, rt.pond.shape, this.rng, size);
    agent.boldness = express(k.genome).ground === 'C' ? 1 : agent.boldness;
    const tex = makeKoiTextures(k.genome, this.hiRes);
    const length = ADULT_LENGTH * size;
    const ox = rt.pond.shape.bbox.x;
    const oy = rt.pond.shape.bbox.y;
    const base = Array.from(
      { length: SEGMENTS },
      (_, i) => new Point(agent.x - ox - i * 3, agent.y - oy),
    );
    const points = base.map((p) => new Point(p.x, p.y));
    const shadowPoints = base.map((p) => new Point(p.x, p.y));
    const view = { length } as { length: number };
    const rope = makeRope(tex.body, points, () => view.length * 0.5);
    const shadow = makeRope(tex.body, shadowPoints, () => view.length * 0.52);
    shadow.tint = 0x000000;
    shadow.alpha = 0.22;
    rt.shadows.addChild(shadow);
    rt.fish.addChild(rope);
    return Object.assign(view, { record: k, agent, tex, base, points, rope, shadow, shadowPoints });
  }

  update(dt: number, time: number, light: FrameLight, env: SceneEnv): void {
    const now = clock.now();
    if (time - this.lastSync > 1 || this.lastSync < 0) {
      this.sync(now);
      this.lastSync = time;
    }
    const cold = env.weather.temperature < 6 ? 0.55 : 1;
    for (const rt of this.ponds.values()) {
      rt.world.time = time;
      const agents: FishAgent[] = [];
      for (const v of this.views.values())
        if (v.record.pondId === rt.pond.shape.id) agents.push(v.agent);
      stepBoids(agents, rt.world, dt * cold, this.rng, {
        onEat: (fish, pellet) => {
          rt.pond.touch(pellet.x, pellet.y, 0.8, 0.018);
          const view = this.views.get(fish.id);
          if (view) {
            useGame.getState().onKoiAte(fish.id);
            this.onEat?.(view.record);
          }
        },
      });
      // Granulés : flottent puis coulent
      for (const [id, s] of rt.pellets) {
        const p = rt.world.food.find((f) => f.id === id);
        if (!p) {
          s.destroy();
          rt.pellets.delete(id);
          continue;
        }
        p.age += dt;
        s.alpha = Math.max(0, 1 - p.age / 40);
        s.y = p.y + rt.pond.heightAtWorld(p.x, p.y) * 3;
        if (p.age > 40) rt.world.food = rt.world.food.filter((f) => f.id !== id);
      }
    }

    const tintDeep = mixRgb([1, 1, 1], [0.55, 0.68, 0.66], 1);
    for (const v of this.views.values()) {
      const rt = this.ponds.get(v.record.pondId);
      if (!rt) continue;
      this.animate(v, rt, dt);
      const z = v.agent.z;
      v.rope.tint = rgbToHex(mixRgb([1, 1, 1], tintDeep, z * 0.75));
      v.rope.zIndex = -z;
      const off = 3 + (1 - z) * 9;
      v.shadow.position.set(off * 0.6, off);
      v.shadow.alpha = 0.12 + z * 0.14 + light.sunStrength * 0.06;
      // Bulle de surface occasionnelle
      if (z < 0.08 && this.rng() < dt * 0.15) rt.pond.touch(v.agent.x, v.agent.y, 0.25, 0.01);
    }
  }

  private animate(v: KoiView, rt: PondRuntime, dt: number): void {
    const ox = rt.pond.shape.bbox.x;
    const oy = rt.pond.shape.bbox.y;
    const seg = v.length / (SEGMENTS - 1);
    const head = v.base[0]!;
    head.set(v.agent.x - ox, v.agent.y - oy);
    // Suivi de la tête avec angle maximal entre segments (colonne souple mais pas pliable)
    let prevAng = Math.atan2(-v.agent.vy, -v.agent.vx);
    for (let i = 1; i < SEGMENTS; i++) {
      const prev = v.base[i - 1]!;
      const p = v.base[i]!;
      let ang = Math.atan2(p.y - prev.y, p.x - prev.x);
      let diff = ang - prevAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxBend = 0.32;
      if (diff > maxBend) ang = prevAng + maxBend;
      else if (diff < -maxBend) ang = prevAng - maxBend;
      p.set(prev.x + Math.cos(ang) * seg, prev.y + Math.sin(ang) * seg);
      prevAng = ang;
    }
    const speedK = 0.35 + Math.min(1, v.agent.speed / 45) * 0.9;
    const amp = v.length * 0.07 * speedK;
    for (let i = 0; i < SEGMENTS; i++) {
      const b = v.base[i]!;
      const a = v.base[Math.max(0, i - 1)]!;
      const c = v.base[Math.min(SEGMENTS - 1, i + 1)]!;
      let tx = c.x - a.x;
      let ty = c.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const k = i / (SEGMENTS - 1);
      const w = Math.sin(v.agent.phase - i * 0.75) * amp * Math.pow(k, 1.3);
      v.points[i]!.set(b.x - ty * w, b.y + tx * w);
      v.shadowPoints[i]!.set(v.points[i]!.x, v.points[i]!.y);
    }
    void dt;
  }

  destroy(): void {
    for (const v of this.views.values()) {
      v.tex.body.destroy(true);
      v.tex.fin.destroy(true);
    }
    this.views.clear();
  }
}
