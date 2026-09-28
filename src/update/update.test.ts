import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';
import { compareSemver, isPrerelease, parseSemver } from './semver';
import { pickRelease, type GithubRelease } from './github';

describe('semver', () => {
  it('analyse avec ou sans v', () => {
    expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseSemver('2.0.0-beta.1+42')?.pre).toEqual(['beta', 1]);
    expect(parseSemver('1.2')).toBeNull();
  });

  it('ordre SemVer 2.0 (exemple de la spécification)', () => {
    const order = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(compareSemver(order[i]!, order[i + 1]!)).toBe(-1);
      expect(compareSemver(order[i + 1]!, order[i]!)).toBe(1);
    }
  });

  it('majeur/mineur/correctif et égalité', () => {
    expect(compareSemver('v1.10.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.0', 'v1.0.0')).toBe(0);
    expect(compareSemver('0.9.0', '1.0.0')).toBe(-1);
    expect(compareSemver('garbage', '1.0.0')).toBe(-1);
    expect(isPrerelease('1.0.0-rc.1')).toBe(true);
  });
});

describe('choix de la release', () => {
  const rel = (tag: string, prerelease = false, draft = false): GithubRelease => ({
    tag_name: tag,
    name: tag,
    body: '',
    prerelease,
    draft,
    html_url: '',
    published_at: '',
    assets: [],
  });

  it('ignore brouillons et pré-versions si non demandées', () => {
    const list = [
      rel('v1.1.0-beta.1', true),
      rel('v1.0.2'),
      rel('v2.0.0', false, true),
      rel('v1.0.10'),
    ];
    expect(pickRelease(list, false)?.tag_name).toBe('v1.0.10');
    expect(pickRelease(list, true)?.tag_name).toBe('v1.1.0-beta.1');
    expect(pickRelease([], true)).toBeNull();
  });
});

describe('markdown', () => {
  it('rend titres, listes, gras, liens et échappe le HTML', () => {
    const html = renderMarkdown(
      '## Nouveautés\n- **Koïs** plus vifs\n- voir [notes](https://example.com)\n<script>alert(1)</script>',
    );
    expect(html).toContain('<h4>Nouveautés</h4>');
    expect(html).toContain('<li><strong>Koïs</strong> plus vifs</li>');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuse les liens javascript:', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href');
  });
});
