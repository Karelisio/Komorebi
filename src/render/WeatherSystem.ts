import { Container, Sprite } from 'pixi.js';
import type { NatureActivity } from '@/world/events';
import { WORLD } from '@/world/layout';
import { Particles, type Particle } from './particles';
import type { PondView } from './PondView';
import type { FrameLight, Scene, SceneEnv, SceneSystem } from './Scene';
import { sharedTextures } from './textures';

export type NatureEvent = 'firefly' | 'meteor' | 'frogs' | 'rain' | 'snow' | 'birds';

interface Firefly {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

interface Bird {
  sprite: Container;
  x: number;
  y: number;
  vx: number;
  flap: number;
}

/** Effets météo et vie sauvage : pluie, neige, feuilles, pétales, lucioles, oiseaux, étoiles filantes. */
export class WeatherSystem implements SceneSystem {
  private readonly screen = new Particles(900);
  private readonly world = new Particles(400);
  private readonly sky = new Particles(40);
  private readonly fireflies: Firefly[] = [];
  private readonly flyLayer = new Container();
  private readonly birds: Bird[] = [];
  private readonly floaters: {
    sprite: Sprite;
    pond: PondView;
    x: number;
    y: number;
    rot: number;
    vrot: number;
    life: number;
  }[] = [];
  private readonly birdLayer = new Container();
  private acc = { rain: 0, snow: 0, leaf: 0, petal: 0, meteor: 0, splash: 0, bird: 0, frog: 0 };
  onEvent?: (e: NatureEvent) => void;
  private seen = new Set<NatureEvent>();

  constructor(private readonly scene: Scene) {
    scene.skyLayer.addChild(this.sky.container, this.birdLayer);
    scene.worldFx.addChild(this.world.container, this.flyLayer);
    scene.screenFx.addChildAt(this.screen.container, 0);
  }

  private emitEvent(e: NatureEvent): void {
    this.onEvent?.(e);
    this.seen.add(e);
  }

  update(dt: number, time: number, L: FrameLight, env: SceneEnv): void {
    const q = this.scene.quality.particles;
    const { weather, season, nature } = env;
    const w = this.scene.width;
    const h = this.scene.height;
    const tex = sharedTextures();
    const windPx = (weather.wind / 40) * 160 * (weather.windDir > 180 ? 1 : -1);
    const cam = this.scene.camera.visible();

    // Pluie (espace écran) + gouttes sur l'eau
    if (weather.rain > 0.05) {
      const rate = Math.min(260, 25 + weather.rain * 45) * q;
      this.acc.rain += rate * dt;
      while (this.acc.rain >= 1) {
        this.acc.rain--;
        this.screen.emit({
          texture: tex.streak,
          x: Math.random() * (w + 200) - 100,
          y: -40,
          vx: windPx * 0.6,
          vy: 900 + Math.random() * 300,
          life: 1.4,
          alpha: 0.25 + Math.random() * 0.25,
          scale: 0.6 + Math.random() * 0.5,
          rot: -Math.atan2(windPx * 0.6, 1000),
          tint: 0xd8e4ee,
          floor: h * (0.3 + Math.random() * 0.75),
        });
      }
      this.acc.splash += Math.min(40, weather.rain * 12) * dt;
      while (this.acc.splash >= 1) {
        this.acc.splash--;
        for (const p of this.scene.ponds) {
          const b = p.shape.bbox;
          const x = b.x + Math.random() * b.width;
          const y = b.y + Math.random() * b.height;
          if (p.contains(x, y)) p.touch(x, y, 0.5 + Math.random() * 0.5, 0.008);
        }
      }
      if (!this.seen.has('rain')) this.emitEvent('rain');
    }

    // Neige (espace écran, flocons qui dérivent)
    if (weather.snow > 0.05) {
      this.acc.snow += Math.min(120, 20 + weather.snow * 40) * q * dt;
      while (this.acc.snow >= 1) {
        this.acc.snow--;
        const s = 0.25 + Math.random() * 0.45;
        this.screen.emit({
          texture: tex.dot,
          x: Math.random() * (w + 100) - 50,
          y: -10,
          vx: windPx * 0.3,
          vy: 30 + s * 60,
          life: 14,
          alpha: 0.9,
          scale: s,
          sway: 14,
          floor: h * (0.4 + Math.random() * 0.7),
        });
      }
      if (!this.seen.has('snow')) this.emitEvent('snow');
    }

    // Feuilles d'automne et pétales de cerisier (espace monde, depuis les arbres visibles)
    const leafRate = season.leafFall * (0.5 + L.wind * 2) * 2.2 * q;
    this.acc.leaf += leafRate * dt;
    while (this.acc.leaf >= 1) {
      this.acc.leaf--;
      const cols = [0xc23a24, 0xe0602c, 0xf0a040, 0xb88a34];
      this.world.emit({
        texture: tex.maple,
        x: cam.x + Math.random() * cam.width,
        y: cam.y - 20 + Math.random() * cam.height * 0.4,
        vx: windPx * 0.25 + (Math.random() - 0.5) * 20,
        vy: 18 + Math.random() * 18,
        life: 12,
        tint: cols[Math.floor(Math.random() * cols.length)]!,
        scale: 0.18 + Math.random() * 0.1,
        vrot: (Math.random() - 0.5) * 3,
        sway: 18,
        fadeIn: 0.8,
        floor: cam.y + cam.height * (0.4 + Math.random() * 0.6),
        onLand: (p) => this.land(p),
      });
    }
    const petalRate = season.sakura * (0.6 + L.wind * 2) * 3 * q;
    this.acc.petal += petalRate * dt;
    while (this.acc.petal >= 1) {
      this.acc.petal--;
      this.world.emit({
        texture: tex.petal,
        x: cam.x + Math.random() * cam.width,
        y: cam.y + Math.random() * cam.height * 0.5,
        vx: windPx * 0.3 + 10,
        vy: 12 + Math.random() * 12,
        life: 10,
        tint: 0xf6cdd8,
        scale: 0.25 + Math.random() * 0.15,
        vrot: (Math.random() - 0.5) * 4,
        sway: 14,
        fadeIn: 0.6,
        floor: cam.y + cam.height * (0.5 + Math.random() * 0.5),
        onLand: (p) => this.land(p),
      });
    }

    this.updateFloaters(dt, windPx);
    this.updateFireflies(dt, time, nature);
    this.updateBirds(dt, nature, w);
    this.updateMeteors(dt, nature, w);
    this.updateFrogs(dt, nature);

    this.screen.update(dt, 0);
    this.world.update(dt, windPx * 0.05);
    this.sky.update(dt, 0);
  }

