import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { create } from 'zustand';
import { APP_CONFIG } from '@/config/app';
import { patchSettings, useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';
import { KomorebiNative } from '@/theme/theme';
import { fetchLatest, fetchSha256, type ReleaseInfo } from './github';
import { compareSemver } from './semver';

export interface CheckOptions {
  /** Déclenché par l'utilisateur : ignore le délai de 24 h et la version ignorée. */
  manual?: boolean;
}

export type CheckResult =
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'error'; message: string };

export type UpdatePhase =
  'idle' | 'available' | 'downloading' | 'verifying' | 'installing' | 'permission' | 'error';

interface UpdateState {
  release: ReleaseInfo | null;
  phase: UpdatePhase;
  progress: number;
  error: string | null;
}

export const useUpdate = create<UpdateState>(() => ({
  release: null,
  phase: 'idle',
  progress: 0,
  error: null,
}));

/** Vérifie GitHub Releases (au plus une fois par 24 h en automatique). */
export async function checkForUpdates(opts: CheckOptions = {}): Promise<CheckResult> {
  const s = useSettings.getState();
  const now = Date.now();
  if (!opts.manual) {
    if (!s.updates.auto) return { status: 'up-to-date' };
    if (now - s.updates.lastCheck < APP_CONFIG.update.checkIntervalMs)
      return { status: 'up-to-date' };
  }
  try {
    const rel = await fetchLatest(s.updates.prerelease);
    patchSettings({ updates: { ...useSettings.getState().updates, lastCheck: now } });
    if (!rel || compareSemver(rel.version, APP_CONFIG.version) <= 0)
      return { status: 'up-to-date' };
    if (!opts.manual && s.updates.skipped === rel.version) return { status: 'up-to-date' };
    useUpdate.setState({ release: rel, phase: 'available', progress: 0, error: null });
    useUi.setState({ sheet: 'update' });
    return { status: 'available', version: rel.version };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export function skipVersion(): void {
  const rel = useUpdate.getState().release;
  if (rel) patchSettings({ updates: { ...useSettings.getState().updates, skipped: rel.version } });
  useUpdate.setState({ phase: 'idle' });
}

let pendingInstall: string | null = null;

async function install(path: string): Promise<void> {
  useUpdate.setState({ phase: 'installing' });
  const r = await KomorebiNative.installApk({ path });
  if (r.needsPermission) {
    pendingInstall = path;
    useUpdate.setState({ phase: 'permission' });
  }
}

/** Au retour des réglages « sources inconnues », relance l'installation. */
if (Capacitor.isNativePlatform()) {
  void App.addListener('resume', () => {
    if (!pendingInstall) return;
    void KomorebiNative.canInstallPackages().then(({ allowed }) => {
      if (allowed && pendingInstall) {
        const p = pendingInstall;
        pendingInstall = null;
        void install(p);
      }
    });
  });
}

/** Télécharge l'APK (reprise si coupure), vérifie le SHA-256 puis lance l'installation. */
export async function downloadAndInstall(): Promise<void> {
  const rel = useUpdate.getState().release;
  if (!rel) return;
  if (!Capacitor.isNativePlatform() || !rel.apk) {
    window.open(rel.url, '_blank', 'noopener');
    return;
  }
  const apk = rel.apk;
  useUpdate.setState({ phase: 'downloading', progress: 0, error: null });
  const listener = await KomorebiNative.addListener('downloadProgress', ({ received, total }) => {
    useUpdate.setState({ progress: total > 0 ? received / total : 0 });
  });
  try {
    const expected = rel.sha256Url ? await fetchSha256(rel.sha256Url) : undefined;
    const res = await KomorebiNative.download({
      url: apk.browser_download_url,
      path: apk.name,
      ...(expected ? { sha256: expected } : {}),
    });
    useUpdate.setState({ phase: 'verifying', progress: 1 });
    if (expected && res.sha256.toLowerCase() !== expected) throw new Error('checksum');
    await install(res.path);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    useUpdate.setState({ phase: 'error', error: msg.includes('checksum') ? 'checksum' : msg });
  } finally {
    await listener.remove();
  }
}

export function openInstallSettings(): Promise<void> {
  return KomorebiNative.openInstallSettings();
}

export function cancelDownload(): void {
  void KomorebiNative.cancelDownload().catch(() => undefined);
  useUpdate.setState({ phase: 'available' });
}
