import { useState } from 'react';
import { getLang, t } from '@/i18n';
import { useGame } from '@/state/game';
import type { JournalEntry } from '@/state/types';
import { useUi } from '@/state/ui';
import { BottomSheet, Tabs } from '../components';
import { CollectionGrid } from './CollectionSheet';

type Tab = 'memories' | 'koi';

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
    case 'memory':
      if (e.key === 'daily') return t('journal.entry.daily', { n: p.n ?? 0 });
      break;
    case 'unlock':
      if (e.key === 'level') return t('journal.entry.level', { n: p.n ?? 0 });
      break;
    case 'event':
      if (e.key === 'meteor')
        return t('journal.entry.meteor', { name: t(`meteors.${p.name}` as never) });
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
              {new Date(e.at).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </span>
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
            { id: 'koi', label: t('journal.tabs.koi') },
          ]}
        />
      }
    >
      {tab === 'memories' && <MemoriesTab />}
      {tab === 'koi' && <CollectionGrid />}
    </BottomSheet>
  );
}
