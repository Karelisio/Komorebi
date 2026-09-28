export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityProfile {
  /** Résolution maximale du rendu (plafonne le devicePixelRatio). */
  maxResolution: number;
  /** Largeur de la grille d'ondes. */
  rippleGrid: number;
  /** Résolution de la texture des koïs. */
  koiResolution: number;
  /** Niveau de détail des shaders (0, 1, 2). */
  level: number;
  skyOctaves: number;
  rays: boolean;
  /** Multiplicateur du nombre de particules. */
  particles: number;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: {
    maxResolution: 1,
    rippleGrid: 64,
    koiResolution: 0.5,
    level: 0,
    skyOctaves: 2,
    rays: true,
    particles: 0.4,
  },
  medium: {
    maxResolution: 1.5,
    rippleGrid: 96,
    koiResolution: 0.75,
    level: 1,
    skyOctaves: 3,
    rays: true,
    particles: 0.7,
  },
  high: {
    maxResolution: 2,
    rippleGrid: 128,
    koiResolution: 1,
    level: 2,
    skyOctaves: 4,
    rays: true,
    particles: 1,
  },
};

/** Qualité par défaut selon l'appareil (heuristique simple). */
export function defaultQuality(): QualityLevel {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const mem =
    typeof navigator !== 'undefined'
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4)
      : 4;
  if (cores <= 4 || mem <= 3) return 'low';
  if (cores >= 8 && mem >= 6) return 'high';
  return 'medium';
}
