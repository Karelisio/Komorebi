/**
 * Configuration statique de l'application.
 * Modifier `github` pour pointer vers le dépôt qui publie les releases.
 */
export const APP_CONFIG = {
  appId: 'com.karelisio.komorebi',
  name: 'Komorebi',
  version: __APP_VERSION__,
  github: {
    owner: 'karelisio',
    repo: 'komorebi',
    /** Nom de l'asset APK attendu : komorebi-vX.Y.Z.apk */
    apkPattern: /^komorebi-v.+\.apk$/,
  },
  /** Position par défaut si la localisation est refusée : Grenoble. */
  fallbackLocation: { lat: 45.1885, lon: 5.7245, label: 'Grenoble' },
  weather: {
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    /** Durée de validité du cache météo. */
    cacheMs: 30 * 60 * 1000,
  },
  update: {
    checkIntervalMs: 24 * 60 * 60 * 1000,
  },
  save: {
    autosaveMs: 30 * 1000,
    /** Pas de simulation hors ligne. */
    offlineStepMs: 60 * 60 * 1000,
    /** Absence maximale simulée (au-delà, on plafonne). */
    offlineMaxMs: 30 * 24 * 60 * 60 * 1000,
  },
} as const;
