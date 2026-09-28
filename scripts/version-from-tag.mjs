#!/usr/bin/env node
/**
 * Dérive VERSION_NAME et VERSION_CODE à partir d'un tag git (format vX.Y.Z[-pre]).
 *
 * Source du tag, dans l'ordre :
 *   1. la variable d'environnement GITHUB_REF_NAME (fournie par GitHub Actions
 *      sur un déclenchement `push: tags: v*.*.*`) ;
 *   2. à défaut, `git describe --tags --abbrev=0` sur le dépôt courant.
 *
 * VERSION_NAME : le tag sans le préfixe `v` (ex. "1.2.3" ou "2.0.0-beta.1").
 * VERSION_CODE : major*10000 + minor*100 + patch (le suffixe de pré-version
 *   n'est pas pris en compte pour le calcul, Android exige un entier).
 *
 * Écrit VERSION_NAME et VERSION_CODE sur stdout (une variable par ligne,
 * format `NOM=valeur`) et, si $GITHUB_ENV est défini, les y ajoute également
 * pour que les étapes suivantes du workflow puissent les lire comme env vars.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const TAG_RE = /^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

function tagFromGitDescribe() {
  try {
    return execSync('git describe --tags --abbrev=0', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function resolveTag(env = process.env) {
  const fromEnv = env.GITHUB_REF_NAME?.trim();
  if (fromEnv) return fromEnv;
  const fromGit = tagFromGitDescribe();
  if (fromGit) return fromGit;
  return null;
}

export function parseVersion(tag) {
  const m = TAG_RE.exec(tag ?? '');
  if (!m) {
    throw new Error(
      `Tag invalide : "${tag}". Format attendu : vX.Y.Z ou vX.Y.Z-pre (ex. v1.2.3, v2.0.0-beta.1).`,
    );
  }
  const [, majorS, minorS, patchS, pre] = m;
  const major = Number(majorS);
  const minor = Number(minorS);
  const patch = Number(patchS);
  const versionName = `${major}.${minor}.${patch}${pre ?? ''}`;
  const versionCode = major * 10000 + minor * 100 + patch;
  return { versionName, versionCode, major, minor, patch, pre: pre?.slice(1) ?? null };
}

function main() {
  const tag = resolveTag();
  if (!tag) {
    console.error(
      'Impossible de déterminer le tag : ni GITHUB_REF_NAME ni `git describe --tags --abbrev=0` ne renvoient de valeur.',
    );
    process.exitCode = 1;
    return;
  }

  let parsed;
  try {
    parsed = parseVersion(tag);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const { versionName, versionCode } = parsed;
  console.log(`VERSION_NAME=${versionName}`);
  console.log(`VERSION_CODE=${versionCode}`);

  const githubEnv = process.env.GITHUB_ENV;
  if (githubEnv) {
    appendFileSync(githubEnv, `VERSION_NAME=${versionName}\nVERSION_CODE=${versionCode}\n`);
  }
}

main();
