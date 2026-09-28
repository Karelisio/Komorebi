import type { fr } from './fr';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** Forme du dictionnaire, dérivée du français (langue de référence). */
export type Dictionary = Widen<typeof fr>;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T & string];

/** Clé de traduction typée, ex. `common.close`. */
export type TKey = Paths<Dictionary>;

export type Lang = 'fr' | 'en';