  /** Une feuille ou un pétale qui touche l'eau y reste et dérive doucement. */
  private land(p: Particle): void {
    const pond = this.scene.pondAt(p.x, p.y);
    if (!pond || this.floaters.length > 60) return;
    pond.touch(p.x, p.y, 0.35, 0.01);
    const s = new Sprite(p.sprite.texture);
    s.anchor.set(0.5);
    s.tint = p.sprite.tint;
    s.scale.set(p.sprite.scale.x);
    s.rotation = p.rot;
    pond.surface.addChild(s);
    p.life = 0.01;
    this.floaters.push({
      sprite: s,
      pond,
      x: p.x,
      y: p.y,
      rot: p.rot,
      vrot: (Math.random() - 0.5) * 0.2,
      life: 50 + Math.random() * 40,
    });
  }

  private updateFloaters(dt: number, windPx: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life -= dt;
      f.x += windPx * 0.02 * dt + Math.sin(f.life * 0.3) * 2 * dt;
      f.y += Math.cos(f.life * 0.23) * 1.5 * dt;
      f.rot += f.vrot * dt;
      const h = f.pond.heightAtWorld(f.x, f.y);
      if (!f.pond.contains(f.x, f.y)) f.life = Math.min(f.life, 1.5);
      f.sprite.position.set(f.x, f.y + h * 3);
      f.sprite.rotation = f.rot + h * 0.3;
      f.sprite.alpha = Math.min(1, f.life / 3) * 0.95;
      if (f.life <= 0) {
        f.sprite.destroy();
        this.floaters.splice(i, 1);
      }
    }
  }

