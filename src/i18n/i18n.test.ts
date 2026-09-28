import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { t } from './index';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  it('fr and en have exactly the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it('traduit et interpole', () => {
    expect(t('common.close', undefined, 'fr')).toBe('Fermer');
    expect(t('common.close', undefined, 'en')).toBe('Close');
  });
});
