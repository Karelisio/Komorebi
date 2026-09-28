import { clock } from '@/engine/clock';
import { runtimeRef } from '@/engine/runtimeRef';
import { tick } from '@/engine/haptics';
import { CATALOG } from '@/garden/catalog';
import { bonsaiStyle, canHarvest, stageOf, thirst } from '@/garden/growth';
import { t } from '@/i18n';
import { thumbnail } from '@/render/thumbnails';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import { Bar, BottomSheet, formatDuration } from '../components';

export function ObjectSheet() {
  const id = useUi((s) => s.selectedObject);
  const o = useGame((s) => s.objects.find((x) => x.id === id));
  const close = () => useUi.setState({ sheet: 'none', selectedObject: null });
  if (!o) return null;
  const e = CATALOG[o.kind];
  const scene = runtimeRef.current?.scene;
  const now = clock.now();
  const th = thirst(o);

  return (
    <BottomSheet title={t(`species.${o.kind}.name` as never)} onClose={close}>
      <div className="hero">
        {scene && <img src={thumbnail(scene, o.kind)} alt="" style={{ width: 80, height: 80 }} />}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {t(`species.${o.kind}.desc` as never)}
        </p>
      </div>
      {e.grows && (
        <>
          <div className="row">
            <span>
              {t('garden.growth')}
              <span className="sub">
                {o.growth >= 1
                  ? t('garden.mature')
                  : t('garden.stage', { n: stageOf(o) + 1, total: e.stages })}
              </span>
            </span>
            <Bar value={o.growth} />
          </div>
          <div className="row">
            <span>{th > 0.3 ? t('garden.thirsty') : t('garden.watered')}</span>
            <Bar value={o.water} />
          </div>
          {e.category === 'tree' && (
            <div className="row">
              <span>{t(`garden.bonsai.${bonsaiStyle(o)}` as never)}</span>
              <span className="muted">✂ {o.pruneCount}</span>
            </div>
          )}
          <div className="row">
            <span className="muted">
              {canHarvest(o, now)
                ? t('garden.readyHarvest')
                : o.growth >= 1
                  ? t('garden.nextHarvest', { t: formatDuration(o.harvestAt - now) })
                  : ''}
            </span>
          </div>
        </>
      )}
      <div className="actions">
        {e.grows && (
          <button
            className="pill"
            onClick={() => {
              useGame.getState().waterObjects([o.id], 0.6, now);
              runtimeRef.current?.garden.waterAt(o.x, o.y, 0);
              tick('light');
            }}
          >
            {t('hud.water')}
          </button>
        )}
        <button
          className="pill ghost"
          onClick={() => {
            useUi.setState({ sheet: 'none', selectedObject: null, movingObject: o.id });
            tick('light');
          }}
        >
          {t('common.move')}
        </button>
        <button
          className="pill ghost"
          onClick={() => {
            useGame.getState().removeObject(o.id);
            close();
          }}
        >
          {t('common.remove')}
        </button>
      </div>
    </BottomSheet>
  );
}
