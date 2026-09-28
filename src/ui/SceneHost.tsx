import { useEffect, useRef } from 'react';
import { startRuntime, type Runtime, type RuntimeHooks } from '@/engine/runtime';

export function SceneHost({
  onReady,
  hooks,
}: {
  onReady?: (rt: Runtime) => void;
  hooks?: RuntimeHooks;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hooksRef = useRef(hooks);
  const readyRef = useRef(onReady);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let rt: Runtime | null = null;
    let disposed = false;
    void startRuntime(host, {
      onFeed: () => hooksRef.current?.onFeed?.(),
      onWaterTouch: () => hooksRef.current?.onWaterTouch?.(),
      onRake: (d) => hooksRef.current?.onRake?.(d),
      onHarvest: (n) => hooksRef.current?.onHarvest?.(n),
      onInteract: () => hooksRef.current?.onInteract?.(),
      onNature: (e) => hooksRef.current?.onNature?.(e),
      onTick: (now) => hooksRef.current?.onTick?.(now),
    }).then((r) => {
      if (disposed) {
        r.destroy();
        return;
      }
      rt = r;
      readyRef.current?.(r);
    });
    return () => {
      disposed = true;
      rt?.destroy();
    };
  }, []);

  return <div ref={hostRef} className="scene-host" />;
}
