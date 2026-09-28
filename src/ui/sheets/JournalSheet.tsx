import { useMemo, useState } from 'react';
import { runtimeRef } from '@/engine/runtimeRef';
import { CATALOG_IDS } from '@/garden/catalog';
import { OBJECTIVES } from '@/garden/progression';
import { t } from '@/i18n';
import { express, randomGenome, VARIETIES, type Variety } from '@/pond/genetics';
import { drawKoiCanvas } from '@/render/koiTexture';
import { thumbnail } from '@/render/thumbnails';
import { useGame } from '@/state/game';
import type { JournalEntry } from '@/state/types';
import { useUi } from '@/state/ui';
import { hash } from '@/world/random';
import { BottomSheet, CanvasView, Tabs } from '../components';

type Tab = 'memories' | 'species' | 'koi' | 'goals';

/** Variétés pour lesquelles randomGenome() sait reproduire un gabarit reconnaissable. */
const TEMPLATE_VARIETIES = new Set<Variety>([
  'kohaku',
  'sanke',
  'showa',
  'chagoi',
  'ogon',
  'asagi',
]);

function describeEntry(e: JournalEntry): string {
  const p = (e.params ?? {}) as Record<string, string | number>;
  switch (e.kind) {
    case 'discovery':
      if (e.key === 'variety')
        return t('journal.entry.variety', {
          variety: t(`koi.varieties.${p.variety}` as never),
          name: p.name ?? '',
        });
      break;
    case 'birth':
      return t('journal.entry.birth', { n: p.n ?? 0, a: p.a ?? '?', b: p.b ?? '?' });
    case 'objective':
      return t('journal.entry.objective', { name: t(`goals.${p.id}` as never) });
    case 'memory':
      if (e.key === 'daily') return t('journal.entry.daily', { n: p.n ?? 0 });
      break;
    case 'unlock':
      return t('journal.entry.unlock', {
        name: p.species
          ? t(`species.${p.species}.name` as never)
          : p.zone
            ? t(`zone.${p.zone}` as never)
            : '',
      });
    case 'event':
      if (e.key === 'meteor')
        return t('journal.entry.meteor', { name: t(`meteors.${p.name}` as never) });
      if (e.key === 'bloom')
        return t('journal.entry.bloom', { species: t(`species.${p.species}.name` as never) });
      if (
        e.key === 'firefly' ||
        e.key === 'frogs' ||
        e.key === 'firstRain' ||
        e.key === 'firstSnow' ||
        e.key === 'fullMoon'
      )
        return t(`journal.entry.${e.key}` as never);
      break;
  }
  return t(`journal.entry.${e.key}` as never, p);
}

function MemoriesTab() {
  const journal = useGame((s) => s.journal);
  if (journal.length === 0) return <p className="muted">{t('journal.empty')}</p>;
  return (
    <div>
      {journal.map((e) => (
        <div className="row" key={e.id}>
          <span>
            {describeEntry(e)}
            <span className="sub">
              {new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SpeciesTab() {
  const discovered = useGame((s) => s.discovered.species);
  const scene = runtimeRef.current?.scene;
  return (
    <div className="grid">
      {CATALOG_IDS.map((id) => {
        const known = discovered.includes(id);
        return (
          <div key={id} className={`card${known ? '' : ' locked'}`}>
            {known && scene ? (
              <img src={thumbnail(scene, id)} alt="" draggable={false} />
            ) : (
              <div style={{ height: 64, display: 'grid', placeItems: 'center', fontSize: 22 }}>
                ?
              </div>
            )}
            <span>{known ? t(`species.${id}.name` as never) : '?'}</span>
            {known && <span className="meta">{t(`species.${id}.desc` as never)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function KoiTab() {
  const kois = useGame((s) => s.kois);
  const discovered = useGame((s) => s.discovered.varieties);

  const portraits = useMemo(() => {
    const map = new Map<Variety, HTMLCanvasElement | null>();
    for (const v of VARIETIES) {
      if (!discovered.includes(v)) continue;
      const owned = kois.find((k) => express(k.genome).variety === v);
      if (owned) map.set(v, drawKoiCanvas(owned.genome, 128, 48));
      else if (TEMPLATE_VARIETIES.has(v))
        map.set(v, drawKoiCanvas(randomGenome(hash('journal-koi', v), v), 128, 48));
      else map.set(v, null);
    }
    return map;
  }, [kois, discovered]);

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>
        {t('koi.discovered', { n: discovered.length, total: VARIETIES.length })}
      </p>
      <div className="grid">
        {VARIETIES.map((v) => {
          const known = discovered.includes(v);
          const canvas = portraits.get(v) ?? null;
          return (
            <div key={v} className={`card${known ? '' : ' locked'}`}>
              {known && canvas ? (
                <CanvasView canvas={canvas} />
              ) : (
                <div style={{ height: 64, display: 'grid', placeItems: 'center', fontSize: 22 }}>
                  {known ? '' : '?'}
                </div>
              )}
              <span>{known ? t(`koi.varieties.${v}` as never) : t('koi.unknown')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab() {
  const objectives = useGame((s) => s.objectives);
  return (
    <div>
      {OBJECTIVES.map((o) => (
        <div className="row" key={o.id}>
          <span>
            {objectives[o.id] ? '✓ ' : ''}
            {t(`goals.${o.id}` as never)}
          </span>
          <span className="muted">{t('goals.reward', { n: o.reward })}</span>
        </div>
      ))}
    </div>
  );
}

export function JournalSheet() {
  const [tab, setTab] = useState<Tab>('memories');
  const close = () => useUi.setState({ sheet: 'none' });

  return (
    <BottomSheet
      title={t('journal.title')}
      onClose={close}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'memories', label: t('journal.tabs.memories') },
            { id: 'species', label: t('journal.tabs.species') },
            { id: 'koi', label: t('journal.tabs.koi') },
            { id: 'goals', label: t('journal.tabs.goals') },
          ]}
        />
      }
    >
      {tab === 'memories' && <MemoriesTab />}
      {tab === 'species' && <SpeciesTab />}
      {tab === 'koi' && <KoiTab />}
      {tab === 'goals' && <GoalsTab />}
    </BottomSheet>
  );
}
