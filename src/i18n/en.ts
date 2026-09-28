import type { Dictionary } from './types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/** Traduction anglaise (les clés manquantes retombent sur le français). */
export const en: DeepPartial<Dictionary> = {
  app: {
    name: 'Komorebi',
    tagline: 'A garden that breathes with the day',
  },
  common: {
    close: 'Close',
    cancel: 'Cancel',
    ok: 'OK',
    back: 'Back',
    later: 'Later',
    yes: 'Yes',
    no: 'No',
  },
};
