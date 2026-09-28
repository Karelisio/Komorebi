import { useEffect, useMemo, useState } from 'react';
import { tick } from '@/engine/haptics';
import { clock } from '@/engine/clock';
import { t } from '@/i18n';
import { express } from '@/pond/genetics';
import { ageDays, isAdult } from '@/pond/koi';
import { drawKoiCanvas } from '@/render/koiTexture';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import { Bar, BottomSheet, CanvasView, Stars } from '../components';
import { Icon } from '../icons';

const TRAITS = ['doitsu', 'metallic', 'ginrin', 'butterfly', 'tancho'] as const;

export function KoiSheet() {
  const id = useUi((s) => s.selectedKoi);
  const koi = useGame((s) => s.kois.find((k) => k.id === id));
  const kois = useGame((s) => s.kois);
  const [name, setName] = useState(koi?.name ?? '');

  useEffect(() => {
    setName(koi?.name ?? '');
  }, [koi?.id, koi?.name]);

  const canvas = useMemo(() => (koi ? drawKoiCanvas(koi.genome, 192, 64) : null), [koi]);

  const close = () => useUi.setState({ sheet: 'none', selectedKoi: null });

  if (!koi) return null;

  const ph = express(koi.genome);
  const now = clock.now();
  const adult = isAdult(koi, now);
  const traits = TRAITS.filter((trait) => ph[trait]);
  const parents = koi.parents;

  const commitName = () => {
    const value = name.trim();
    if (value && value !== koi.name) useGame.getState().renameKoi(koi.id, value);
    else setName(koi.name);
  };

  return (
    <BottomSheet title={t('koi.title')} onClose={close}>
      <div className="hero">
        <CanvasView canvas={canvas} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="text-input"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            aria-label={t('koi.name')}
          />
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            {t(`koi.varieties.${ph.variety}` as never)}
          </p>
        </div>
      </div>
      <div className="row">
        <span>{t('koi.rarity')}</span>
        <Stars n={ph.rarity} />
      </div>
      <div className="row">
        <span>
          {t('koi.age')}
          <span className="sub">{adult ? t('koi.adult') : t('koi.fry')}</span>
        </span>
        <span>{t('koi.ageDays', { n: Math.floor(ageDays(koi, now)) })}</span>
      </div>
      <div className="row">
        <span>{t(`koi.sex.${koi.sex}` as never)}</span>
      </div>
      <div className="row">
        <span>{koi.satiety < 0.35 ? t('koi.hungry') : t('koi.fed')}</span>
        <Bar value={koi.satiety} />
      </div>
      <div className="row">
        <span>
          {parents
            ? t('koi.parents', {
                a: kois.find((k) => k.id === parents[0])?.name ?? '?',
                b: kois.find((k) => k.id === parents[1])?.name ?? '?',
              })
            : t('koi.wildborn')}
        </span>
      </div>
      {traits.length > 0 && (
        <>
          <div className="section-title">{t('koi.traits')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {traits.map((trait) => (
              <span key={trait} className="chip on">
                {t(`koi.trait.${trait}` as never)}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="actions">
        <button
          className={`pill${koi.favorite ? '' : ' ghost'}`}
          onClick={() => {
            useGame.getState().toggleFavorite(koi.id);
            tick('light');
          }}
        >
          <Icon.heart style={{ width: 14, height: 14, marginRight: 4 }} />
          {t('koi.favorite')}
        </button>
      </div>
    </BottomSheet>
  );
}
