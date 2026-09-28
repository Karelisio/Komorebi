import { useState } from 'react';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { BottomSheet, Segmented } from '../components';
import { enterMode, startSleep } from '../modes';

export function RelaxSheet() {
  const [med, setMed] = useState(10);
  const [sleep, setSleep] = useState(30);
  const close = () => useUi.setState({ sheet: 'none' });
  const Row = ({
    title,
    desc,
    children,
  }: {
    title: string;
    desc: string;
    children: React.ReactNode;
  }) => (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        {title}
        <span className="sub">{desc}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
  return (
    <BottomSheet title={t('relax.title')} onClose={close}>
      <Row title={t('relax.contemplation')} desc={t('relax.contemplationDesc')}>
        <button className="pill" onClick={() => enterMode('contemplation')}>
          {t('relax.start')}
        </button>
      </Row>
      <Row title={t('relax.breath')} desc={t('relax.breathDesc')}>
        <button className="pill" onClick={() => enterMode('breath')}>
          {t('relax.start')}
        </button>
      </Row>
      <Row title={t('relax.meditation')} desc={t('relax.meditationDesc')}>
        <Segmented
          value={med}
          onChange={setMed}
          options={[5, 10, 15, 20].map((m) => ({ id: m, label: t('common.minutes', { n: m }) }))}
        />
        <button
          className="pill"
          onClick={() => {
            useUi.setState({ meditationMinutes: med });
            enterMode('meditation', true);
          }}
        >
          {t('relax.start')}
        </button>
      </Row>
      <Row title={t('relax.sleep')} desc={t('relax.sleepDesc')}>
        <Segmented
          value={sleep}
          onChange={setSleep}
          options={[15, 30, 60].map((m) => ({ id: m, label: t('common.minutes', { n: m }) }))}
        />
        <button className="pill" onClick={() => startSleep(sleep)}>
          {t('relax.start')}
        </button>
      </Row>
      <Row title={t('relax.frame')} desc={t('relax.frameDesc')}>
        <button className="pill" onClick={() => enterMode('contemplation', true)}>
          {t('relax.start')}
        </button>
      </Row>
      <Row
        title={t('photo.title')}
        desc={
          t('photo.filters.warm') + ' · ' + t('photo.filters.mist') + ' · ' + t('photo.filters.ink')
        }
      >
        <button className="pill" onClick={() => enterMode('photo')}>
          {t('photo.take')}
        </button>
      </Row>
    </BottomSheet>
  );
}
