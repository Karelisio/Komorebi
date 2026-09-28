import { useEffect } from 'react';
import { runtimeRef } from '@/engine/runtimeRef';
import { t } from '@/i18n';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import { DEFAULT_VIEW } from '@/world/layout';

const STEPS = [
  'tutorial.touchWater',
  'tutorial.feed',
  'tutorial.explore',
  'tutorial.garden',
] as const;

export function advanceTutorial(from: number): void {
  const tut = useGame.getState().tutorial;
  if (tut.done || tut.step !== from) return;
  const step = from + 1;
  useGame.setState({ tutorial: { step, done: step >= STEPS.length } });
}

/** Tutoriel implicite : un murmure à la fois, qui s'efface dès que le geste est fait. */
export function Tutorial() {
  const tut = useGame((s) => s.tutorial);
  const visible = useUi((s) => s.mode === 'garden' && s.sheet === 'none');

  useEffect(() => {
    if (tut.done) return;
    if (tut.step === 2) {
      // Avance dès que la caméra a bougé
      const id = setInterval(() => {
        const cam = runtimeRef.current?.scene.camera;
        if (cam && Math.hypot(cam.x - DEFAULT_VIEW.x, cam.y - DEFAULT_VIEW.y) > 120)
          advanceTutorial(2);
      }, 500);
      return () => clearInterval(id);
    }
    if (tut.step === 3) {
      const id = setTimeout(() => advanceTutorial(3), 6000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [tut]);

  if (tut.done || !visible) return null;
  const key = STEPS[tut.step];
  if (!key) return null;
  return (
    <div key={key} className="whisper">
      {t(key)}
    </div>
  );
}
