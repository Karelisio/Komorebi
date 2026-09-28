import { Application, Container, Sprite, type Renderer } from 'pixi.js';
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
import { Canopy, GardenWall, Mountains, SkyClouds } from './Backdrop';
import { setQuad, setVec } from './gl';
import { GroundView } from './GroundView';
import { DEFAULT_VIEW, MAIN_POND, WORLD } from '@/world/layout';
import { LightLayer } from './LightLayer';
import { PondView } from './PondView';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { SkyLayer } from './SkyLayer';
import { sharedTextures } from './textures';
import type { TreeLook } from './trees';
import { TreeView } from './TreeView';

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

const FAR = 0.22;
const PROFILE = typeof location !== 'undefined' && location.search.includes('prof=1');
const NO_RAYS = typeof location !== 'undefined' && location.search.includes('norays');
const MID = 0.55;

export interface SceneSystem {
  update(dt: number, time: number, light: FrameLight, env: SceneEnv): void;
  destroy?(): void;
}

interface FixedTree {
  view: TreeView;
  look: Omit<TreeLook, 'season' | 'snow' | 'thirst'>;
  phase: number;
}

export class Scene {
  readonly camera = new Camera({ x: 0, y: 0, width: WORLD.width, height: WORLD.height });
  readonly loop = new Loop();
  readonly stage: Container;
  readonly skyLayer: Container = new Container();
  readonly farLayer: Container = new Container();
  readonly midLayer: Container = new Container();
  /** Couche monde (caméra) : sol, bassins, objets triés par profondeur. */
  readonly world: Container = new Container();
  readonly groundLayer: Container = new Container();
  readonly pondLayer: Container = new Container();
  readonly objects: Container = new Container();
  readonly worldFx: Container = new Container();
  readonly fgLayer: Container = new Container();
  readonly screenFx: Container = new Container();
  readonly overlay: Container = new Container();

  readonly sky: SkyLayer;
  readonly light: LightLayer;
  readonly ground: GroundView;
  readonly mountains = new Mountains();
  readonly wall = new GardenWall();
  readonly canopy: Canopy;
  readonly clouds: SkyClouds;
  readonly ponds: PondView[] = [];
  readonly vignette: Sprite;
  private readonly systems: SceneSystem[] = [];
  private readonly fixedTrees: FixedTree[] = [];
  fixedCanopies: (readonly [number, number, number, number])[] = [];
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
    this.clouds = new SkyClouds(tex.clouds);
    this.sky = new SkyLayer(this.skyLayer, this.clouds.container);
    this.midLayer.addChild(this.wall.container);
    this.wall.buildHedge(tex.clumps.leaf, this.objects);
    this.ground = new GroundView(this.groundLayer, tex.noise, tex.grass);
    this.world.addChild(this.groundLayer, this.pondLayer, this.objects, this.worldFx);
    this.objects.sortableChildren = true;
    this.canopy = new Canopy(tex.maple);
    this.fgLayer.addChild(this.canopy.container);
    this.light = new LightLayer(this.screenFx, this.screenFx);
    this.vignette = new Sprite(tex.vignette);
    this.overlay.addChild(this.vignette);
    this.stage.addChild(
      this.skyLayer,
      this.farLayer,
      this.midLayer,
      this.world,
      this.fgLayer,
      this.screenFx,
      this.overlay,
    );

    this.addPond(new PondView(MAIN_POND, tex, this.pondQuality()));
    this.addFixedTrees();
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

