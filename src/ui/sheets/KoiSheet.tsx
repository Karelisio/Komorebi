import { useEffect, useMemo, useState } from 'react';
import { clock } from '@/engine/clock';
import { tick } from '@/engine/haptics';
import { t } from '@/i18n';
import { koiRate } from '@/pond/economy';
import { BREED_COOLDOWN, BREED_COST } from '@/pond/eggs';
import { express } from '@/pond/genetics';
import { isAdult, koiGrowth } from '@/pond/koi';
import { drawKoiCanvas } from '@/render/koiTexture';
import { useGame } from '@/state/game';
import { showToast, useUi } from '@/state/ui';
import { Bar, BottomSheet, CanvasView, formatDuration, Stars } from '../components';
import { Icon } from '../icons';

const TRAITS = ['doitsu', 'metallic', 'ginrin', 'butterfly', 'tancho'] as const;

export function KoiSheet() {
  const id = useUi((s) => s.selectedKoi);
  const breedWith = useUi((s) => s.breedWith);
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
  const rest = (koi.lastBredAt ?? 0) + BREED_COOLDOWN - now;
  const partner = breedWith ? kois.find((k) => k.id === breedWith) : undefined;

  const commitName = () => {
    const value = name.trim();
    if (value && value !== koi.name) useGame.getState().renameKoi(koi.id, value);
    else setName(koi.name);
  };

  const breed = () => {
    if (partner && partner.id !== koi.id) {
      const egg = useGame.getState().breed(partner.id, koi.id, clock.now());
      useUi.setState({ breedWith: null });
      if (egg) {
        tick('medium');
        showToast(t('koi.breedDone'));
        close();
      } else showToast(t('koi.breedFail'));
      return;
    }
    useUi.setState({ breedWith: koi.id, sheet: 'none', selectedKoi: null });
    showToast(t('koi.breedPick', { name: koi.name }), 4000);
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
            {t(`koi.varieties.${ph.variety}` as never)} · {t(`koi.sex.${koi.sex}` as never)}
          </p>
        </div>
      </div>
      <div className="row">
        <span>{t('koi.rarity')}</span>
        <Stars n={ph.rarity} />
      </div>
      <div className="row">
        <span>
          {t('koi.growth')}
          <span className="sub">{adult ? t('koi.adult') : t('koi.fry')}</span>
        </span>
        <Bar value={koiGrowth(koi, now)} />
      </div>
      <div className="row">
        <span>{koi.satiety < 0.35 ? t('koi.hungry') : t('koi.fed')}</span>
        <Bar value={koi.satiety} />
      </div>
      <div className="row">
        <span>{t('koi.production')}</span>
        <span>
          <Icon.petal style={{ width: 14, height: 14, verticalAlign: -2 }} />{' '}
          {t('hud.rate', { n: koiRate(koi, now).toFixed(1) })}
        </span>
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
          className="pill"
          disabled={!adult || rest > 0}
          onClick={breed}
          title={!adult ? t('koi.breedNeedsAdult') : undefined}
        >
          {partner && partner.id !== koi.id
            ? `${t('koi.breed', { n: BREED_COST })} · ${partner.name}`
            : rest > 0
              ? t('koi.breedCooldown', { t: formatDuration(rest) })
              : t('koi.breed', { n: BREED_COST })}
        </button>
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
        {!koi.favorite && kois.length > 1 && (
          <button
            className="pill ghost"
            onClick={() => {
              const n = useGame.getState().releaseKoi(koi.id);
              if (n) showToast(t('koi.released', { name: koi.name, n }));
              close();
            }}
          >
            {t('koi.release')}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
