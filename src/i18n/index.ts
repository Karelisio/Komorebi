import { en } from './en';
import { fr } from './fr';
import type { Lang, TKey } from './types';

export type { Lang, TKey } from './types';

const dictionaries: Record<Lang, unknown> = { fr, en };

let current: Lang = 'fr';

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav.toLowerCase().startsWith('fr')
    ? 'fr'
    : nav.toLowerCase().startsWith('en')
      ? 'en'
      : 'fr';
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

/** Traduit une clé, avec interpolation `{nom}`. Repli sur le français puis sur la clé. */
export function t(
  key: TKey,
  params?: Record<string, string | number>,
  lang: Lang = current,
): string {
  const raw = lookup(dictionaries[lang], key) ?? lookup(fr, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

/** Traduction d'une clé dynamique (ex. id d'espèce) — renvoie undefined si absente. */
export function tMaybe(key: string, lang: Lang = current): string | undefined {
  return lookup(dictionaries[lang], key) ?? lookup(fr, key);
}
