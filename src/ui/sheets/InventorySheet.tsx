import { useMemo, useState } from 'react';
import { clock } from '@/engine/clock';
import { runtimeRef } from '@/engine/runtimeRef';
import { tick } from '@/engine/haptics';
import { CATALOG, CATALOG_IDS, ZONES, type CatalogId, type ZoneId } from '@/garden/catalog';
import { t } from '@/i18n';
import { thumbnail } from '@/render/thumbnails';
import { useGame } from '@/state/game';
import { showToast, useUi } from '@/state/ui';
import { BottomSheet, Tabs } from '../components';

type Tab = 'seeds' | 'decor' | 'zones';

function startPlacing(kind: CatalogId): void {
  const rt = runtimeRef.current;
  const cam = rt?.scene.camera;
  useUi.setState({
    sheet: 'none',
    tool: 'place',
    placing: kind,
    ghost: cam ? { x: cam.x, y: cam.y + 60, valid: false } : null,
  });
}

export function InventorySheet() {
  const [tab, setTab] = useState<Tab>('seeds');
  const seeds = useGame((s) => s.seeds);
  const petals = useGame((s) => s.petals);
  const earned = useGame((s) => s.petalsEarned);
  const zones = useGame((s) => s.zones);
  const close = () => useUi.setState({ sheet: 'none' });
  const scene = runtimeRef.current?.scene;

  const items = useMemo(
    () => CATALOG_IDS.filter((id) => (tab === 'seeds' ? CATALOG[id].grows : !CATALOG[id].grows)),
    [tab],
  );

  return (
    <BottomSheet
      title={t('garden.inventory')}
      onClose={close}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'seeds', label: t('garden.seedsTab') },
            { id: 'decor', label: t('garden.decorTab') },
            { id: 'zones', label: t('garden.zonesTab') },
          ]}
        />
      }
    >
      {tab !== 'zones' ? (
        <div className="grid">
          {items.map((id) => {
            const e = CATALOG[id];
            const locked = e.unlockAt > earned;
            const count = seeds[id] ?? 0;
            const affordable = e.grows ? count > 0 : petals >= e.cost;
            return (
              <button
                key={id}
                className={`card${locked || !affordable ? ' locked' : ''}`}
                onClick={() => {
                  if (locked) return showToast(t('garden.locked', { n: e.unlockAt }));
                  if (!affordable) return showToast(t('garden.notEnough'));
                  tick('light');
                  startPlacing(id);
                }}
              >
                {e.grows && <span className="badge">{t('garden.owned', { n: count })}</span>}
                {scene && !locked ? (
                  <img src={thumbnail(scene, id)} alt="" draggable={false} />
                ) : (
                  <div style={{ height: 64 }} />
                )}
                <span>{t(`species.${id}.name` as never)}</span>
                <span className="meta">
                  {locked
                    ? t('garden.locked', { n: e.unlockAt })
                    : e.grows
                      ? `≈ ${t('common.days', { n: e.growthDays })}`
                      : t('garden.cost', { n: e.cost })}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          {ZONES.map((z) => {
            const owned = zones.includes(z.id);
            const available = earned >= z.unlockAt;
            return (
              <div className="row" key={z.id}>
                <div>
                  {t(`zone.${z.id}` as never)}
                  <span className="sub">
                    {owned
                      ? '✓'
                      : available
                        ? t('garden.cost', { n: z.cost })
                        : t('garden.locked', { n: z.unlockAt })}
                  </span>
                </div>
                {!owned && (
                  <button
                    className="pill"
                    disabled={!available || petals < z.cost}
                    onClick={() => {
                      if (useGame.getState().unlockZone(z.id as ZoneId, clock.now())) {
                        tick('medium');
                        showToast(
                          t('garden.zoneUnlocked', { zone: t(`zone.${z.id}` as never) }),
                          3500,
                        );
                        close();
                      }
                    }}
                  >
                    {t('garden.unlockZone', { n: z.cost })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
