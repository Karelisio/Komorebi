import { useMemo } from 'react';
import { clock } from '@/engine/clock';
import { tick } from '@/engine/haptics';
import { DECOR, type DecorEffect, type DecorEntry } from '@/garden/decor';
import { t } from '@/i18n';
import { pondCapacity, UPGRADE_MAX, upgradeCost, type UpgradeId } from '@/pond/economy';
import { EGG_OFFERS, type EggOffer } from '@/pond/eggs';
import { paintDecorCanvas } from '@/render/decorArt';
import { NEST_SIZE, useGame } from '@/state/game';
import { showToast, useUi, type ShopTab } from '@/state/ui';
import { useWorld } from '@/state/world';
import { BottomSheet, CanvasView, formatDuration, Tabs } from '../components';
import { Icon } from '../icons';
import { advanceTutorial } from '../Tutorial';

const EGG_TINT = ['#f3e6d6', '#cfd9f2', '#f2d98a'];

function Price({ n, afford }: { n: number; afford: boolean }) {
  return (
    <span className={`price${afford ? '' : ' short'}`}>
      <Icon.petal /> {n}
    </span>
  );
}

function EggsTab() {
  const petals = useGame((s) => s.petals);
  const level = useGame((s) => s.level);
  const eggs = useGame((s) => s.eggs);
  const kois = useGame((s) => s.kois);
  const upgrades = useGame((s) => s.upgrades);
  const now = clock.now();
  const full = kois.length >= pondCapacity(upgrades);
  const buy = (o: EggOffer) => {
    const egg = useGame.getState().buyEgg(o.tier, clock.now());
    if (!egg) {
      showToast(
        eggs.length >= NEST_SIZE ? t('eggs.nestFull', { n: NEST_SIZE }) : t('shop.notEnough'),
      );
      return;
    }
    tick('medium');
    advanceTutorial(2);
    showToast(t('eggs.incubation', { t: formatDuration(egg.hatchAt - clock.now()) }));
  };
  return (
    <div>
      {eggs.length > 0 && (
        <>
          <div className="section-title">
            {t('eggs.nest')} · {eggs.length}/{NEST_SIZE}
          </div>
          {eggs.map((e) => {
            const parents = e.parents
              ? e.parents.map((id) => kois.find((k) => k.id === id)?.name ?? '?')
              : null;
            return (
              <div className="row" key={e.id}>
                <span>
                  <Icon.egg style={{ width: 16, height: 16, verticalAlign: -3, marginRight: 6 }} />
                  {parents
                    ? t('eggs.bred', { a: parents[0]!, b: parents[1]! })
                    : t(`eggs.tier.${e.tier}` as never)}
                </span>
                <span className="muted">
                  {e.hatchAt <= now
                    ? full
                      ? t('eggs.waiting')
                      : t('eggs.ready')
                    : formatDuration(e.hatchAt - now)}
                </span>
              </div>
            );
          })}
        </>
      )}
      <div className="section-title">{t('eggs.title')}</div>
      <div className="offers">
        {EGG_OFFERS.map((o) => {
          const locked = level < o.level;
          return (
            <button
              key={o.tier}
              className={`offer${locked ? ' locked' : ''}`}
              disabled={locked}
              onClick={() => buy(o)}
            >
              <span className="egg-art" style={{ background: EGG_TINT[o.tier] }} />
              <span className="offer-text">
                <strong>{t(`eggs.tier.${o.tier}` as never)}</strong>
                <span className="meta">
                  {locked
                    ? t('common.locked', { n: o.level })
                    : `${t(`eggs.tierDesc.${o.tier}` as never)} · ${formatDuration(o.incubation)}`}
                </span>
              </span>
              <Price n={o.cost} afford={petals >= o.cost} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function effectText(e: DecorEffect): string {
  return (Object.entries(e) as [keyof DecorEffect, number][])
    .map(([k, v]) => t(`decor.effect.${k}` as never, { n: v }))
    .join(' · ');
}

function DecorCard({ d, onPick }: { d: DecorEntry; onPick: (d: DecorEntry) => void }) {
  const level = useGame((s) => s.level);
  const petals = useGame((s) => s.petals);
  // Repeint seulement au changement de saison
  const seasonName = useWorld((s) => s.season?.season);
  const canvas = useMemo(() => {
    const season = useWorld.getState().season;
    return season && seasonName ? paintDecorCanvas(d.id, season, 0).canvas : null;
  }, [d.id, seasonName]);
  const locked = level < d.level;
  return (
    <button
      className={`card decor${locked ? ' locked' : ''}`}
      disabled={locked}
      onClick={() => onPick(d)}
    >
      <CanvasView canvas={canvas} />
      <span>{t(`decor.items.${d.id}.name` as never)}</span>
      <span className="meta">
        {locked ? t('common.locked', { n: d.level }) : effectText(d.effect)}
      </span>
      {!locked && <Price n={d.cost} afford={petals >= d.cost} />}
    </button>
  );
}

function DecorTab() {
  const slot = useUi((s) => s.selectedSlot);
  const decor = useGame((s) => s.decor);
  const pick = (d: DecorEntry) => {
    const free = slot !== null && !decor[slot] ? slot : decor.findIndex((x) => !x);
    if (free < 0) {
      showToast(t('shop.slotFull'));
      return;
    }
    if (!useGame.getState().placeDecor(free, d.id)) {
      showToast(t('shop.notEnough'));
      return;
    }
    tick('medium');
    advanceTutorial(3);
    useUi.setState({ sheet: 'none', selectedSlot: null, decorMode: false });
  };
  return (
    <div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
        {t('shop.chooseSlot')}
      </p>
      <div className="grid">
        {DECOR.map((d) => (
          <DecorCard key={d.id} d={d} onPick={pick} />
        ))}
      </div>
    </div>
  );
}

const UPGRADES: UpgradeId[] = ['pond', 'food', 'charm'];

function UpgradesTab() {
  const upgrades = useGame((s) => s.upgrades);
  const petals = useGame((s) => s.petals);
  return (
    <div className="offers">
      {UPGRADES.map((id) => {
        const lvl = upgrades[id];
        const max = lvl >= UPGRADE_MAX[id];
        const cost = upgradeCost(id, lvl);
        const next = { ...upgrades, [id]: lvl + 1 };
        const n =
          id === 'pond' ? pondCapacity(next) : id === 'food' ? (lvl + 1) * 30 : (lvl + 1) * 20;
        return (
          <button
            key={id}
            className="offer"
            disabled={max}
            onClick={() => {
              if (useGame.getState().upgrade(id)) tick('medium');
              else showToast(t('shop.notEnough'));
            }}
          >
            <span className="offer-text">
              <strong>{t(`upgrades.${id}.name` as never)}</strong>
              <span className="meta">
                {t('upgrades.level', { a: lvl, b: UPGRADE_MAX[id] })} ·{' '}
                {max ? t('upgrades.max') : t(`upgrades.${id}.desc` as never, { n })}
              </span>
            </span>
            {!max && <Price n={cost} afford={petals >= cost} />}
          </button>
        );
      })}
    </div>
  );
}

export function ShopSheet() {
  const tab = useUi((s) => s.shopTab);
  const close = () => useUi.setState({ sheet: 'none', selectedSlot: null });
  return (
    <BottomSheet
      title={t('shop.title')}
      onClose={close}
      tabs={
        <Tabs<ShopTab>
          value={tab}
          onChange={(v) => useUi.setState({ shopTab: v, decorMode: v === 'decor' })}
          options={[
            { id: 'eggs', label: t('shop.tabs.eggs') },
            { id: 'decor', label: t('shop.tabs.decor') },
            { id: 'upgrades', label: t('shop.tabs.upgrades') },
          ]}
        />
      }
    >
      {tab === 'eggs' && <EggsTab />}
      {tab === 'decor' && <DecorTab />}
      {tab === 'upgrades' && <UpgradesTab />}
    </BottomSheet>
  );
}
