import { Application, Container, Sprite, Texture, type Renderer } from 'pixi.js';
import { Camera } from '@/engine/camera';
import { GestureController, type GestureHandlers, type ScreenPoint } from '@/engine/gestures';
import { Loop } from '@/engine/loop';
import type { NatureActivity } from '@/world/events';
import {
  clamp,
  DEG,
  desaturate,
  hexToRgb,
  luma,
  mixRgb,
  mulRgb,
  rgbToHex,
  scaleRgb,
  type RGB,
} from '@/world/math';
import type { SeasonState } from '@/world/season';
import type { Lighting, SkyState } from '@/world/sky';
import type { WeatherState } from '@/world/weatherTypes';
import { Canopy } from './Backdrop';
import { setVec } from './gl';
import { DEFAULT_VIEW, MAIN_POND, WORLD } from '@/world/layout';
import { LightLayer } from './LightLayer';
import { paintBank, paintBed } from './painting';
import { PondView } from './PondView';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { sharedTextures } from './textures';
import { DEFAULT_SUN, type SunLight } from './TreeView';

export interface SceneEnv {
  sky: SkyState;
  lighting: Lighting;
  season: SeasonState;
  weather: WeatherState;
  nature: NatureActivity;
}

/** Valeurs d'éclairage effectives (après météo), partagées avec les sous-systèmes. */
export interface FrameLight {
  ambient: RGB;
  skyTop: RGB;
  skyHorizon: RGB;
  sunColor: RGB;
  sunStrength: number;
  moonStrength: number;
  rays: number;
  overcast: number;
  wind: number;
  fog: number;
  fogColor: RGB;
  night: number;
}

const PROFILE = typeof location !== 'undefined' && location.search.includes('prof=1');
const NO_RAYS = typeof location !== 'undefined' && location.search.includes('norays');

export interface SceneSystem {
  update(dt: number, time: number, light: FrameLight, env: SceneEnv): void;
  destroy?(): void;
}

export class Scene {
  readonly camera = new Camera({ x: 0, y: 0, width: WORLD.width, height: WORLD.height });
  readonly loop = new Loop();
  readonly stage: Container;
  /** Couche écran au-dessus du monde (ombres d'oiseaux, reflets d'étoiles filantes). */
  readonly skyLayer: Container = new Container();
  /** Couche monde (caméra) : berge, bassin, objets triés par profondeur. */
  readonly world: Container = new Container();
  readonly pondLayer: Container = new Container();
  readonly objects: Container = new Container();
  readonly worldFx: Container = new Container();
  readonly fgLayer: Container = new Container();
  readonly screenFx: Container = new Container();
  readonly overlay: Container = new Container();

  readonly light: LightLayer;
  /** Berge peinte à l'aquarelle (repeinte à chaque changement de saison). */
  readonly bank = new Sprite();
  private bankKey = '';
  readonly canopy: Canopy;
  readonly ponds: PondView[] = [];
  readonly vignette: Sprite;
  private readonly systems: SceneSystem[] = [];
  private gestures: GestureController | null = null;
  env: SceneEnv | null = null;
  private baseZoom = 1;
  private time = 0;
  private flash = 0;
  private nextFlash = 5;
  quality: QualityProfile;
  lastLight: FrameLight | null = null;
  /** Couleur d'accent de l'interface appliquée légèrement au brouillard et aux lanternes. */
  accent: RGB | null = null;
  /** Lanternes (x, y, intensité) pour leur reflet dans l'eau. */
  lanterns: { x: number; y: number }[] = [];
  /** Soleil vu par les arbres (modelé et ombres portées). */
  sun: SunLight = { ...DEFAULT_SUN };
  /** Appelé à chaque éclair (pour le tonnerre). */
  onThunder?: () => void;
  /** Échelle de l'UI (pour savoir si la vue est tactile). */
  width = 1;
  height = 1;

  private constructor(
    readonly app: Application,
    readonly host: HTMLElement,
    qualityLevel: QualityLevel,
  ) {
    this.quality = QUALITY[qualityLevel];
    this.stage = app.stage;
    const tex = sharedTextures();
    this.world.addChild(this.pondLayer, this.bank, this.objects, this.worldFx);
    this.objects.sortableChildren = true;
    this.canopy = new Canopy(tex.maple);
    this.fgLayer.addChild(this.canopy.container);
    this.light = new LightLayer(this.screenFx, this.screenFx);
    this.vignette = new Sprite(tex.vignette);
    this.overlay.addChild(this.vignette);
    this.stage.addChild(
      this.world,
      this.skyLayer,
      this.fgLayer,
      this.screenFx,
      this.overlay,
    );

    this.addPond(new PondView(MAIN_POND, { bed: paintBed(MAIN_POND) }, this.pondQuality()));
  }

