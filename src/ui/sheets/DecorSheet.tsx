import { useMemo } from 'react';
import { tick } from '@/engine/haptics';
import { decor, type DecorEffect } from '@/garden/decor';
import { t } from '@/i18n';
import { paintDecorCanvas } from '@/render/decorArt';
import { useGame } from '@/state/game';
import { showToast, useUi } from '@/state/ui';
import { useWorld } from '@/state/world';
import { BottomSheet, CanvasView } from '../components';

/** Détail d'un décor posé : effet et retrait (remboursé à moitié). */
export function DecorSheet() {
  const slot = useUi((s) => s.selectedSlot);
  const id = useGame((s) => (slot === null ? null : s.decor[slot]));
  // Repeint seulement au changement de saison
  const seasonName = useWorld((s) => s.season?.season);
  const canvas = useMemo(() => {
    const season = useWorld.getState().season;
    return id && season && seasonName ? paintDecorCanvas(id, season, 0).canvas : null;
  }, [id, seasonName]);
  const close = () => useUi.setState({ sheet: 'none', selectedSlot: null });
  if (slot === null || !id) return null;
  const e = decor(id);
  const effects = (Object.entries(e.effect) as [keyof DecorEffect, number][]).map(([k, v]) =>
    t(`decor.effect.${k}` as never, { n: v }),
  );
  return (
    <BottomSheet title={t(`decor.items.${id}.name` as never)} onClose={close}>
      <div className="hero">
        <CanvasView canvas={canvas} className="decor-hero" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0 }}>{t(`decor.items.${id}.desc` as never)}</p>
          {effects.map((x) => (
            <p key={x} className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {x}
            </p>
          ))}
        </div>
      </div>
      <div className="actions">
        <button
          className="pill ghost"
          onClick={() => {
            const n = useGame.getState().removeDecor(slot);
            tick('light');
            showToast(t('common.petalsGain', { n }));
            close();
          }}
        >
          {t('decor.remove', { n: Math.floor(e.cost / 2) })}
        </button>
      </div>
    </BottomSheet>
  );
}