  private addFixedTrees(): void {
    const specs: FixedTree['look'][] = [
      { species: 'maple', seed: 12, growth: 1, prune: 0.15, height: 470 },
      { species: 'pine', seed: 31, growth: 1, prune: 0.6, height: 380 },
      { species: 'bamboo', seed: 8, growth: 1, prune: 0, height: 420 },
      { species: 'cherry', seed: 21, growth: 1, prune: 0.1, height: 380 },
    ];
    const positions = [
      { x: 115, y: 960 },
      { x: 1125, y: 1090 },
      { x: 1170, y: 690 },
      { x: 1065, y: 790 },
    ];
    specs.forEach((look, i) => {
      const view = new TreeView();
      const p = positions[i]!;
      view.root.position.set(p.x, p.y);
      view.root.zIndex = p.y;
      this.objects.addChild(view.root);
      this.fixedTrees.push({ view, look, phase: i * 1.7 });
    });
    this.fixedCanopies = specs.map((look, i) => {
      const p = positions[i]!;
      return [p.x + 20, p.y + 10, look.height * 0.5, look.height * 0.22] as const;
    });
    this.ground.setCanopies(this.fixedCanopies);
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
    this.baseZoom = Math.max(w / DEFAULT_VIEW.width, this.camera.minZoom);
    this.camera.maxZoom = this.baseZoom * 3.2;
    this.sky.resize(w, h);
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

  /** Ordonnée écran d'un point de la couche lointaine (ciel, oiseaux). */
  skyToScreenY(worldY: number): number {
    return this.farLayer.position.y + worldY * this.farLayer.scale.y;
  }

  /** Transforme une couche parallax : f = 1 suit la caméra, f < 1 défile moins vite. */
  private placeLayer(layer: Container, f: number): { zoom: number; ox: number; oy: number } {
    const cam = this.camera;
    const zoom = this.baseZoom * Math.pow(cam.zoom / this.baseZoom, f);
    const cx = cam.x * f + DEFAULT_VIEW.x * (1 - f);
    const cy = cam.y * f + DEFAULT_VIEW.y * (1 - f);
    const ox = this.width / 2 - cx * zoom;
    const oy = this.height / 2 - cy * zoom;
    layer.scale.set(zoom);
    layer.position.set(ox, oy);
    return { zoom, ox, oy };
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

    // Parallax
    const far = this.placeLayer(this.farLayer, FAR);
    this.placeLayer(this.midLayer, MID);
    this.placeLayer(this.world, 1);
    const w = this.width;
    const h = this.height;
    const horizonY = far.oy + WORLD.horizon * far.zoom;
    const skyH = Math.max(120, horizonY);
    this.fgLayer.position.set(
      -(cam.x - DEFAULT_VIEW.x) * cam.zoom * 0.25,
      -(cam.y - DEFAULT_VIEW.y) * cam.zoom * 0.35,
    );

    // Ciel
    const u = this.sky.u;
    setQuad(this.sky.sm.mesh.geometry, 0, 0, w, Math.min(h, horizonY + 20));
    u.uHorizon = horizonY;
    u.uSkyHeight = skyH;
    setVec(u.uTop, L.skyTop);
    setVec(u.uHorizonCol, L.skyHorizon);
    const toScreen = (az: number, alt: number) => {
      const d = ((az - sky.viewAzimuth + 540) % 360) - 180;
      return { x: w / 2 + (d / 70) * w * 0.5, y: horizonY - (alt / 50) * skyH, d };
    };
    const sunS = toScreen(sky.sunAzimuth, sky.sunAltitude);
    setVec(u.uSunPos, [sunS.x, sunS.y]);
    setVec(u.uSunCol, L.sunColor);
    u.uSunVis = clamp((sky.sunAltitude + 3) / 6) * (1 - L.overcast * 0.8);
    const moonS = toScreen(sky.moonAzimuth, sky.moonAltitude);
    setVec(u.uMoonPos, [moonS.x, moonS.y]);
    u.uMoonPhase = sky.moonPhase;
    u.uMoonVis =
      clamp((sky.moonAltitude + 1) / 4) * (1 - L.overcast * 0.85) * (1 - sky.daylight * 0.6);
    u.uMoonSize = Math.max(10, w * 0.035);
    u.uStars = sky.stars * (1 - L.overcast * 0.95);
    u.uTime = t;
    // Quelques nuages de beau temps même par ciel clair
    u.uClouds = clamp(weather.cloudCover / 100);
    const cloudLit = mixRgb(L.skyHorizon, [1, 1, 1], 0.55 * sky.daylight);
    setVec(u.uCloudLit, mulRgb(cloudLit, mixRgb([1, 1, 1], L.ambient, 0.5)));
    setVec(u.uCloudShade, scaleRgb(mixRgb(L.skyTop, L.ambient, 0.5), 0.72));
    this.clouds.update(
      dt,
      w,
      horizonY,
      skyH,
      clamp(weather.cloudCover / 100),
      L.wind,
      mulRgb(cloudLit, mixRgb([1, 1, 1], L.ambient, 0.5)),
      scaleRgb(mixRgb(L.skyTop, L.ambient, 0.5), 0.72),
    );
    u.uWind = 0.4 + L.wind * 3;
    setVec(u.uStarShift, [((t * 0.2) % 1000) + sky.sunAzimuth * 3, 0]);
    u.uOctaves = this.quality.skyOctaves;
    // Orage lointain
    if (weather.thunder) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 6 + Math.random() * 14;
        this.onThunder?.();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.8);
    u.uFlash = this.flash * (0.5 + 0.5 * Math.sin(t * 60)) * 0.5;
    // Montagnes
    const m = this.sky.m;
    setQuad(this.sky.mountains.mesh.geometry, 0, 0, w, Math.min(h, horizonY + 20));
    m.uHorizon = horizonY;
    m.uSkyHeight = skyH;
    m.uOctaves = this.quality.skyOctaves;
    m.uCamX = (cam.x - DEFAULT_VIEW.x) * cam.zoom;
    setVec(m.uMtn, mulRgb(hexToRgb('#34465c'), mixRgb(L.ambient, [1, 1, 1], 0.1)));
    setVec(m.uForest, mulRgb(hexToRgb('#24392f'), L.ambient));
    setVec(m.uHaze, mixRgb(L.skyHorizon, L.skyTop, 0.12 + L.fog * 0.1));
    m.uSnowLine = 0.52 - season.winter * 0.3 - weather.snowCover * 0.1;
    m.uSunSide = clamp(sunS.d / 60, -1, 1) || 0.4;
    setVec(m.uSunLit, scaleRgb(L.sunColor, L.sunStrength));

    // Décor
    this.wall.updateSeason(season);
    this.midLayer.tint = rgbToHex(mixRgb(L.ambient, L.skyHorizon, 0.15 + L.fog * 0.4));
    this.world.tint = rgbToHex(L.ambient);
    this.fgLayer.tint = rgbToHex(scaleRgb(L.ambient, 0.55 + 0.25 * L.sunStrength));
    this.canopy.build(w, season);
    this.canopy.update(t, L.wind);
    const f0 = PROFILE ? performance.now() : 0;
    this.updateFixedTrees(t, env, L);
    if (PROFILE) this.prof('fixedTrees', f0);

    // Sol
    const g = this.ground.sm.u;
    setVec(g.uAmbient, L.ambient);
    setVec(g.uSunCol, L.sunColor);
    g.uSun = L.sunStrength;
    g.uSnow = weather.snowCover;
    g.uWet = weather.wetness;
    g.uTime = t;
    g.uWind = L.wind;
    // Teinte saisonnière de l'herbe
    const tSpring: RGB = [1.05, 1.12, 0.9];
    const tSummer: RGB = [0.95, 1.02, 0.88];
    const tAutumn: RGB = [1.18, 1.02, 0.7];
    const tWinter: RGB = [0.92, 0.9, 0.78];
    let tint =
      season.season === 'spring'
        ? tSpring
        : season.season === 'summer'
          ? tSummer
          : season.season === 'autumn'
            ? tAutumn
            : tWinter;
    tint = mixRgb(tint, tAutumn, season.autumn * 0.5);
    setVec(g.uTint, tint);
    setVec(g.uHazeCol, mixRgb(L.skyHorizon, L.ambient, 0.35));
    const wd = ((weather.windDir + 90) * Math.PI) / 180;
    setVec(g.uWindDir, [Math.cos(wd), Math.sin(wd) * 0.6]);

    // Eau
    const sunAz = sunS.d * DEG;
    const alt = Math.max(2, sky.sunAltitude) * DEG;
    const sunDir = [
      Math.sin(sunAz) * Math.cos(alt),
      -Math.cos(sunAz) * Math.cos(alt),
      Math.sin(alt),
    ];
    const mAz = moonS.d * DEG;
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
      if (PROFILE) this.prof('pond', p0);
    }

