import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useEffect, useState } from 'react';
import { startAudioBridge } from '@/audio/bridge';
import { boot, catchUp } from '@/engine/boot';
import { useDebug } from '@/engine/debug';
import { startNotifications } from '@/engine/notifications';
import { checkDaily, onNatureEvent, progressTick } from '@/engine/progress';
import { runtimeRef } from '@/engine/runtimeRef';
import { setLang, t } from '@/i18n';
import { useSettings } from '@/state/settings';
import { showToast, useUi } from '@/state/ui';
import { applyTheme, watchSystemTheme } from '@/theme/theme';
import { checkForUpdates } from '@/update/updater';
import { Hud, Toast } from './Hud';
import { ModeOverlay } from './modes';
import { SceneHost } from './SceneHost';
import { CollectionSheet } from './sheets/CollectionSheet';
import { DebugSheet } from './sheets/DebugSheet';
import { DecorSheet } from './sheets/DecorSheet';
import { JournalSheet } from './sheets/JournalSheet';
import { KoiSheet } from './sheets/KoiSheet';
import { RelaxSheet } from './sheets/RelaxSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { ShopSheet } from './sheets/ShopSheet';
import { UpdateSheet } from './sheets/UpdateSheet';
import { advanceTutorial, Tutorial } from './Tutorial';

function Sheets() {
  const sheet = useUi((s) => s.sheet);
  switch (sheet) {
    case 'shop':
      return <ShopSheet />;
    case 'decor':
      return <DecorSheet />;
    case 'collection':
      return <CollectionSheet />;
    case 'koi':
      return <KoiSheet />;
    case 'journal':
      return <JournalSheet />;
    case 'settings':
      return <SettingsSheet />;
    case 'debug':
      return <DebugSheet />;
    case 'relax':
      return <RelaxSheet />;
    case 'update':
      return <UpdateSheet />;
    default:
      return null;
  }
}

function Fps() {
  const show = useDebug((s) => s.showFps);
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      const loop = runtimeRef.current?.scene.loop;
      if (loop) setFps(Math.round(1000 / loop.intervalMs));
    }, 500);
    return () => clearInterval(id);
  }, [show]);
  if (!show) return null;
  const res = runtimeRef.current?.scene.renderer.resolution ?? 0;
  return (
    <div className="fps">
      {fps} fps · ×{res.toFixed(2)}
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const theme = useSettings((s) => s.theme);
  const keepAwake = useSettings((s) => s.keepAwake);
  const lang = useSettings((s) => s.lang);
  useEffect(() => setLang(lang), [lang]);

  useEffect(() => {
    void boot().then(({ away }) => {
      setReady(true);
      checkDaily();
      if (away && away.petals > 0)
        setTimeout(() => showToast(t('harvest.away', { n: away.petals }), 4500), 5000);
    });
    if (Capacitor.isNativePlatform()) {
      void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    }
    return startNotifications();
  }, []);

  useEffect(() => {
    void applyTheme(theme);
    return watchSystemTheme(() => useSettings.getState().theme);
  }, [theme]);

  useEffect(() => {
    if (keepAwake) void KeepAwake.keepAwake().catch(() => undefined);
    else if (useUi.getState().mode === 'garden') void KeepAwake.allowSleep().catch(() => undefined);
  }, [keepAwake]);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      if (catchUp()) checkDaily();
    }, 60_000);
    return () => clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!sceneReady) return;
    void SplashScreen.hide().catch(() => undefined);
    // Vérification des mises à jour au lancement (au plus une fois par 24 h)
    const id = setTimeout(() => void checkForUpdates(), 8000);
    const rt = runtimeRef.current;
    const stopAudio = rt ? startAudioBridge(rt) : undefined;
    return () => {
      clearTimeout(id);
      stopAudio?.();
    };
  }, [sceneReady]);

  return (
    <main className="app">
      {ready && (
        <SceneHost
          onReady={(rt) => {
            runtimeRef.current = rt;
            setTimeout(() => setSceneReady(true), 400);
          }}
          hooks={{
            onNature: onNatureEvent,
            onTick: () => progressTick(),
            onFeed: () => advanceTutorial(0),
            onCollect: () => advanceTutorial(1),
          }}
        />
      )}
      {/* Clé sur la langue : l'interface se re-rend, la scène reste en place */}
      <div key={lang} style={{ display: 'contents' }}>
        {sceneReady && <Hud />}
        {sceneReady && <Tutorial />}
        <ModeOverlay />
        <Sheets />
        <Toast />
      </div>
      <Fps />
      <div className={`splash${sceneReady ? ' gone' : ''}`}>
        <h1>{t('app.name')}</h1>
        <p>{t('app.tagline')}</p>
      </div>
    </main>
  );
}
