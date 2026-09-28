import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CATALOG } from '@/garden/catalog';
import { t } from '@/i18n';
import { simulateAbsence } from '@/save/offline';
import { snapshotGame } from '@/state/game';
import { patchSettings, useSettings } from '@/state/settings';
import { useWorld } from '@/state/world';
import { nextMeteorShowerPeak } from '@/world/events';
import { dayOfYear } from '@/world/math';
import { weatherSeries } from '@/world/weatherService';
import { clock } from './clock';

const IDS = { bloom: 101, fry: 102, meteor: 103 } as const;
const HOUR = 3_600_000;

/** Prochain instant (≥ now) où la floraison d'une espèce commence, à 9 h locales. */
function nextBloom(kind: 'cherry', now: number): Date | null {
  const b = CATALOG[kind].bloom;
  if (!b) return null;
  const start = b.peak - Math.round(b.width * 0.4);
  for (let d = 1; d < 370; d++) {
    const date = new Date(now + d * 24 * HOUR);
    if (dayOfYear(date) === start) {
      date.setHours(9, 0, 0, 0);
      return date;
    }
  }
  return null;
}

/** Première naissance prévue dans les 48 h (simulation déterministe identique à celle du retour). */
function nextBirth(now: number): { at: Date; n: number } | null {
  const state = snapshotGame();
  const { location } = useWorld.getState();
  const { summary } = simulateAbsence(state, now + 48 * HOUR, location, weatherSeries());
  const first = summary.births[0];
  if (!first) return null;
  const n = summary.births.filter((b) => b.bornAt === first.bornAt).length;
  return { at: new Date(Math.max(first.bornAt, now + HOUR)), n };
}

/** Replanifie les notifications douces (à la mise en arrière-plan). */
export async function scheduleNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const s = useSettings.getState().notifications;
  await LocalNotifications.cancel({
    notifications: Object.values(IDS).map((id) => ({ id })),
  }).catch(() => undefined);
  if (!s.enabled) return;
  const now = clock.now();
  const list: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
  }[] = [];
  if (s.bloom && snapshotGame().objects.some((o) => o.kind === 'cherry' && o.growth >= 0.6)) {
    const at = nextBloom('cherry', now);
    if (at)
      list.push({
        id: IDS.bloom,
        title: t('notif.bloomTitle'),
        body: t('notif.bloom', { species: t('species.cherry.name') }),
        schedule: { at, allowWhileIdle: false },
      });
  }
  if (s.fry) {
    const b = nextBirth(now);
    if (b)
      list.push({
        id: IDS.fry,
        title: t('notif.fryTitle'),
        body: t('notif.fry', { n: b.n }),
        schedule: { at: b.at, allowWhileIdle: false },
      });
  }
  if (s.meteors) {
    const m = nextMeteorShowerPeak(new Date(now));
    const at = new Date(m.date);
    at.setHours(20, 30, 0, 0);
    if (at.getTime() - now < 14 * 24 * HOUR) {
      list.push({
        id: IDS.meteor,
        title: t('notif.meteorTitle'),
        body: t('notif.meteor', { name: t(`meteors.${m.shower.id}` as never) }),
        schedule: { at, allowWhileIdle: false },
      });
    }
  }
  if (list.length)
    await LocalNotifications.schedule({ notifications: list }).catch(() => undefined);
}

export function startNotifications(): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const unsub = useSettings.subscribe((s, prev) => {
    if (s.notifications.enabled && !prev.notifications.enabled) {
      void LocalNotifications.requestPermissions().then((p) => {
        if (p.display !== 'granted')
          patchSettings({
            notifications: { ...useSettings.getState().notifications, enabled: false },
          });
      });
    }
  });
  let l: { remove: () => Promise<void> } | null = null;
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) void scheduleNotifications();
  }).then((x) => {
    l = x;
  });
  return () => {
    unsub();
    void l?.remove();
  };
}
