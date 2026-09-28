import { useEffect, useState } from 'react';
import { clock } from '@/engine/clock';
import { collectFeedback, feedHandful } from '@/engine/controller';
import { runtimeRef } from '@/engine/runtimeRef';
import { decorBonus } from '@/garden/decor';
import { questProgress, type Quest } from '@/garden/quests';
import { getLang, t } from '@/i18n';
import { pondRate, questsForLevel } from '@/pond/economy';
import { useGame } from '@/state/game';
import { openShop, showToast, useUi } from '@/state/ui';
import { useWorld } from '@/state/world';
import type { WeatherKind } from '@/world/weatherTypes';
import { formatDuration } from './components';
import { Icon, type IconName } from './icons';
import { advanceTutorial } from './Tutorial';

const WEATHER_ICON: Record<WeatherKind, IconName> = {
  clear: 'sun',
  cloudy: 'cloud',
  overcast: 'cloud',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  storm: 'storm',
  snow: 'snow',
};

function Status() {
  const sky = useWorld((s) => s.sky);
  const weather = useWorld((s) => s.weather);
  const time = useWorld((s) => s.time);
  const level = useGame((s) => s.level);
  const progress = useGame((s) => s.levelProgress);
  if (!sky || !weather) return null;
  const night = sky.sunAltitude < -4;
  const icon =
    weather.kind === 'clear' || weather.kind === 'cloudy'
      ? night
        ? 'moon'
        : WEATHER_ICON[weather.kind]
      : WEATHER_ICON[weather.kind];
  const I = Icon[icon];
  const clockText = new Date(time).toLocaleTimeString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const need = questsForLevel(level);
  return (
    <div className="status glass" aria-live="polite">
      <I />
      <span>{clockText}</span>
      <span className="sep">·</span>
      <span>{Math.round(weather.temperature)}°</span>
      <span className="sep">·</span>
      <span className="level" title={`${progress} / ${need}`}>
        {t('hud.level', { n: level })}
        <i style={{ width: `${Math.round((progress / need) * 100)}%` }} />
      </span>
    </div>
  );
}

function Petals() {
  const petals = useGame((s) => s.petals);
  return (
    <div className="petals glass" aria-label={t('common.petals', { n: petals })}>
      <Icon.petal />
      <span>{petals}</span>
    </div>
  );
}

/** Pétales en attente + débit horaire ; toucher récolte tout. */
function Pending() {
  const pending = useGame((s) => Math.floor(s.pending));
  const kois = useGame((s) => s.kois);
  const upgrades = useGame((s) => s.upgrades);
  const decor = useGame((s) => s.decor);
  const night = useWorld((s) => (s.sky ? s.sky.sunAltitude < -4 : false));
  const rate = pondRate(kois, clock.now(), upgrades, decorBonus(decor), night);
  return (
    <button
      className={`pending glass${pending > 0 ? ' ready' : ''}`}
      onClick={() => {
        const n = runtimeRef.current?.harvest.collectAll() ?? 0;
        if (n > 0) {
          collectFeedback(n, {});
          advanceTutorial(1);
        }
      }}
      aria-label={t('hud.collect')}
    >
      <span className="amount">
        <Icon.petal /> {pending > 0 ? `+${pending}` : '0'}
      </span>
      <span className="rate">{t('hud.rate', { n: Math.round(rate) })}</span>
    </button>
  );
}

function QuestRow({ q }: { q: Quest }) {
  const stats = useGame((s) => s.stats);
  const p = questProgress(q, stats);
  const done = p >= q.target;
  return (
    <li className={done ? 'done' : ''}>
      <span className="label">{t(`quests.kind.${q.kind}` as never, { n: q.target })}</span>
      {done ? (
        <button
          className="pill small"
          onClick={() => {
            const r = useGame.getState().claimQuest(q.id);
            if (!r) return;
            showToast(
              r.levelUp
                ? t('quests.levelUp', { n: useGame.getState().level })
                : t('common.petalsGain', { n: r.reward }),
              r.levelUp ? 4200 : 2000,
            );
          }}
        >
          {t('quests.claim')} · +{q.reward}
        </button>
      ) : (
        <span className="progress">{t('quests.progress', { a: p, b: q.target })}</span>
      )}
    </li>
  );
}

function Quests() {
  const quests = useGame((s) => s.quests);
  const stats = useGame((s) => s.stats);
  const tutorialDone = useGame((s) => s.tutorial.done);
  const [open, setOpen] = useState<boolean | null>(null);
  const ready = quests.filter((q) => questProgress(q, stats) >= q.target).length;
  // Replié par défaut une fois le tutoriel terminé ; s'ouvre de lui-même pendant le tutoriel
  const shown = open ?? !tutorialDone;
  return (
    <div className={`quests glass${shown ? '' : ' folded'}`}>
      <button className="quests-head" onClick={() => setOpen(!shown)}>
        {t('quests.title')}
        {ready > 0 && <span className="badge">{ready}</span>}
        <span className="chev">{shown ? '–' : '+'}</span>
      </button>
      {shown && (
        <ul>
          {quests.map((q) => (
            <QuestRow key={q.id} q={q} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Œufs en incubation : compte à rebours du prochain. */
function Nest() {
  const eggs = useGame((s) => s.eggs);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!eggs.length) return null;
  const now = clock.now();
  const next = Math.min(...eggs.map((e) => e.hatchAt));
  return (
    <button className="nest glass" onClick={() => openShop('eggs')}>
      <Icon.egg />
      <span>{next <= now ? t('eggs.ready') : formatDuration(next - now)}</span>
      <span className="count">×{eggs.length}</span>
    </button>
  );
}

const DOCK: { id: 'feed' | 'shop' | 'collection'; icon: IconName }[] = [
  { id: 'feed', icon: 'feed' },
  { id: 'shop', icon: 'shop' },
  { id: 'collection', icon: 'book' },
];

function Dock() {
  return (
    <nav className="dock big glass">
      {DOCK.map((b) => {
        const I = Icon[b.icon];
        return (
          <button
            key={b.id}
            data-id={b.id}
            aria-label={t(`hud.${b.id}` as never)}
            onClick={() => {
              const rt = runtimeRef.current;
              if (b.id === 'feed') {
                if (rt) feedHandful(rt.scene, rt.kois, { onFeed: () => advanceTutorial(0) });
              } else if (b.id === 'shop') {
                openShop();
                advanceTutorial(2);
              } else useUi.setState({ sheet: 'collection' });
            }}
          >
            <I />
            <span className="label">{t(`hud.${b.id}` as never)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Hud() {
  const visible = useUi((s) => s.hudVisible && s.mode === 'garden');
  return (
    <div className={`hud${visible ? '' : ' hidden'}`}>
      <Status />
      <Petals />
      <div className="side-actions">
        <button
          className="icon-btn glass"
          aria-label={t('hud.settings')}
          onClick={() => useUi.setState({ sheet: 'settings' })}
        >
          <Icon.gear />
        </button>
        <button
          className="icon-btn glass"
          aria-label={t('hud.journal')}
          onClick={() => useUi.setState({ sheet: 'journal' })}
        >
          <Icon.leaf />
        </button>
        <button
          className="icon-btn glass"
          aria-label={t('hud.relax')}
          onClick={() => useUi.setState({ sheet: 'relax' })}
        >
          <Icon.lotus />
        </button>
      </div>
      <Quests />
      <Nest />
      <Pending />
      <Dock />
    </div>
  );
}

export function Toast() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.key} className="toast glass">
      {toast.text}
    </div>
  );
}
