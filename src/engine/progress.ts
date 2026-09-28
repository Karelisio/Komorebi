import { CATALOG } from '@/garden/catalog';
import { bonsaiStyle } from '@/garden/growth';
import { dayKey, newlyUnlocked, type ObjectiveId } from '@/garden/progression';
import { t } from '@/i18n';
import { express } from '@/pond/genetics';
import type { NatureEvent } from '@/render/WeatherSystem';
import { useGame } from '@/state/game';
import { showToast } from '@/state/ui';
import { useWorld } from '@/state/world';
import { activeMeteorShower } from '@/world/events';
import { clock } from './clock';

function complete(id: ObjectiveId): void {
  const reward = useGame.getState().completeObjective(id, clock.now());
  if (reward) showToast(`${t(`goals.${id}` as never)} · ${t('goals.reward', { n: reward })}`, 3800);
}

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
      complete('firefly');
      memory('firefly');
      break;
    case 'meteor': {
      complete('meteor');
      const shower = activeMeteorShower(clock.date());
      if (shower) memory('meteor', { name: shower.shower.id });
      break;
    }
    case 'frogs':
      complete('frogs');
      memory('frogs');
      break;
    case 'rain':
      complete('rain');
      memory('firstRain', undefined, true);
      break;
    case 'snow':
      complete('snow');
      memory('firstSnow', undefined, true);
      break;
    case 'birds':
      break;
  }
}

let lastEarned = -1;

/** Vérifications périodiques (1 Hz) : moments liés au ciel, aux saisons et au jardin. */
export function progressTick(): void {
  const w = useWorld.getState();
  const g = useGame.getState();
  if (w.sky?.phase === 'dawn') complete('dawn');
  if (w.sky && w.sky.moonFraction > 0.97 && w.sky.moonAltitude > 5 && w.sky.sunAltitude < -6) {
    complete('fullmoon');
    memory('fullMoon');
  }
  if (
    w.season &&
    w.season.sakura > 0.5 &&
    g.objects.some((o) => o.kind === 'cherry' && o.growth >= 0.6)
  ) {
    complete('sakura');
    memory('bloom', { species: 'cherry' });
  }
  if (w.season && w.season.autumn > 0.6) complete('autumn');
  if (
    w.sky &&
    w.sky.sunAltitude < -4 &&
    g.objects.some((o) => CATALOG[o.kind].id.startsWith('lantern'))
  )
    complete('lantern');
  if (g.objects.some((o) => bonsaiStyle(o) === 'bonsai')) complete('bonsai');
  if (g.kois.some((k) => k.parents)) complete('fry');
  if (g.kois.some((k) => express(k.genome).rarity >= 4)) complete('rare');
  if (g.stats.fed > 0) complete('feed');
  if (g.stats.raked > 0) complete('rake');
  if (g.stats.breaths > 0) complete('breath');

  // Nouveaux objets débloqués
  if (lastEarned >= 0 && g.petalsEarned > lastEarned) {
    for (const id of newlyUnlocked(lastEarned, g.petalsEarned)) {
      showToast(t('journal.entry.unlock', { name: t(`species.${id}.name` as never) }), 3500);
      g.remember('unlock', 'unlock', clock.now(), { species: id }, `unlock:${id}`);
    }
  }
  lastEarned = g.petalsEarned;
}

/** Cadeau quotidien (au démarrage et au changement de jour). */
export function checkDaily(): void {
  const gift = useGame.getState().claimDaily(clock.now());
  if (gift) {
    showToast(
      `${t('daily.welcome')} · ${t('daily.gift', { gift: `${t('common.petals', { n: gift.petals })}, ${t(`species.${gift.seed}.name` as never)}` })}`,
      4500,
    );
  }
}
