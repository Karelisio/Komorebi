import { useEffect, useState } from 'react';
import { catchUp } from '@/engine/boot';
import { clock } from '@/engine/clock';
import { useDebug } from '@/engine/debug';
import { CATALOG, CATALOG_IDS, type CatalogId } from '@/garden/catalog';
import { t } from '@/i18n';
import { newGame, useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import type { Season } from '@/world/season';
import type { WeatherKind } from '@/world/weatherTypes';
import { BottomSheet, Segmented, Switch } from '../components';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const WEATHERS: WeatherKind[] = [
  'clear',
  'cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'storm',
  'snow',
];
const SPEEDS = [1, 60, 600, 3600] as const;

export function DebugSheet() {
  const season = useDebug((s) => s.season);
  const weather = useDebug((s) => s.weather);
  const showFps = useDebug((s) => s.showFps);
  const [, forceTick] = useState(0);

  // L'horloge n'est pas un store réactif : on force un rendu périodique pour suivre l'heure.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const close = () => useUi.setState({ sheet: 'none' });
  const d = clock.date();
  const hour = d.getHours() + d.getMinutes() / 60;

  return (
    <BottomSheet title={t('debug.title')} onClose={close}>
      <div className="row">
        <span>{t('debug.hour')}</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={hour}
          onChange={(e) => clock.setLocalHour(Number(e.target.value))}
        />
      </div>
      <div className="row">
        <button className="pill ghost" onClick={() => clock.reset()}>
          {t('debug.realTime')}
        </button>
      </div>
      <div className="row">
        <Segmented<number>
          value={clock.speed}
          onChange={(v) => clock.setSpeed(v)}
          options={SPEEDS.map((sp) => ({ id: sp, label: t('debug.speed', { n: sp }) }))}
        />
      </div>
      <div className="row">
        <span>{t('debug.season')}</span>
        <Segmented<Season | 'auto'>
          value={season ?? 'auto'}
          onChange={(v) => useDebug.setState({ season: v === 'auto' ? null : v })}
          options={[
            { id: 'auto', label: t('debug.auto') },
            ...SEASONS.map((s) => ({ id: s, label: t(`season.${s}` as never) })),
          ]}
        />
      </div>
      <div className="row">
        <span>{t('debug.weather')}</span>
        <Segmented<WeatherKind | 'auto'>
          value={weather ?? 'auto'}
          onChange={(v) => useDebug.setState({ weather: v === 'auto' ? null : v })}
          options={[
            { id: 'auto', label: t('debug.auto') },
            ...WEATHERS.map((w) => ({ id: w, label: t(`weather.${w}` as never) })),
          ]}
        />
      </div>
      <div className="row">
        <span>{t('debug.fps')}</span>
        <Switch
          on={showFps}
          onChange={(v) => useDebug.setState({ showFps: v })}
          label={t('debug.fps')}
        />
      </div>
      <div className="actions">
        <button
          className="pill ghost"
          onClick={() => {
            clock.setTime(clock.now() + 86_400_000);
            catchUp();
          }}
        >
          {t('debug.simulateDay')}
        </button>
        <button className="pill ghost" onClick={() => useGame.getState().addPetals(100)}>
          {t('debug.petals')}
        </button>
        <button
          className="pill ghost"
          onClick={() => {
            const seeds: Partial<Record<CatalogId, number>> = { ...useGame.getState().seeds };
            for (const id of CATALOG_IDS) {
              if (CATALOG[id].grows) seeds[id] = (seeds[id] ?? 0) + 3;
            }
            useGame.setState({ seeds });
          }}
        >
          {t('debug.seeds')}
        </button>
        <button
          className="pill ghost"
          onClick={() => {
            if (confirm(t('debug.reset'))) useGame.getState().replace(newGame(clock.now()));
          }}
        >
          {t('debug.reset')}
        </button>
      </div>
    </BottomSheet>
  );
}