    for (const s of this.systems) {
      const t0 = PROFILE ? performance.now() : 0;
      s.update(dt, t, L, env);
      if (PROFILE) this.prof(s.constructor.name, t0);
    }

    // Lumière et brouillard
    const r = this.light.rays.u;
    const side = clamp(sunS.d / 90, -1.3, 1.3);
    setVec(r.uSrc, [w / 2 + side * w * 0.75, -h * (0.12 + 0.45 * clamp(sky.sunAltitude / 70))]);
    setVec(r.uSunCol, L.sunColor);
    r.uStrength = L.rays * (0.5 + 0.5 * season.foliage) * (1 + sky.golden * 0.9);
    r.uTime = t;
    r.uWind = L.wind;
    r.uHaze = L.fog;
    r.uHorizon = horizonY;
    this.light.rays.mesh.visible = r.uStrength > 0.01 && !NO_RAYS;
    const f = this.light.fog.u;
    f.uFog = L.fog;
    setVec(f.uFogCol, L.fogColor);
    f.uTime = t;
    f.uHorizon = horizonY;
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

  private updateFixedTrees(t: number, env: SceneEnv, L: FrameLight): void {
    for (const tr of this.fixedTrees) {
      const look: TreeLook = {
        ...tr.look,
        season: env.season,
        snow: env.weather.snowCover,
        thirst: 0,
      };
      tr.view.set(look);
      tr.view.sway(t, L.wind, tr.phase);
    }
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
