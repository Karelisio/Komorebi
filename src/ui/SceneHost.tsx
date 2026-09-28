import { useEffect, useRef } from 'react';
import { clock } from '@/engine/clock';
import { seasonDate, useDebug } from '@/engine/debug';
import { computeEnv } from '@/engine/environment';
import { KoiSystem } from '@/render/KoiSystem';
import { LilySystem } from '@/render/LilySystem';
import { Scene } from '@/render/Scene';
import { useWorld } from '@/state/world';
import { CLEAR_WEATHER, weatherPreset } from '@/world/weatherTypes';

export function SceneHost({ onReady }: { onReady?: (scene: Scene) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: Scene | null = null;
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void Scene.create(host, 'high').then((s) => {
      if (disposed) {
        s.destroy();
        return;
      }
      scene = s;
      const refresh = () => {
        const now = clock.date();
        const dbg = useDebug.getState();
        const { location } = useWorld.getState();
        const env = computeEnv(
          now,
          location,
          dbg.weather ? weatherPreset(dbg.weather) : CLEAR_WEATHER,
          dbg.season ? seasonDate(dbg.season, now) : undefined,
        );
        s.setEnv(env);
        useWorld.setState({
          time: now.getTime(),
          sky: env.sky,
          lighting: env.lighting,
          season: env.season,
          nature: env.nature,
        });
      };
      refresh();
      timer = setInterval(refresh, 1000);
      const kois = new KoiSystem(s.ponds, true);
      if (useDebug.getState().enabled) Object.assign(window, { __scene: s, __kois: kois });
      s.addSystem(kois);
      s.addSystem(new LilySystem(s.ponds));
      s.bindGestures({
        down: (p) => {
          const w = s.screenToWorld(p);
          s.pondAt(w.x, w.y)?.touch(w.x, w.y, 1.2);
        },
        tap: (p) => {
          const w = s.screenToWorld(p);
          kois.feedAt(w.x, w.y);
        },
        hover: (p) => {
          if (!p) return kois.clearAttractor();
          const w = s.screenToWorld(p);
          kois.setAttractor(w.x, w.y);
        },
        pan: (dx, dy, dt) => s.camera.panBy(dx, dy, dt),
        panStart: () => s.camera.beginDrag(),
        panEnd: () => s.camera.endDrag(),
        pinch: (f, c) => s.camera.zoomAt(f, c.x, c.y),
        wheel: (f, c) => s.camera.zoomAt(f, c.x, c.y),
      });
      const cam = useDebug.getState().camera;
      if (cam) s.camera.lookAt(cam.x, cam.y, (s.width / 760) * cam.zoom);
      s.start();
      onReady?.(s);
    });

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      scene?.destroy();
    };
  }, [onReady]);

  return <div ref={hostRef} className="scene-host" />;
}
