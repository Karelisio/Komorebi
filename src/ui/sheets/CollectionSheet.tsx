import { useMemo } from 'react';
import { t } from '@/i18n';
import { pondCapacity } from '@/pond/economy';
import { express, randomGenome, VARIETIES, type Variety } from '@/pond/genetics';
import { koiSize } from '@/pond/koi';
import { clock } from '@/engine/clock';
import { drawKoiCanvas } from '@/render/koiTexture';
import { useGame } from '@/state/game';
import { useUi } from '@/state/ui';
import { hash } from '@/world/random';
import { Bar, BottomSheet, CanvasView, Stars } from '../components';

/** Variétés pour lesquelles randomGenome() sait reproduire un gabarit reconnaissable. */
const TEMPLATE_VARIETIES = new Set<Variety>([
  'kohaku',
  'sanke',
  'showa',
  'chagoi',
  'ogon',
  'asagi',
]);

/** Grille des variétés : découvertes en portrait, les autres en silhouette. */
export function CollectionGrid() {
  const kois = useGame((s) => s.kois);
  const discovered = useGame((s) => s.discovered.varieties);
  const portraits = useMemo(() => {
    const map = new Map<Variety, { canvas: HTMLCanvasElement | null; rarity: number }>();
    for (const v of VARIETIES) {
      const owned = kois.find((k) => express(k.genome).variety === v);
      const genome =
        owned?.genome ?? (TEMPLATE_VARIETIES.has(v) ? randomGenome(hash('carnet', v), v) : null);
      const known = discovered.includes(v);
      map.set(v, {
        canvas: known && genome ? drawKoiCanvas(genome, 128, 48) : null,
        rarity: genome ? express(genome).rarity : 0,
      });
    }
    return map;
  }, [kois, discovered]);

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
        {t('collection.discovered', { n: discovered.length, total: VARIETIES.length })}
      </p>
      <div className="grid">
        {VARIETIES.map((v) => {
          const known = discovered.includes(v);
          const p = portraits.get(v);
          return (
            <div key={v} className={`card${known ? '' : ' locked'}`}>
              {known && p?.canvas ? (
                <CanvasView canvas={p.canvas} />
              ) : (
                <div className="silhouette" aria-hidden="true" />
              )}
              <span>{known ? t(`koi.varieties.${v}` as never) : t('collection.unknown')}</span>
              {known && p && p.rarity > 0 && <Stars n={p.rarity} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Koïs du bassin : portrait, croissance ; toucher ouvre la fiche. */
function PondList() {
  const kois = useGame((s) => s.kois);
  const upgrades = useGame((s) => s.upgrades);
  const now = clock.now();
  const portraits = useMemo(
    () => new Map(kois.map((k) => [k.id, drawKoiCanvas(k.genome, 128, 48)])),
    [kois],
  );
  return (
    <div>
      <div className="section-title">
        {t('collection.inPond', { n: kois.length, max: pondCapacity(upgrades) })}
      </div>
      <div className="grid">
        {kois.map((k) => (
          <button
            key={k.id}
            className="card"
            onClick={() => useUi.setState({ selectedKoi: k.id, sheet: 'koi' })}
          >
            <CanvasView canvas={portraits.get(k.id) ?? null} />
            <span>{k.name}</span>
            <Bar value={(koiSize(k, now) - 0.3) / 0.7} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function CollectionSheet() {
  const close = () => useUi.setState({ sheet: 'none' });
  return (
    <BottomSheet title={t('collection.title')} onClose={close}>
      <PondList />
      <div className="section-title">{t('journal.tabs.koi')}</div>
      <CollectionGrid />
    </BottomSheet>
  );
}
