import { dayKey } from '@/garden/daily';
import { t } from '@/i18n';
import { express } from '@/pond/genetics';
import type { NatureEvent } from '@/render/WeatherSystem';
import { useGame } from '@/state/game';
import { showToast } from '@/state/ui';
import { useWorld } from '@/state/world';
import { activeMeteorShower } from '@/world/events';
import { clock } from './clock';
import { tick as haptic } from './haptics';

/** Souvenir daté, au plus une fois par jour (ou une fois pour toujours avec `forever`). */
function memory(key: string, params?: Record<string, string | number>, forever = false): void {
  const now = clock.now();
  useGame
    .getState()
    .remember('event', key, now, params, forever ? `m:${key}` : `m:${key}:${dayKey(now)}`);
}

export function onNatureEvent(e: NatureEvent): void {
  switch (e) {
    case 'firefly':
      memory('firefly');
      break;
    case 'meteor': {
      const shower = activeMeteorShower(clock.date());
      if (shower) memory('meteor', { name: shower.shower.id });
      break;
    }
    case 'frogs':
      memory('frogs');
      break;
    case 'rain':
      memory('firstRain', undefined, true);
      break;
    case 'snow':
      memory('firstSnow', undefined, true);
      break;
    case 'birds':
      break;
  }
}

let lastTick = 0;

/**
 * Battement du jeu (1 Hz) : production de pétales, croissance, éclosions, souvenirs liés au ciel.
 */
export function progressTick(): void {
  const now = clock.now();
  const g = useGame.getState();
  const w = useWorld.getState();
  const night = w.sky ? w.sky.sunAltitude < -4 : false;
  // Borne l'écart (mise en veille, horloge accélérée) : l'absence est simulée à part
  const dt = lastTick ? Math.max(0, Math.min(now - lastTick, 120_000)) : 0;
  lastTick = now;
  g.tick(dt, now, night);

  const { born, discoveries } = g.hatchReady(now);
  if (born.length) {
    haptic('medium');
    const first = born[0]!;
    showToast(t('eggs.hatched', { name: first.name }), 3200);
  }
  for (const d of discoveries) {
    const v = express(d.koi.genome).variety;
    showToast(
      `${t('collection.new', { variety: t(`koi.varieties.${v}` as never) })} · ${t('common.petalsGain', { n: d.reward })}`,
      4500,
    );
  }

  if (w.sky && w.sky.moonFraction > 0.97 && w.sky.moonAltitude > 5 && w.sky.sunAltitude < -6)
    memory('fullMoon');
}

/** Cadeau quotidien (au démarrage et au changement de jour). */
export function checkDaily(): void {
  const gift = useGame.getState().claimDaily(clock.now());
  if (gift)
    showToast(`${t('daily.welcome')} · ${t('common.petalsGain', { n: gift.petals })}`, 4500);
}
