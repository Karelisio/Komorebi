import { useRef, useState } from 'react';
import { useDebug } from '@/engine/debug';
import { setLang, t, type Lang } from '@/i18n';
import { exportSave, importSave } from '@/save/storage';
import type { QualityLevel } from '@/render/quality';
import { patchSettings, useSettings, type ThemeMode } from '@/state/settings';
import { showToast, useUi } from '@/state/ui';
import { checkForUpdates } from '@/update/updater';
import { BottomSheet, Segmented, Switch } from '../components';

const THEMES: ThemeMode[] = ['natural', 'material', 'light', 'dark'];
const QUALITIES: QualityLevel[] = ['low', 'medium', 'high'];

export function SettingsSheet() {
  const settings = useSettings();
  const close = () => useUi.setState({ sheet: 'none' });
  const fileRef = useRef<HTMLInputElement>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  const [checking, setChecking] = useState(false);

  const onVersionTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 1500);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      useDebug.setState({ enabled: true });
      useUi.setState({ sheet: 'debug' });
    }
  };

  return (
    <BottomSheet title={t('settings.title')} onClose={close}>
      <div className="section-title">{t('settings.general')}</div>
      <div className="row">
        <span>{t('settings.language')}</span>
        <Segmented<Lang>
          value={settings.lang}
          onChange={(v) => {
            patchSettings({ lang: v });
            setLang(v);
          }}
          options={[
            { id: 'fr', label: 'Français' },
            { id: 'en', label: 'English' },
          ]}
        />
      </div>
      <div className="row">
        <span>{t('settings.theme')}</span>
        <Segmented<ThemeMode>
          value={settings.theme}
          onChange={(v) => patchSettings({ theme: v })}
          options={THEMES.map((th) => ({ id: th, label: t(`settings.themes.${th}` as never) }))}
        />
      </div>
      <div className="row">
        <span>{t('settings.accentTint')}</span>
        <Switch
          on={settings.accentTint}
          onChange={(v) => patchSettings({ accentTint: v })}
          label={t('settings.accentTint')}
        />
      </div>

      <div className="section-title">{t('settings.graphics')}</div>
      <div className="row">
        <span>{t('settings.quality')}</span>
        <Segmented<QualityLevel>
          value={settings.quality}
          onChange={(v) => patchSettings({ quality: v })}
          options={QUALITIES.map((q) => ({ id: q, label: t(`settings.qualities.${q}` as never) }))}
        />
      </div>
      <div className="row">
        <span>{t('settings.fps')}</span>
        <Segmented<30 | 60>
          value={settings.fpsCap}
          onChange={(v) => patchSettings({ fpsCap: v })}
          options={[
            { id: 30, label: t('settings.fps30') },
            { id: 60, label: t('settings.fps60') },
          ]}
        />
      </div>

      <div className="section-title">{t('settings.audio')}</div>
      <div className="row">
        <span>{t('settings.ambient')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volumes.ambient}
          onChange={(e) =>
            patchSettings({ volumes: { ...settings.volumes, ambient: Number(e.target.value) } })
          }
        />
      </div>
      <div className="row">
        <span>{t('settings.music')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volumes.music}
          onChange={(e) =>
            patchSettings({ volumes: { ...settings.volumes, music: Number(e.target.value) } })
          }
        />
      </div>
      <div className="row">
        <span>{t('settings.sfx')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volumes.sfx}
          onChange={(e) =>
            patchSettings({ volumes: { ...settings.volumes, sfx: Number(e.target.value) } })
          }
        />
      </div>
      <div className="row">
        <span>{t('settings.musicOn')}</span>
        <Switch
          on={settings.music}
          onChange={(v) => patchSettings({ music: v })}
          label={t('settings.musicOn')}
        />
      </div>
      <div className="row">
        <span>{t('settings.haptics')}</span>
        <Switch
          on={settings.haptics}
          onChange={(v) => patchSettings({ haptics: v })}
          label={t('settings.haptics')}
        />
      </div>

      <div className="section-title">{t('settings.screen')}</div>
      <div className="row">
        <span>{t('settings.keepAwake')}</span>
        <Switch
          on={settings.keepAwake}
          onChange={(v) => patchSettings({ keepAwake: v })}
          label={t('settings.keepAwake')}
        />
      </div>

      <div className="section-title">{t('settings.location')}</div>
      <div className="row">
        <span>{t('settings.location')}</span>
        <Segmented<'auto' | 'fallback'>
          value={settings.location}
          onChange={(v) => patchSettings({ location: v })}
          options={[
            { id: 'auto', label: t('settings.locationAuto') },
            { id: 'fallback', label: t('settings.locationFallback') },
          ]}
        />
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
        {t('settings.locationDesc')}
      </p>

      <div className="section-title">{t('settings.notifications')}</div>
      <div className="row">
        <span>{t('settings.notifications')}</span>
        <Switch
          on={settings.notifications.enabled}
          onChange={(v) =>
            patchSettings({ notifications: { ...settings.notifications, enabled: v } })
          }
          label={t('settings.notifications')}
        />
      </div>
      <div className="row">
        <span>{t('settings.notifBloom')}</span>
        <Switch
          on={settings.notifications.bloom}
          onChange={(v) =>
            patchSettings({ notifications: { ...settings.notifications, bloom: v } })
          }
          label={t('settings.notifBloom')}
        />
      </div>
      <div className="row">
        <span>{t('settings.notifFry')}</span>
        <Switch
          on={settings.notifications.fry}
          onChange={(v) => patchSettings({ notifications: { ...settings.notifications, fry: v } })}
          label={t('settings.notifFry')}
        />
      </div>
      <div className="row">
        <span>{t('settings.notifMeteors')}</span>
        <Switch
          on={settings.notifications.meteors}
          onChange={(v) =>
            patchSettings({ notifications: { ...settings.notifications, meteors: v } })
          }
          label={t('settings.notifMeteors')}
        />
      </div>

      <div className="section-title">{t('settings.updates')}</div>
      <div className="row">
        <span>{t('settings.autoUpdate')}</span>
        <Switch
          on={settings.updates.auto}
          onChange={(v) => patchSettings({ updates: { ...settings.updates, auto: v } })}
          label={t('settings.autoUpdate')}
        />
      </div>
      <div className="row">
        <span>{t('settings.prerelease')}</span>
        <Switch
          on={settings.updates.prerelease}
          onChange={(v) => patchSettings({ updates: { ...settings.updates, prerelease: v } })}
          label={t('settings.prerelease')}
        />
      </div>
      <div className="row">
        <span>{t('settings.checkNow')}</span>
        <button
          className="pill ghost"
          disabled={checking}
          onClick={() => {
            setChecking(true);
            void checkForUpdates({ manual: true })
              .then((res) => {
                if (res.status === 'up-to-date') showToast(t('settings.upToDate'));
              })
              .finally(() => setChecking(false));
          }}
        >
          {t('settings.checkNow')}
        </button>
      </div>

      <div className="section-title">{t('settings.save')}</div>
      <div className="actions">
        <button
          className="pill ghost"
          onClick={() => {
            void exportSave().then(() => showToast(t('settings.exported')));
          }}
        >
          {t('settings.export')}
        </button>
        <button className="pill ghost" onClick={() => fileRef.current?.click()}>
          {t('settings.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void importSave(file)
              .then(() => showToast(t('settings.imported')))
              .catch(() => showToast(t('settings.importError')));
          }}
        />
      </div>

      <div className="section-title">{t('settings.about')}</div>
      <button
        type="button"
        className="row"
        style={{ width: '100%', textAlign: 'left', cursor: 'default' }}
        onClick={onVersionTap}
      >
        <span>{t('settings.version', { v: __APP_VERSION__ })}</span>
      </button>
      <p className="muted" style={{ fontSize: 12 }}>
        {t('settings.credits')}
      </p>
    </BottomSheet>
  );
}
