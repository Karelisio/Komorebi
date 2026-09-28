import { useEffect, useState } from 'react';
import { boot, catchUp } from '@/engine/boot';
import { checkDaily, onNatureEvent, progressTick } from '@/engine/progress';
import { runtimeRef } from '@/engine/runtimeRef';
import { t } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { applyTheme, watchSystemTheme } from '@/theme/theme';
import { Hud, Toast } from './Hud';
import { SceneHost } from './SceneHost';
import { InventorySheet } from './sheets/InventorySheet';
import { ObjectSheet } from './sheets/ObjectSheet';

function Sheets() {
  const sheet = useUi((s) => s.sheet);
  switch (sheet) {
    case 'inventory':
      return <InventorySheet />;
    case 'object':
      return <ObjectSheet />;
    default:
      return null;
  }
}

export function App() {
  const [ready, setReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    void boot().then(() => {
      setReady(true);
      checkDaily();
    });
  }, []);

  useEffect(() => {
    void applyTheme(theme);
    return watchSystemTheme(() => useSettings.getState().theme);
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (catchUp()) checkDaily();
    }, 60_000);
    return () => clearInterval(timer);
  }, [ready]);

  return (
    <main className="app">
      {ready && (
        <SceneHost
          onReady={(rt) => {
            runtimeRef.current = rt;
            setTimeout(() => setSceneReady(true), 400);
          }}
          hooks={{ onNature: onNatureEvent, onTick: () => progressTick() }}
        />
      )}
      {sceneReady && <Hud />}
      <Sheets />
      <Toast />
      <div className={`splash${sceneReady ? ' gone' : ''}`}>
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </div>
    </main>
  );
}
