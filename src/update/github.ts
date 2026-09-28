import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { APP_CONFIG } from '@/config/app';
import { compareSemver } from './semver';

export interface GithubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  published_at: string;
  assets: GithubAsset[];
}

export interface ReleaseInfo {
  version: string;
  notes: string;
  url: string;
  apk: GithubAsset | null;
  sha256Url: string | null;
}

/** GET (JSON ou texte) ; CapacitorHttp en natif pour éviter les restrictions CORS. */
async function get(url: string, json: boolean): Promise<unknown> {
  const headers = { Accept: json ? 'application/vnd.github+json' : 'text/plain' };
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.get({
      url,
      headers,
      responseType: json ? 'json' : 'text',
      connectTimeout: 10_000,
      readTimeout: 15_000,
    });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    return r.data as unknown;
  }
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

/** Release la plus récente selon semver (hors brouillons, pré-versions optionnelles). */
export function pickRelease(
  list: readonly GithubRelease[],
  includePre: boolean,
): GithubRelease | null {
  const ok = list.filter((r) => !r.draft && (includePre || !r.prerelease));
  ok.sort((a, b) => compareSemver(b.tag_name, a.tag_name));
  return ok[0] ?? null;
}

export async function fetchLatest(includePre: boolean): Promise<ReleaseInfo | null> {
  const { owner, repo, apkPattern } = APP_CONFIG.github;
  const base = `https://api.github.com/repos/${owner}/${repo}/releases`;
  let rel: GithubRelease | null;
  if (includePre)
    rel = pickRelease((await get(`${base}?per_page=15`, true)) as GithubRelease[], true);
  else rel = (await get(`${base}/latest`, true)) as GithubRelease;
  if (!rel) return null;
  const apk = rel.assets.find((a) => apkPattern.test(a.name)) ?? null;
  const sha = apk ? rel.assets.find((a) => a.name === `${apk.name}.sha256`) : undefined;
  return {
    version: rel.tag_name.replace(/^v/, ''),
    notes: rel.body ?? '',
    url: rel.html_url,
    apk,
    sha256Url: sha?.browser_download_url ?? null,
  };
}

/** Lit l'empreinte publiée (« <hash>  fichier.apk »). */
export async function fetchSha256(url: string): Promise<string> {
  const text = String(await get(url, false));
  const hash = /^[a-f0-9]{64}/i.exec(text.trim())?.[0];
  if (!hash) throw new Error('empreinte SHA-256 invalide');
  return hash.toLowerCase();
}
