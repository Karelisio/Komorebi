import { useEffect } from 'react';
import { t } from '@/i18n';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';

/** Étapes : nourrir → récolter → acheter un œuf → décorer → carnet. */
const STEPS = [
  'tutorial.step0',
  'tutorial.step1',
  'tutorial.step2',
  'tutorial.step3',
  'tutorial.step4',
] as const;

/** Où pointe la flèche pour chaque étape. */
const TARGET = ['pond', 'pending', 'shop', 'bank', 'collection'] as const;

export function advanceTutorial(from: number): void {
  const tut = useGame.getState().tutorial;
  if (tut.done || tut.step !== from) return;
  const step = from + 1;
  useGame.setState({ tutorial: { step, done: step >= STEPS.length } });
}

export function skipTutorial(): void {
  useGame.setState({ tutorial: { step: STEPS.length, done: true } });
}

/** Tutoriel guidé : une consigne à la fois en bas de l'écran, une flèche vers l'endroit à toucher. */
export function Tutorial() {
  const tut = useGame((s) => s.tutorial);
  const visible = useUi((s) => s.mode === 'garden' && s.sheet === 'none');

  useEffect(() => {
    if (tut.done) return;
    // Étape 3 : les emplacements libres de la berge s'illuminent
    if (tut.step === 3) useUi.setState({ decorMode: true });
    if (tut.step === 4) {
      const id = setTimeout(() => advanceTutorial(4), 7000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [tut]);

  if (tut.done || !visible) return null;
  const key = STEPS[tut.step];
  if (!key) return null;
  return (
    <div key={key} className={`coach coach-${TARGET[tut.step]}`}>
      <span className="arrow" aria-hidden="true" />
      <p>{t(key)}</p>
      <button className="link" onClick={skipTutorial}>
        {t('tutorial.skip')}
      </button>
    </div>
  );
}
