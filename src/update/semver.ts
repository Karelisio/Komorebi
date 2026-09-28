export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  pre: (string | number)[];
}

/** Analyse « v1.2.3-beta.1+build » (le préfixe v et les métadonnées de build sont ignorés). */
export function parseSemver(input: string): SemVer | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(input.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
  };
}

/** Comparaison selon SemVer 2.0 : -1, 0 ou 1. Les versions invalides sont les plus petites. */
export function compareSemver(a: string, b: string): number {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (x[k] !== y[k]) return x[k] > y[k] ? 1 : -1;
  }
  // Une pré-version est inférieure à la version finale
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;
  if (!y.pre.length) return -1;
  const n = Math.max(x.pre.length, y.pre.length);
  for (let i = 0; i < n; i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p > q ? 1 : -1;
    if (typeof p === 'number') return -1;
    if (typeof q === 'number') return 1;
    return p > q ? 1 : -1;
  }
  return 0;
}

export function isPrerelease(v: string): boolean {
  return (parseSemver(v)?.pre.length ?? 0) > 0;
}