  private updateFireflies(dt: number, time: number, nature: NatureActivity): void {
    const target = Math.round(nature.fireflies * 34 * (0.5 + this.scene.quality.particles * 0.5));
    const tex = sharedTextures().glow;
    const pond = this.scene.ponds[0]?.shape;
    while (this.fireflies.length < target && pond) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = 0xd8ff8a;
      s.scale.set(0.3);
      this.flyLayer.addChild(s);
      const a = Math.random() * Math.PI * 2;
      this.fireflies.push({
        sprite: s,
        x: pond.cx + Math.cos(a) * pond.rx * (0.6 + Math.random() * 0.8),
        y: pond.cy + Math.sin(a) * pond.ry * (0.6 + Math.random() * 0.9) - 30,
        vx: 0,
        vy: 0,
        phase: Math.random() * 10,
        speed: 8 + Math.random() * 10,
      });
    }
    while (this.fireflies.length > target) this.fireflies.pop()!.sprite.destroy();
    for (const f of this.fireflies) {
      f.phase += dt;
      f.vx += (Math.random() - 0.5) * 30 * dt;
      f.vy += (Math.random() - 0.5) * 30 * dt;
      f.vx *= 0.98;
      f.vy *= 0.98;
      f.x += f.vx * dt * f.speed * 0.1;
      f.y += f.vy * dt * f.speed * 0.1 + Math.sin(f.phase * 0.7) * 0.1;
      const blink = Math.max(0, Math.sin(f.phase * 1.3 + Math.sin(f.phase * 0.37) * 3));
      f.sprite.alpha = blink ** 3;
      f.sprite.position.set(f.x, f.y);
    }
    if (this.fireflies.length && !this.seen.has('firefly')) this.emitEvent('firefly');
    void time;
  }

  private updateBirds(dt: number, nature: NatureActivity, w: number): void {
    this.acc.bird += nature.birds * 0.04 * dt;
    if (this.acc.bird >= 1) {
      this.acc.bird = 0;
      const n = 2 + Math.floor(Math.random() * 4);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = WORLD.horizon - 200 - Math.random() * 180;
      for (let i = 0; i < n; i++) {
        const c = new Container();
        const s = new Sprite(sharedTextures().dot);
        s.anchor.set(0.5);
        s.scale.set(0.35, 0.12);
        s.tint = 0x2b3a3a;
        c.addChild(s);
        this.birdLayer.addChild(c);
        this.birds.push({
          sprite: c,
          x: dir > 0 ? -60 - i * 26 : w + 60 + i * 26,
          y: y + (i % 2) * 14 + i * 4,
          vx: dir * (60 + Math.random() * 20),
          flap: Math.random() * 6,
        });
      }
      if (!this.seen.has('birds')) this.emitEvent('birds');
    }
    // Les oiseaux vivent dans le ciel : coordonnées écran approximatives via la couche lointaine
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i]!;
      b.x += b.vx * dt;
      b.flap += dt * 10;
      b.sprite.position.set(b.x, this.scene.skyToScreenY(b.y) + Math.sin(b.flap * 0.3) * 3);
      b.sprite.scale.y = 0.6 + Math.abs(Math.sin(b.flap)) * 0.8;
      if (b.x < -120 || b.x > w + 120) {
        b.sprite.destroy({ children: true });
        this.birds.splice(i, 1);
      }
    }
  }

  private updateMeteors(dt: number, nature: NatureActivity, w: number): void {
    // Étoiles filantes : fréquence selon la pluie d'étoiles active
    this.acc.meteor += nature.meteors * 0.25 * dt;
    if (this.acc.meteor >= 1) {
      this.acc.meteor = 0;
      const horizon = this.scene.skyToScreenY(WORLD.horizon);
      const x = Math.random() * w;
      const y = Math.random() * Math.max(40, horizon * 0.6);
      const ang = 0.5 + Math.random() * 0.5;
      const speed = 500 + Math.random() * 300;
      this.sky
        .emit({
          texture: sharedTextures().streak,
          x,
          y,
          vx: Math.cos(ang) * speed * (Math.random() < 0.5 ? -1 : 1),
          vy: Math.sin(ang) * speed,
          life: 0.7,
          alpha: 0.95,
          scale: 1.4,
          rot: 0,
          blend: 'add',
          tint: 0xf4f6ff,
        })
        ?.sprite.scale.set(0.6, 1.8);
      if (!this.seen.has('meteor')) this.emitEvent('meteor');
    }
  }

  private updateFrogs(dt: number, nature: NatureActivity): void {
    if (nature.frogs <= 0) return;
    this.acc.frog += nature.frogs * 0.2 * dt;
    if (this.acc.frog >= 1) {
      this.acc.frog = 0;
      const p = this.scene.ponds[0];
      if (!p) return;
      const pt = p.shape.points[Math.floor(Math.random() * p.shape.points.length)]!;
      const x = p.shape.cx + (pt.x - p.shape.cx) * 0.88;
      const y = p.shape.cy + (pt.y - p.shape.cy) * 0.88;
      p.touch(x, y, 0.9, 0.012);
      if (!this.seen.has('frogs')) this.emitEvent('frogs');
    }
  }
}
