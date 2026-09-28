import { useMemo } from 'react';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { renderMarkdown } from '@/update/markdown';
import {
  cancelDownload,
  downloadAndInstall,
  openInstallSettings,
  skipVersion,
  useUpdate,
} from '@/update/updater';
import { Bar, BottomSheet } from '../components';

function size(bytes: number): string {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} Mo` : `${Math.round(bytes / 1e3)} Ko`;
}

export function UpdateSheet() {
  const { release, phase, progress, error } = useUpdate();
  const notes = useMemo(() => renderMarkdown(release?.notes ?? ''), [release]);
  const close = () => useUi.setState({ sheet: 'none' });
  if (!release) return null;
  const busy = phase === 'downloading' || phase === 'verifying' || phase === 'installing';

  return (
    <BottomSheet title={t('update.title')} onClose={close}>
      <p style={{ margin: '0 0 4px', fontSize: 16 }}>
        {t('update.available', { v: release.version })}
      </p>
      {release.apk && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t('update.size', { size: size(release.apk.size) })}
        </p>
      )}
      {/* Notes de version : Markdown échappé puis rendu (voir renderMarkdown) */}
      <div
        className="changelog"
        style={{ fontSize: 14, lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: notes }}
      />
      {phase === 'downloading' && (
        <div className="row">
          <span>{t('update.downloading', { p: Math.round(progress * 100) })}</span>
          <Bar value={progress} />
        </div>
      )}
      {phase === 'verifying' && <p className="muted">{t('update.verifying')}</p>}
      {phase === 'installing' && <p className="muted">{t('update.installing')}</p>}
      {phase === 'permission' && <p>{t('update.permission')}</p>}
      {phase === 'error' && (
        <p style={{ color: 'var(--primary)' }}>
          {error === 'checksum' ? t('update.verifyFailed') : t('update.failed')}
        </p>
      )}
      <div className="actions">
        {phase === 'permission' ? (
          <button className="pill" onClick={() => void openInstallSettings()}>
            {t('update.openSettings')}
          </button>
        ) : (
          <button className="pill" disabled={busy} onClick={() => void downloadAndInstall()}>
            {t('update.now')}
          </button>
        )}
        {phase === 'downloading' ? (
          <button className="pill ghost" onClick={cancelDownload}>
            {t('common.cancel')}
          </button>
        ) : (
          <button className="pill ghost" onClick={close}>
            {t('update.later')}
          </button>
        )}
        <button
          className="pill ghost"
          disabled={busy}
          onClick={() => {
            skipVersion();
            close();
          }}
        >
          {t('update.skip')}
        </button>
      </div>
    </BottomSheet>
  );
}
