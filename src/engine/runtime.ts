import { GardenSystem } from '@/render/GardenSystem';
import { GrassSystem } from '@/render/GrassSystem';
import { KoiSystem } from '@/render/KoiSystem';
import { LilySystem } from '@/render/LilySystem';
import { Scene } from '@/render/Scene';
import { WeatherSystem, type NatureEvent } from '@/render/WeatherSystem';
import { ZoneSystem } from '@/render/ZoneSystem';
import { useGame } from '@/state/game';
import { useSettings } from '@/state/settings';
import { useWorld } from '@/state/world';
import { useTheme } from '@/theme/theme';
import { hexToRgb } from '@/world/math';
import { currentWeather, refreshWeather } from '@/world/weatherService';
import { weatherPreset } from '@/world/weatherTypes';
import { clock } from './clock';
import { createController, type ControllerHooks } from './controller';
import { seasonDate, useDebug } from './debug';
import { computeEnv } from './environment';

export interface Runtime {
  scene: Scene;
  garden: GardenSystem;
  kois: KoiSystem;
  weather: WeatherSystem;
  refresh(): void;
  destroy(): void;
}

export interface RuntimeHooks extends ControllerHooks {
  onNature?(e: NatureEvent): void;
  onTick?(now: number): void;
}

/** Démarre la scène et tous les systèmes, et les alimente en données du monde. */
export async function startRuntime(host: HTMLElement, hooks: RuntimeHooks = {}): Promise<Runtime> {
  const settings = useSettings.getState();
  const scene = await Scene.create(host, settings.quality);
  scene.loop.setFpsCap(settings.fpsCap);
  const kois = new KoiSystem(scene.ponds, settings.quality !== 'low');
  const garden = new GardenSystem(scene);
  const weather = new WeatherSystem(scene);
  weather.onEvent = (e) => hooks.onNature?.(e);
  scene.addSystem(new GrassSystem(scene));
  scene.addSystem(garden);
  scene.addSystem(kois);
  const lilies = new LilySystem(scene.ponds);
  scene.addSystem(lilies);
  scene.addSystem(new ZoneSystem(scene, kois, lilies));
  scene.addSystem(weather);
  scene.bindGestures(createController(scene, garden, kois, hooks));
  if (useDebug.getState().enabled)
    Object.assign(window, { __scene: scene, __kois: kois, __garden: garden });

  const refresh = () => {
    const now = clock.date();
    const dbg = useDebug.getState();
    const { location } = useWorld.getState();
    const memory = useGame.getState().weatherMemory;
    const w = dbg.weather
      ? weatherPreset(dbg.weather)
      : currentWeather(now.getTime(), location, memory);
    const env = computeEnv(now, location, w, dbg.season ? seasonDate(dbg.season, now) : undefined);
    scene.setEnv(env);
    useWorld.setState({
      time: now.getTime(),
      sky: env.sky,
      lighting: env.lighting,
      season: env.season,
      nature: env.nature,
      weather: w,
    });
    hooks.onTick?.(now.getTime());
  };
  refresh();
  const timer = setInterval(refresh, 1000);
  void refreshWeather(useWorld.getState().location).then(refresh);
  const weatherTimer = setInterval(
    () => void refreshWeather(useWorld.getState().location).then(refresh),
    10 * 60_000,
  );

  const applyAccent = () => {
    scene.accent = useSettings.getState().accentTint ? hexToRgb(useTheme.getState().accent) : null;
  };
  applyAccent();
  const unsubTheme = useTheme.subscribe(applyAccent);
  const unsubSettings = useSettings.subscribe((s, prev) => {
    if (s.quality !== prev.quality) scene.setQuality(s.quality);
    if (s.fpsCap !== prev.fpsCap) scene.loop.setFpsCap(s.fpsCap);
    if (s.accentTint !== prev.accentTint) applyAccent();
  });

  const cam = useDebug.getState().camera;
  if (cam) scene.camera.lookAt(cam.x, cam.y, (scene.width / 760) * cam.zoom);
  scene.start();

  return {
    scene,
    garden,
    kois,
    weather,
    refresh,
    destroy: () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
      unsubSettings();
      unsubTheme();
      scene.destroy();
    },
  };
}
