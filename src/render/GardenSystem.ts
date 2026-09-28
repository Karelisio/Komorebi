import { Container, Graphics, Sprite } from 'pixi.js';
import { clock } from '@/engine/clock';
import { CATALOG } from '@/garden/catalog';
import { bloomOf, canHarvest, thirst } from '@/garden/growth';
import { SAND_ZONE } from '@/garden/placement';
import { useGame } from '@/state/game';
import type { GardenObject } from '@/state/types';
import { useUi } from '@/state/ui';
import { clamp, mixRgb, rgbToHex } from '@/world/math';
import { drawDecor, decorLookKey, type DecorLook } from './decor';
import { Particles } from './particles';
import { SandView } from './SandView';
import type { FrameLight, Scene, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';
import { treeLookKey, type TreeLook } from './trees';
import { TreeView } from './TreeView';

interface ObjectView {
  id: string;
  root: Container;
  g: Graphics;
  tree: TreeView | null;
  key: string;
  glow: Sprite | null;
  pool: Sprite | null;
  light: { x: number; y: number; radius: number } | null;
  sparkle: Sprite | null;
  phase: number;
}

export interface LightSource {
  x: number;
  y: number;
  intensity: number;
}

/** Rendu et interactions des objets du jardin (plantes, pierres, lanternes…). */
export class GardenSystem implements SceneSystem {
  private readonly views = new Map<string, ObjectView>();
  readonly sand = new SandView();
  readonly fx = new Particles(500);
  private ghost: Container | null = null;
  private ghostKind: string | null = null;
  private readonly selection = new Graphics();
  private unsub: () => void;
  private dirty = true;
  lights: LightSource[] = [];

  constructor(private readonly scene: Scene) {
    scene.objects.addChild(this.sand.container);
    scene.worldFx.addChild(this.fx.container);
    scene.objects.addChild(this.selection);
    this.selection.zIndex = 1e6;
    const sand = useGame.getState().sand;
    if (sand.data) void this.sand.load(sand.data);
    else
      this.sand.drawDefault(
        useGame
          .getState()
          .objects.filter(
            (o) => CATALOG[o.kind].category === 'stone' && this.sand.contains(o.x, o.y),
          )
          .map((o) => ({ x: o.x, y: o.y, r: CATALOG[o.kind].radius })),
      );
    this.unsub = useGame.subscribe((s, prev) => {
      if (s.objects !== prev.objects) this.dirty = true;
    });
  }

  private lookFor(
    o: GardenObject,
    env: SceneEnv,
    night: number,
  ): { tree?: TreeLook; decor?: DecorLook } {
    const e = CATALOG[o.kind];
    const snow = env.weather.snowCover;
    if (e.tree) {
      return {
        tree: {
          species: e.tree,
          seed: o.seed,
          growth: o.growth,
          prune: o.prune,
          season: env.season,
          snow,
          thirst: thirst(o),
          height: e.height,
        },
      };
    }
    void night;
    return {
      decor: {
        kind: o.kind,
        seed: o.seed,
        growth: e.grows ? o.growth : 1,
        bloom: bloomOf(o.kind, env.season.day),
        season: env.season,
        snow,
        thirst: thirst(o),
        flip: o.flip,
      },
    };
  }

  private sync(env: SceneEnv, night: number): void {
    const objects = useGame.getState().objects;
    const ids = new Set(objects.map((o) => o.id));
    for (const [id, v] of this.views) {
      if (!ids.has(id)) {
        v.root.destroy({ children: true });
        this.views.delete(id);
      }
    }
    const now = clock.now();
    const moving = useUi.getState().movingObject;
    this.lights = [];
    // Ombres portées des arbres plantés (les plus grands d'abord)
    const canopies = objects
      .filter((o) => CATALOG[o.kind].category === 'tree' && o.growth > 0.3)
      .sort((a, b) => b.growth - a.growth)
      .map((o) => {
        const h = CATALOG[o.kind].height * (0.22 + 0.78 * o.growth);
        return [o.x + 10, o.y + 6, h * 0.45, h * 0.2] as const;
      });
    this.scene.ground.setCanopies([...this.scene.fixedCanopies, ...canopies]);
    for (const o of objects) {
      let v = this.views.get(o.id);
      if (!v) {
        const root = new Container();
        const g = new Graphics();
        root.addChild(g);
        this.scene.objects.addChild(root);
        v = {
          id: o.id,
          root,
          g,
          tree: null,
          key: '',
          glow: null,
          pool: null,
          light: null,
          sparkle: null,
          phase: (o.seed % 100) / 10,
        };
        this.views.set(o.id, v);
      }
      const look = this.lookFor(o, env, night);
      const key = look.tree ? treeLookKey(look.tree) : look.decor ? decorLookKey(look.decor) : '';
      if (key !== v.key) {
        if (look.tree) {
          if (!v.tree) {
            v.tree = new TreeView();
            v.root.addChild(v.tree.root);
          }
          v.tree.set(look.tree);
          v.light = null;
        } else if (look.decor) {
          v.light = drawDecor(v.g, look.decor).light ?? null;
        }
        v.key = key;
      }
      v.root.position.set(o.x, o.y);
      v.root.zIndex = o.y;
      if (v.tree) v.tree.root.scale.x = o.flip ? -1 : 1;
      v.root.alpha = moving === o.id ? 0.55 : 1;
      if (v.light) {
        if (!v.glow) {
          v.glow = new Sprite(sharedTextures().glow);
          v.glow.anchor.set(0.5);
          v.glow.blendMode = 'add';
          v.glow.tint = 0xffc070;
          // Flaque de lumière chaude sur le sol
          v.pool = new Sprite(sharedTextures().glow);
          v.pool.anchor.set(0.5);
          v.pool.blendMode = 'add';
          v.pool.tint = 0xffb45a;
          v.pool.position.set(0, 4);
          v.root.addChildAt(v.pool, 0);
          v.root.addChild(v.glow);
        }
        v.glow.position.set(v.light.x, v.light.y);
        this.lights.push({ x: o.x + v.light.x, y: o.y + v.light.y, intensity: 1 });
      }
      const ready = canHarvest(o, now);
      if (ready && !v.sparkle) {
        v.sparkle = new Sprite(sharedTextures().petal);
        v.sparkle.anchor.set(0.5);
        v.sparkle.tint = 0xf6c6d4;
        v.sparkle.scale.set(0.55);
        v.root.addChild(v.sparkle);
      } else if (!ready && v.sparkle) {
        v.sparkle.destroy();
        v.sparkle = null;
      }
    }
  }

  update(dt: number, time: number, light: FrameLight, env: SceneEnv): void {
    const night = light.night;
    if (this.dirty || Math.floor(time) !== Math.floor(time - dt)) {
      this.sync(env, night);
      this.dirty = false;
    }
    const wind = light.wind;
    for (const v of this.views.values()) {
      const o = useGame.getState().objects.find((x) => x.id === v.id);
      if (!o) continue;
      const e = CATALOG[o.kind];
      if (v.tree) v.tree.sway(time, wind, v.phase, this.scene.sun, v.tree.root.scale.x);
      else if (e.category === 'plant') {
        v.g.skew.x =
          Math.sin(time * (0.7 + wind) + v.phase) *
          (0.008 + wind * 0.035) *
          (e.category === 'plant' ? 1.6 : 1);
      }
      if (v.glow) {
        const flicker =
          0.85 + 0.15 * Math.sin(time * 7 + v.phase) * Math.sin(time * 3.1 + v.phase * 2);
        v.glow.alpha = clamp(night * 1.2 - 0.1) * flicker;
        v.glow.tint = this.scene.accent
          ? rgbToHex(mixRgb([1, 0.75, 0.44], this.scene.accent, 0.35))
          : 0xffc070;
        v.glow.scale.set((1.6 + night * 1.2) * flicker);
        if (v.pool) {
          v.pool.alpha = clamp(night * 1.1 - 0.15) * 0.55 * (0.92 + 0.08 * flicker);
          v.pool.scale.set(4.2, 1.6);
          v.pool.tint = v.glow.tint;
        }
      }
      if (v.sparkle) {
        v.sparkle.position.set(
          Math.sin(time * 1.3 + v.phase) * 6,
          -e.height * 0.8 - 16 + Math.sin(time * 2 + v.phase) * 4,
        );
        v.sparkle.rotation = Math.sin(time + v.phase) * 0.6;
      }
    }
    this.scene.lanterns = this.lights;
    this.sand.update(env.weather.snowCover, env.weather.wetness);
    this.fx.update(dt, wind * 20);
    this.updateGhost();
    this.updateSelection();
  }

  private updateGhost(): void {
    const ui = useUi.getState();
    if (ui.tool !== 'place' || !ui.placing || !ui.ghost) {
      if (this.ghost) {
        this.ghost.destroy({ children: true });
        this.ghost = null;
        this.ghostKind = null;
      }
      return;
    }
    if (!this.ghost || this.ghostKind !== ui.placing) {
      this.ghost?.destroy({ children: true });
      this.ghost = new Container();
      const g = new Graphics();
      const e = CATALOG[ui.placing];
      const env = this.scene.env;
      if (env) {
        const fake: GardenObject = {
          id: 'ghost',
          kind: ui.placing,
          x: 0,
          y: 0,
          seed: 7,
          placedAt: 0,
          water: 1,
          lastWateredAt: 0,
          prune: 0,
          pruneCount: 0,
          growth: e.grows ? 0.6 : 1,
          flip: false,
          harvestAt: 0,
        };
        const look = this.lookFor(fake, env, 0);
        if (look.tree) {
          const tv = new TreeView();
          tv.set(look.tree);
          g.addChild(tv.root);
        } else if (look.decor) drawDecor(g, look.decor);
      }
      const ring = new Graphics();
      ring
        .ellipse(0, 0, e.radius, e.radius * 0.55)
        .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
      this.ghost.addChild(ring, g);
      this.ghost.zIndex = 1e6;
      this.scene.objects.addChild(this.ghost);
      this.ghostKind = ui.placing;
    }
    this.ghost.position.set(ui.ghost.x, ui.ghost.y);
    this.ghost.alpha = ui.ghost.valid ? 0.8 : 0.35;
    const ring = this.ghost.children[0] as Graphics;
    ring.tint = ui.ghost.valid ? 0xffffff : 0xff8a7a;
  }

  private updateSelection(): void {
    const id = useUi.getState().selectedObject ?? useUi.getState().movingObject;
    this.selection.clear();
    if (!id) return;
    const o = useGame.getState().objects.find((x) => x.id === id);
    if (!o) return;
    const r = CATALOG[o.kind].radius;
    this.selection
      .ellipse(o.x, o.y, r + 8, (r + 8) * 0.55)
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
  }

  /** Objet sous le doigt (le plus au premier plan). */
  hitTest(x: number, y: number): GardenObject | null {
    let best: GardenObject | null = null;
    for (const o of useGame.getState().objects) {
      const e = CATALOG[o.kind];
      const h = Math.max(e.height * (e.grows ? 0.3 + 0.7 * o.growth : 1), 20);
      const cx = o.x;
      const cy = o.y - h * 0.4;
      const rx = Math.max(e.radius, 26);
      const ry = Math.max(h * 0.55, 26);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
        if (!best || o.y > best.y) best = o;
      }
    }
    return best;
  }

  /** Arrosage au geste : les plantes proches reçoivent de l'eau, gouttelettes à l'écran. */
  waterAt(x: number, y: number, dt: number): string[] {
    const tex = sharedTextures().dot;
    for (let i = 0; i < 3; i++) {
      this.fx.emit({
        texture: tex,
        x: x + (Math.random() - 0.5) * 30,
        y: y - 60 - Math.random() * 20,
        vx: (Math.random() - 0.5) * 30,
        vy: 60 + Math.random() * 60,
        gy: 420,
        life: 1.2,
        tint: 0xbfe3ff,
        alpha: 0.85,
        scale: 0.35 + Math.random() * 0.2,
        floor: y + (Math.random() - 0.5) * 16,
      });
    }
    const hits: string[] = [];
    for (const o of useGame.getState().objects) {
      if (!CATALOG[o.kind].grows) continue;
      if (Math.hypot(o.x - x, (o.y - y) * 1.4) < 70) hits.push(o.id);
    }
    if (hits.length) useGame.getState().waterObjects(hits, dt * 0.8, clock.now());
    return hits;
  }

  /** Feuilles qui tombent à la taille. */
  pruneFx(o: GardenObject): void {
    const e = CATALOG[o.kind];
    const tex = sharedTextures().maple;
    for (let i = 0; i < 10; i++) {
      this.fx.emit({
        texture: tex,
        x: o.x + (Math.random() - 0.5) * e.radius * 2,
        y: o.y - e.height * (0.4 + Math.random() * 0.5),
        vx: (Math.random() - 0.5) * 40,
        vy: 10 + Math.random() * 20,
        gy: 40,
        life: 3,
        tint: 0x6f9a4a,
        scale: 0.2 + Math.random() * 0.1,
        vrot: (Math.random() - 0.5) * 4,
        sway: 10,
        floor: o.y + Math.random() * 20,
      });
    }
  }

  /** Pétales qui s'envolent à la récolte. */
  harvestFx(o: GardenObject): void {
    const tex = sharedTextures().petal;
    for (let i = 0; i < 12; i++) {
      this.fx.emit({
        texture: tex,
        x: o.x + (Math.random() - 0.5) * 30,
        y: o.y - CATALOG[o.kind].height * 0.6,
        vx: (Math.random() - 0.5) * 80,
        vy: -60 - Math.random() * 60,
        gy: 30,
        life: 2.2,
        tint: 0xf6c6d4,
        scale: 0.4 + Math.random() * 0.3,
        vrot: (Math.random() - 0.5) * 5,
        sway: 8,
      });
    }
  }

  destroy(): void {
    this.unsub();
  }
}

export { SAND_ZONE };
