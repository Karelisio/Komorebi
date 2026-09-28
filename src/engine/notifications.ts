import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from '@/i18n';
import { PENDING_CAP_HOURS } from '@/pond/economy';
import { snapshotGame } from '@/state/game';
import { patchSettings, useSettings } from '@/state/settings';
import { nextMeteorShowerPeak } from '@/world/events';
import { clock } from './clock';

const IDS = { eggs: 101, full: 102, meteor: 103 } as const;
const HOUR = 3_600_000;

/** Replanifie les notifications douces (à la mise en arrière-plan). */
export async function scheduleNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const s = useSettings.getState().notifications;
  await LocalNotifications.cancel({
    notifications: Object.values(IDS).map((id) => ({ id })),
  }).catch(() => undefined);
  if (!s.enabled) return;
  const now = clock.now();
  const game = snapshotGame();
  const list: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date; allowWhileIdle: boolean };
  }[] = [];
  // Œufs prêts à éclore
  const nextEgg = game.eggs
    .map((e) => e.hatchAt)
    .filter((at) => at > now)
    .sort((a, b) => a - b)[0];
  if (s.fry && nextEgg)
    list.push({
      id: IDS.eggs,
      title: t('notif.eggsTitle'),
      body: t('notif.eggs'),
      schedule: { at: new Date(nextEgg), allowWhileIdle: false },
    });
  // Bassin plein de pétales (production plafonnée)
  if (s.bloom)
    list.push({
      id: IDS.full,
      title: t('notif.fullTitle'),
      body: t('notif.full'),
      schedule: { at: new Date(now + PENDING_CAP_HOURS * HOUR), allowWhileIdle: false },
    });
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
