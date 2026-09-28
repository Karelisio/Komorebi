import { confirmPlacement } from '@/engine/controller';
import { getLang, t } from '@/i18n';
import { useGame } from '@/state/game';
import { setTool, useUi, type Tool } from '@/state/ui';
import { useWorld } from '@/state/world';
import type { WeatherKind } from '@/world/weatherTypes';
import { Icon, type IconName } from './icons';

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
  const season = useWorld((s) => s.season);
  const weather = useWorld((s) => s.weather);
  if (!sky || !season || !weather) return null;
  const night = sky.sunAltitude < -4;
  const icon =
    weather.kind === 'clear' || weather.kind === 'cloudy'
      ? night
        ? 'moon'
        : WEATHER_ICON[weather.kind]
      : WEATHER_ICON[weather.kind];
  const I = Icon[icon];
  const time = new Date(useWorld.getState().time).toLocaleTimeString(
    getLang() === 'fr' ? 'fr-FR' : 'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );
  return (
    <div className="status glass" aria-live="polite">
      <I />
      <span>{time}</span>
      <span className="sep">·</span>
      <span>{t(`time.${sky.phase}`)}</span>
      <span className="sep">·</span>
      <span>{Math.round(weather.temperature)}°</span>
      <span className="sep">·</span>
      <span>{t(`season.${season.season}`)}</span>
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

const TOOLS: { id: Tool | 'garden' | 'journal' | 'relax'; icon: IconName; label: string }[] = [
  { id: 'garden', icon: 'leaf', label: 'hud.garden' },
  { id: 'water', icon: 'water', label: 'hud.water' },
  { id: 'prune', icon: 'scissors', label: 'hud.prune' },
  { id: 'rake', icon: 'rake', label: 'hud.rake' },
  { id: 'journal', icon: 'book', label: 'hud.journal' },
  { id: 'relax', icon: 'lotus', label: 'hud.relax' },
];

function Dock() {
  const tool = useUi((s) => s.tool);
  return (
    <nav className="dock glass">
      {TOOLS.map((b) => {
        const I = Icon[b.icon];
        const active = b.id === tool || (b.id === 'garden' && tool === 'place');
        return (
          <button
            key={b.id}
            className={active ? 'active' : ''}
            aria-label={t(b.label as never)}
            aria-pressed={active}
            onClick={() => {
              if (b.id === 'garden') {
                setTool('none');
                useUi.setState({ sheet: 'inventory' });
              } else if (b.id === 'journal') useUi.setState({ sheet: 'journal' });
              else if (b.id === 'relax') useUi.setState({ sheet: 'relax' });
              else setTool(tool === b.id ? 'none' : (b.id as Tool));
            }}
          >
            <I />
            <span className="label">{t(b.label as never)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ToolHint() {
  const tool = useUi((s) => s.tool);
  const ghost = useUi((s) => s.ghost);
  if (tool === 'none') return null;
  return (
    <div className="tool-hint glass">
      <span>{t(`hud.toolHint.${tool}` as never)}</span>
      {tool === 'place' && (
        <button className="pill" disabled={!ghost?.valid} onClick={() => confirmPlacement()}>
          {t('hud.place')}
        </button>
      )}
      <button className="pill ghost" onClick={() => setTool('none')}>
        {t('hud.done')}
      </button>
    </div>
  );
}

export function Hud() {
  const visible = useUi((s) => s.hudVisible && s.mode === 'garden');
  return (
    <div className={`hud${visible ? '' : ' hidden'}`}>
      <Status />
      <Petals />
      <button
        className="icon-btn glass"
        style={{ position: 'absolute', top: 'calc(var(--safe-top) + 58px)', right: 12 }}
        aria-label={t('hud.settings')}
        onClick={() => useUi.setState({ sheet: 'settings' })}
      >
        <Icon.gear />
      </button>
      <ToolHint />
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
