import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useEffect, useRef, useState } from 'react';
import { audio } from '@/audio/engine';
import { runtimeRef } from '@/engine/runtimeRef';
import { tick } from '@/engine/haptics';
import { t } from '@/i18n';
import { useGame } from '@/state/game';
import { useSettings } from '@/state/settings';
import { showToast, useUi } from '@/state/ui';
import { Icon } from './icons';

export function exitMode(): void {
  const rt = runtimeRef.current;
  if (rt) rt.scene.camera.drift = false;
  audio.restoreVolume();
  useUi.setState({ mode: 'garden', hudVisible: true, sleepUntil: null });
  if (!useSettings.getState().keepAwake) void KeepAwake.allowSleep().catch(() => undefined);
}

export function enterMode(
  mode: 'contemplation' | 'breath' | 'meditation' | 'photo',
  keepAwake = false,
): void {
  const rt = runtimeRef.current;
  if (rt && mode !== 'photo') rt.scene.camera.drift = true;
  useUi.setState({ mode, sheet: 'none', hudVisible: false, tool: 'none' });
  if (keepAwake) void KeepAwake.keepAwake().catch(() => undefined);
}

/** Contemplation / cadre vivant : l'interface s'efface, la caméra dérive. Toucher pour revenir. */
function Contemplation() {
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 3500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="overlay" onPointerDown={exitMode}>
      {hint && <div className="hint">{t('relax.tapToExit')}</div>}
    </div>
  );
}

const PHASES = [
  { key: 'relax.inhale', seconds: 4, scale: 1.45 },
  { key: 'relax.hold', seconds: 3, scale: 1.45 },
  { key: 'relax.exhale', seconds: 6, scale: 0.8 },
] as const;

/** Respiration guidée : l'anneau et les ondes du bassin suivent le souffle. */
function Breath() {
  const [phase, setPhase] = useState(0);
  const cycles = useRef(0);
  useEffect(() => {
    const p = PHASES[phase]!;
    const rt = runtimeRef.current;
    const pond = rt?.scene.ponds[0];
    if (pond && phase !== 1) {
      // Une onde large et douce au centre du bassin à chaque inspiration / expiration
      pond.touch(pond.shape.cx, pond.shape.cy, phase === 0 ? 2.2 : 1.4, 0.06);
      tick('light');
    }
    const id = setTimeout(() => {
      if (phase === PHASES.length - 1) {
        cycles.current++;
        useGame.setState((s) => ({ stats: { ...s.stats, breaths: s.stats.breaths + 1 } }));
      }
      setPhase((phase + 1) % PHASES.length);
    }, p.seconds * 1000);
    return () => clearTimeout(id);
  }, [phase]);
  const p = PHASES[phase]!;
  return (
    <div className="overlay" onPointerDown={exitMode}>
      <div
        className="breath-ring"
        style={{
          transform: `scale(${p.scale})`,
          transitionDuration: `${p.seconds}s`,
          transitionTimingFunction: 'ease-in-out',
        }}
      />
      <div className="breath-text">{t(p.key)}</div>
      <div className="hint">{t('relax.tapToExit')}</div>
    </div>
  );
}

/** Minuteur de méditation : bol chantant au début et à la fin. */
function Meditation({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    audio.play('bell', 0.8);
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          audio.play('bell', 0.9);
          useGame.setState((s) => ({
            stats: { ...s.stats, meditationMin: s.stats.meditationMin + minutes },
          }));
          setTimeout(exitMode, 6000);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [minutes]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="overlay" onDoubleClick={exitMode}>
      <div className="timer">
        {mm}:{ss}
      </div>
      <button className="pill ghost" style={{ marginTop: 24 }} onClick={exitMode}>
        {t('relax.stop')}
      </button>
    </div>
  );
}

/** Mode sommeil : les sons s'estompent et l'écran s'assombrit peu à peu. */
export function startSleep(minutes: number): void {
  audio.fadeOutAll(minutes * 60);
  enterMode('contemplation');
  useUi.setState({ sleepUntil: Date.now() + minutes * 60_000 });
}

function SleepDim() {
  const until = useUi((s) => s.sleepUntil);
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    if (!until) return;
    const start = Date.now();
    const total = until - start;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / total);
      setOpacity(k * 0.9);
      if (k >= 1) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return null;
  return <div className="sleep-dim" style={{ opacity }} />;
}

type Filter = 'none' | 'warm' | 'mist' | 'ink' | 'film';
const FILTERS: Record<Filter, string> = {
  none: 'none',
  warm: 'sepia(0.25) saturate(1.15) brightness(1.04)',
  mist: 'contrast(0.85) brightness(1.1) saturate(0.85) blur(0.4px)',
  ink: 'grayscale(1) contrast(1.15) brightness(1.05)',
  film: 'contrast(1.08) saturate(0.9) sepia(0.12)',
};

async function savePhoto(canvas: HTMLCanvasElement): Promise<void> {
  const name = `komorebi-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  const data = canvas.toDataURL('image/png');
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: `Komorebi/${name}`,
      data: data.split(',')[1] ?? '',
      directory: Directory.Documents,
      recursive: true,
    });
    await Share.share({ title: t('photo.shareText'), files: [res.uri] }).catch(() => undefined);
    return;
  }
  const a = document.createElement('a');
  a.href = data;
  a.download = name;
  a.click();
}

/** Mode photo : capture sans interface, filtres doux, partage. */
function Photo() {
  const [filter, setFilter] = useState<Filter>('none');
  const [flash, setFlash] = useState(0);
  const take = async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const src = await rt.scene.snapshot();
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.filter = FILTERS[filter];
    ctx.drawImage(src, 0, 0);
    if (filter === 'film') {
      ctx.filter = 'none';
      for (let i = 0; i < out.width * out.height * 0.02; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(Math.random() * out.width, Math.random() * out.height, 1, 1);
      }
    }
    setFlash((f) => f + 1);
    tick('medium');
    useGame.setState((s) => ({ stats: { ...s.stats, photos: s.stats.photos + 1 } }));
    await savePhoto(out);
    showToast(t('photo.saved'));
  };
  return (
    <div
      className="overlay"
      style={{
        justifyContent: 'flex-end',
        filter: FILTERS[filter] === 'none' ? undefined : undefined,
      }}
    >
      {flash > 0 && <div key={flash} className="flash" />}
      <button
        className="icon-btn glass"
        style={{ position: 'absolute', top: 'calc(var(--safe-top) + 12px)', right: 12 }}
        onClick={exitMode}
        aria-label={t('common.close')}
      >
        <Icon.close />
      </button>
      <div className="photo-bar">
        <div className="tabs" style={{ padding: 0 }}>
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <button
              key={f}
              className={`chip glass${f === filter ? ' on' : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(`photo.filters.${f}`)}
            </button>
          ))}
        </div>
        <button className="shutter" aria-label={t('photo.take')} onClick={() => void take()} />
      </div>
      {/* Aperçu du filtre sur la scène */}
      <style>{`.scene-host canvas { filter: ${FILTERS[filter]}; transition: filter .4s ease; }`}</style>
    </div>
  );
}

export function ModeOverlay() {
  const mode = useUi((s) => s.mode);
  const minutes = useUi((s) => s.meditationMinutes);
  return (
    <>
      {mode === 'contemplation' && <Contemplation />}
      {mode === 'breath' && <Breath />}
      {mode === 'meditation' && <Meditation minutes={minutes} />}
      {mode === 'photo' && <Photo />}
      <SleepDim />
    </>
  );
}
