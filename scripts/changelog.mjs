#!/usr/bin/env node
/**
 * Génère un changelog Markdown à partir des commits entre deux tags git,
 * regroupés par préfixe de commit conventionnel (feat / fix / autre), en français.
 *
 * Usage :
 *   node scripts/changelog.mjs [--from <tag>] [--to <tag>] [--out <fichier>]
 *
 * --to   : tag/réf de fin (défaut : $GITHUB_REF_NAME, sinon HEAD).
 * --from : tag de départ, exclu du range (défaut : le tag précédent --to,
 *          déterminé via `git describe`, sinon la racine du dépôt).
 * --out  : écrit le résultat dans un fichier au lieu de stdout.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--from') opts.from = argv[++i];
    else if (a === '--to') opts.to = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
  }
  return opts;
}

/** Détermine le tag précédent `ref` (par ordre de version), ou null. */
function previousTag(ref) {
  const byRef = trySh(`git describe --tags --abbrev=0 "${ref}^"`);
  if (byRef) return byRef;
  // `ref` n'est peut-être pas encore un tag existant (ex. tag tout juste poussé
  // mais checkout sur une autre réf) : on trie tous les tags par version et on
  // prend celui qui précède `ref` dans la liste.
  const all = trySh('git tag --sort=-v:refname');
  if (!all) return null;
  const tags = all.split('\n').filter(Boolean);
  const idx = tags.indexOf(ref);
  if (idx >= 0 && idx + 1 < tags.length) return tags[idx + 1];
  // ref absent de la liste (ex. tag pas encore créé localement) : on prend le
  // tag le plus récent comme point de départ.
  return tags[0] ?? null;
}

function commitSubjectPrefix(subject) {
  const m = /^(\w+)(\([^)]*\))?!?:\s*/.exec(subject);
  return m ? m[1].toLowerCase() : null;
}

const FR_HEADINGS = {
  feat: '✨ Nouveautés',
  fix: '🐛 Corrections',
  autre: '🔧 Autres changements',
};

export function buildChangelog({ from, to }) {
  const range = from ? `${from}..${to}` : to;
  const log = trySh(`git log ${range} --no-merges --pretty=format:%h%x1f%s`);
  const groups = { feat: [], fix: [], autre: [] };

  if (log) {
    for (const line of log.split('\n')) {
      if (!line) continue;
      const [hash, subject] = line.split('\x1f');
      const prefix = commitSubjectPrefix(subject);
      const bucket = prefix === 'feat' ? 'feat' : prefix === 'fix' ? 'fix' : 'autre';
      // Retire le préfixe conventionnel (`feat(x): `, `fix: `, …) du sujet affiché.
      const clean = subject.replace(/^(\w+)(\([^)]*\))?!?:\s*/, '');
      groups[bucket].push(`- ${clean} (${hash})`);
    }
  }

  const sections = [];
  for (const key of ['feat', 'fix', 'autre']) {
    if (groups[key].length > 0) {
      sections.push(`### ${FR_HEADINGS[key]}\n\n${groups[key].join('\n')}`);
    }
  }

  if (sections.length === 0) {
    return 'Aucun changement notable.';
  }
  return sections.join('\n\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const to = opts.to ?? process.env.GITHUB_REF_NAME ?? 'HEAD';
  const from = opts.from ?? previousTag(to) ?? undefined;

  const md = buildChangelog({ from, to });

  if (opts.out) {
    writeFileSync(opts.out, `${md}\n`, 'utf8');
  } else {
    console.log(md);
  }
}

main();