  static async create(host: HTMLElement, quality: QualityLevel): Promise<Scene> {
    const app = new Application();
    const profile = QUALITY[quality];
    await app.init({
      preference: 'webgl',
      antialias: false,
      autoStart: false,
      background: 0x1d2a44,
      resolution: Math.min(window.devicePixelRatio || 1, profile.maxResolution),
      autoDensity: true,
      width: host.clientWidth || window.innerWidth,
      height: host.clientHeight || window.innerHeight,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    app.ticker.stop();
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    const scene = new Scene(app, host, quality);
    scene.resize();
    scene.camera.lookAt(DEFAULT_VIEW.x, DEFAULT_VIEW.y, scene.baseZoom);
    scene.loop.add((dt) => scene.frame(dt));
    window.addEventListener('resize', scene.onResize);
    return scene;
  }

  get renderer(): Renderer {
    return this.app.renderer;
  }

  private pondQuality() {
    return {
      grid: this.quality.rippleGrid,
      koiResolution: this.quality.koiResolution,
      level: this.quality.level,
    };
  }

  addPond(p: PondView): void {
    this.ponds.push(p);
    this.pondLayer.addChild(p.container);
  }

  addSystem(s: SceneSystem): void {
    this.systems.push(s);
  }

  setQuality(level: QualityLevel): void {
    this.quality = QUALITY[level];
    this.renderer.resolution = Math.min(window.devicePixelRatio || 1, this.quality.maxResolution);
    this.resize();
  }

  setEnv(env: SceneEnv): void {
    this.env = env;
  }

  bindGestures(handlers: GestureHandlers): void {
    this.gestures?.destroy();
    this.gestures = new GestureController(this.app.canvas, handlers);
  }

  screenToWorld(p: ScreenPoint): { x: number; y: number } {
    return this.camera.screenToWorld(p.x, p.y);
  }

  pondAt(x: number, y: number): PondView | undefined {
    return this.ponds.find((p) => p.contains(x, y));
  }

  private readonly onResize = (): void => this.resize();

  resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.resize(w, h);
    this.camera.resize(w, h);
    // Cadrage fixe : tout le bassin tient dans l'écran, zoom limité
    this.baseZoom = Math.max(w / DEFAULT_VIEW.width, this.camera.minZoom);
    this.camera.maxZoom = this.baseZoom * 1.6;
    this.light.resize(w, h);
    this.vignette.width = w;
    this.vignette.height = h;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  private computeLight(env: SceneEnv): FrameLight {
    const { lighting, sky, weather } = env;
    const overcast = Math.pow(clamp(weather.cloudCover / 100), 1.4);
    const rainy = clamp(weather.rain / 4) + clamp(weather.snow / 2);
    const grey = clamp(overcast * 0.7 + rainy * 0.2);
    const ambient = scaleRgb(desaturate(lighting.ambient, grey * 0.55), 1 - grey * 0.22);
    const skyTop = scaleRgb(desaturate(lighting.skyTop, grey * 0.75), 1 - grey * 0.15);
    const skyHorizon = mixRgb(
      desaturate(lighting.skyHorizon, grey * 0.7),
      [luma(ambient), luma(ambient), luma(ambient)],
      grey * 0.2,
    );
    const sunStrength = sky.daylight * (1 - overcast * 0.85);
    const moonVisible = clamp((sky.moonAltitude + 2) / 10) * (1 - overcast * 0.9);
    const fogBase = clamp(weather.fog + rainy * 0.25);
    let fogColor = mixRgb(skyHorizon, ambient, 0.4);
    if (this.accent) fogColor = mixRgb(fogColor, this.accent, 0.22);
    return {
      ambient,
      skyTop,
      skyHorizon,
      sunColor: lighting.sunColor,
      sunStrength,
      moonStrength: moonVisible * sky.moonFraction * (1 - sky.daylight),
      rays: lighting.rays * (1 - overcast * 0.95) * (this.quality.rays ? 1 : 0),
      overcast,
      wind: clamp(weather.wind / 45),
      fog: fogBase,
      fogColor,
      night: 1 - sky.daylight,
    };
  }

  private slowTime = 0;
  private fastTime = 0;

  /** Résolution adaptative : baisse si l'appareil n'atteint pas la cadence visée, remonte s'il a de la marge. */
  private adaptResolution(dt: number): void {
    // Désactivée sous automatisation (captures en rendu logiciel)
    if (navigator.webdriver) return;
    const target = this.loop.targetMs;
    const r = this.renderer.resolution;
    const max = Math.min(window.devicePixelRatio || 1, this.quality.maxResolution);
    if (this.loop.intervalMs > target * 1.3) {
      this.slowTime += dt;
      this.fastTime = 0;
    } else if (this.loop.intervalMs < target * 1.05) {
      this.fastTime += dt;
      this.slowTime = 0;
    }
    if (this.slowTime > 4 && r > 0.75) {
      this.renderer.resolution = Math.max(0.75, r - 0.25);
      this.resize();
      this.slowTime = 0;
    } else if (this.fastTime > 25 && r < max) {
      this.renderer.resolution = Math.min(max, r + 0.25);
      this.resize();
      this.fastTime = 0;
    }
  }

  private frame(dt: number): void {
    const env = this.env;
    if (!env) return;
    this.adaptResolution(dt);
    this.time += dt;
    const t = this.time;
    const cam = this.camera;
    cam.update(dt);
    const L = this.computeLight(env);
    this.lastLight = L;
    const { sky, weather, season } = env;

    this.world.scale.set(cam.zoom);
    this.world.position.set(this.width / 2 - cam.x * cam.zoom, this.height / 2 - cam.y * cam.zoom);
    const w = this.width;
    const h = this.height;
    this.fgLayer.position.set(
      -(cam.x - DEFAULT_VIEW.x) * cam.zoom * 0.25,
      -(cam.y - DEFAULT_VIEW.y) * cam.zoom * 0.35,
    );

    // Direction du soleil et de la lune, relative à l'orientation du jardin
    const rel = (az: number) => ((az - sky.viewAzimuth + 540) % 360) - 180;
    const sunD = rel(sky.sunAzimuth);
    {
      const d = (sunD * Math.PI) / 180;
      const alt = Math.max(3, sky.sunAltitude);
      this.sun.side = clamp(sunD / 70, -1, 1);
      this.sun.dx = -Math.sin(d);
      this.sun.dy = Math.cos(d);
      this.sun.len = Math.min(3, 1 / Math.tan((alt * Math.PI) / 180));
      this.sun.strength = L.sunStrength * clamp((sky.sunAltitude + 2) / 6);
    }
    // Orage : éclairs sur toute la scène
    if (weather.thunder) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 6 + Math.random() * 14;
        this.onThunder?.();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.8);

    // Décor
    const flash = this.flash * (0.5 + 0.5 * Math.sin(t * 60)) * 0.35;
    this.world.tint = rgbToHex(mixRgb(L.ambient, [1, 1, 1], flash));
    this.fgLayer.tint = rgbToHex(scaleRgb(L.ambient, 0.55 + 0.25 * L.sunStrength));
    this.canopy.build(w, season);
    this.canopy.update(t, L.wind);

    // Berge peinte : repeinte quand la saison ou la neige changent nettement
    const bankKey = `${season.season}:${Math.round(season.autumn * 2)}:${Math.round(weather.snowCover * 3)}`;
    if (bankKey !== this.bankKey) {
      this.bankKey = bankKey;
      const old = this.bank.texture;
      const scale = this.quality.level > 1 ? 1.25 : this.quality.level > 0 ? 1 : 0.75;
      this.bank.texture = paintBank({
        width: WORLD.width,
        height: WORLD.height,
        shape: MAIN_POND,
        season,
        snow: weather.snowCover,
        scale,
      });
      this.bank.scale.set(1 / scale);
      if (old !== Texture.EMPTY) old.destroy(true);
    }

    // Eau
    const sunAz = sunD * DEG;
    const alt = Math.max(2, sky.sunAltitude) * DEG;
    const sunDir = [
      Math.sin(sunAz) * Math.cos(alt),
      -Math.cos(sunAz) * Math.cos(alt),
      Math.sin(alt),
    ];
    const mAz = rel(sky.moonAzimuth) * DEG;
    const mAlt = Math.max(2, sky.moonAltitude) * DEG;
    const moonDir = [
      Math.sin(mAz) * Math.cos(mAlt),
      -Math.cos(mAz) * Math.cos(mAlt),
      Math.sin(mAlt),
    ];
    const treeCol = mulRgb(hexToRgb('#1f3326'), mixRgb(L.ambient, L.skyHorizon, 0.3));
    for (const p of this.ponds) {
      const wu = p.water.u;
      setVec(wu.uSkyTop, L.skyTop);
      setVec(wu.uSkyHorizon, L.skyHorizon);
      setVec(wu.uAmbient, L.ambient);
      setVec(wu.uSunCol, L.sunColor);
      setVec(wu.uSunDir, sunDir);
      wu.uSunStrength = L.sunStrength * clamp(sky.sunAltitude / 4);
      // Colonne de scintillements vers le soleil (plus marquée quand il est bas et devant)
      const front = clamp(1 - (Math.abs(sunD) - 50) / 50);
      const low = 0.35 + 0.65 * clamp(1 - sky.sunAltitude / 45);
      setVec(wu.uGlint, [
        clamp(0.5 + (sunD / 70) * 0.55, -0.2, 1.2),
        0.07 + 0.1 * clamp(sky.sunAltitude / 40),
        L.sunStrength * clamp(sky.sunAltitude / 5) * (1 - L.overcast) * (0.25 + 0.75 * front) * low,
      ]);
      setVec(wu.uMoonDir, moonDir);
      wu.uMoonStrength = L.moonStrength;
      setVec(wu.uTreeCol, treeCol);
      wu.uTime = t;
      wu.uCaustics = L.sunStrength * (0.4 + 0.6 * (1 - L.overcast));
      wu.uWind = L.wind;
      wu.uFog = L.fog * 0.6;
      // Reflet de la lanterne la plus proche du bassin, la nuit
      let best: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const l of this.lanterns) {
        const d = Math.hypot(l.x - p.shape.cx, (l.y - p.shape.cy) * 1.4);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      const near = best && bd < p.shape.rx * 1.6;
      setVec(
        wu.uLantern,
        near && best ? [best.x, best.y + 40, 70, clamp(L.night * 1.2 - 0.2) * 0.6] : [0, 0, 1, 0],
      );
      setVec(wu.uFogCol, L.fogColor);
      const p0 = PROFILE ? performance.now() : 0;
      p.update(dt, this.renderer);
      p.renderReflection(this.renderer, this.objects);
      if (PROFILE) this.prof('pond', p0);
    }

    for (const s of this.systems) {
      const t0 = PROFILE ? performance.now() : 0;
      s.update(dt, t, L, env);
      if (PROFILE) this.prof(s.constructor.name, t0);
    }

    // Lumière et brouillard
    const r = this.light.rays.u;
    const side = clamp(sunD / 90, -1.3, 1.3);
    setVec(r.uSrc, [w / 2 + side * w * 0.75, -h * (0.12 + 0.45 * clamp(sky.sunAltitude / 70))]);
    setVec(r.uSunCol, L.sunColor);
    r.uStrength = L.rays * (0.5 + 0.5 * season.foliage) * (1 + sky.golden * 0.9);
    r.uTime = t;
    r.uWind = L.wind;
    r.uHaze = L.fog;
    r.uHorizon = -9999;
    this.light.rays.mesh.visible = r.uStrength > 0.01 && !NO_RAYS;
    const f = this.light.fog.u;
    f.uFog = L.fog;
    setVec(f.uFogCol, L.fogColor);
    f.uTime = t;
    f.uHorizon = -9999;
    this.light.fog.mesh.visible = L.fog > 0.02;
    this.vignette.alpha = 0.7 + L.night * 0.3;

    const r0 = PROFILE ? performance.now() : 0;
    this.renderer.render(this.stage);
    if (PROFILE) this.prof('render', r0);
  }

  /** Profilage par système (activé avec ?prof=1). */
  readonly profile: Record<string, number> = {};
  private prof(name: string, t0: number): void {
    this.profile[name] = (this.profile[name] ?? 0) * 0.97 + (performance.now() - t0) * 0.03;
  }

  /** Capture de l'image courante (mode photo). */
  async snapshot(): Promise<HTMLCanvasElement> {
    this.renderer.render(this.stage);
    return this.renderer.extract.canvas({ target: this.stage }) as HTMLCanvasElement;
  }

  destroy(): void {
    this.loop.stop();
    window.removeEventListener('resize', this.onResize);
    this.gestures?.destroy();
    for (const s of this.systems) s.destroy?.();
    for (const p of this.ponds) p.destroy();
    this.app.destroy(true, { children: true });
  }
}
