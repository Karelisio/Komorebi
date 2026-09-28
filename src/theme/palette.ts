/** Rôles de couleur de l'interface (inspirés de Material 3). */
export interface UiScheme {
  surface: string;
  surfaceStrong: string;
  onSurface: string;
  onSurfaceMuted: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  outline: string;
  scrim: string;
  /** Flou d'arrière-plan des panneaux (px). */
  blur: number;
  dark: boolean;
}

/** Palette « Naturel » : verre translucide, encre et washi. */
export const NATURAL: UiScheme = {
  surface: 'rgba(28, 38, 36, 0.52)',
  surfaceStrong: 'rgba(24, 32, 31, 0.86)',
  onSurface: '#f5efe3',
  onSurfaceMuted: 'rgba(245, 239, 227, 0.68)',
  primary: '#e9b872',
  onPrimary: '#2b2418',
  primaryContainer: 'rgba(157, 184, 160, 0.28)',
  onPrimaryContainer: '#f5efe3',
  outline: 'rgba(245, 239, 227, 0.18)',
  scrim: 'rgba(10, 14, 14, 0.35)',
  blur: 16,
  dark: true,
};

export const LIGHT: UiScheme = {
  surface: 'rgba(250, 247, 240, 0.8)',
  surfaceStrong: 'rgba(250, 247, 240, 0.97)',
  onSurface: '#1f2a28',
  onSurfaceMuted: 'rgba(31, 42, 40, 0.64)',
  primary: '#4f6f55',
  onPrimary: '#ffffff',
  primaryContainer: 'rgba(111, 143, 114, 0.18)',
  onPrimaryContainer: '#1f2a28',
  outline: 'rgba(31, 42, 40, 0.14)',
  scrim: 'rgba(10, 14, 14, 0.25)',
  blur: 14,
  dark: false,
};

export const DARK: UiScheme = {
  surface: 'rgba(18, 20, 22, 0.82)',
  surfaceStrong: 'rgba(18, 20, 22, 0.97)',
  onSurface: '#e8e6e1',
  onSurfaceMuted: 'rgba(232, 230, 225, 0.62)',
  primary: '#a8c8ac',
  onPrimary: '#10261a',
  primaryContainer: 'rgba(168, 200, 172, 0.18)',
  onPrimaryContainer: '#e8e6e1',
  outline: 'rgba(232, 230, 225, 0.14)',
  scrim: 'rgba(0, 0, 0, 0.4)',
  blur: 14,
  dark: true,
};

/** Tons Android (Monet) : accent1_0 … accent1_1000, etc. */
export type Tonal = Record<number, string>;
export interface DynamicPalette {
  accent1: Tonal;
  accent2: Tonal;
  accent3: Tonal;
  neutral1: Tonal;
  neutral2: Tonal;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const tone = (t: Tonal, k: number, fallback: string): string => t[k] ?? fallback;

/** Schéma Material You à partir des couleurs dynamiques du système. */
export function materialScheme(p: DynamicPalette, dark: boolean): UiScheme {
  const a1 = p.accent1;
  const n1 = p.neutral1;
  const n2 = p.neutral2;
  return dark
    ? {
        surface: hexA(tone(n1, 900, '#1c1b1f'), 0.9),
        surfaceStrong: hexA(tone(n1, 900, '#1c1b1f'), 0.98),
        onSurface: tone(n1, 100, '#e6e1e5'),
        onSurfaceMuted: tone(n2, 200, '#cac4d0'),
        primary: tone(a1, 200, '#d0bcff'),
        onPrimary: tone(a1, 800, '#381e72'),
        primaryContainer: tone(a1, 700, '#4f378b'),
        onPrimaryContainer: tone(a1, 100, '#eaddff'),
        outline: hexA(tone(n2, 400, '#938f99'), 0.4),
        scrim: 'rgba(0,0,0,0.4)',
        blur: 0,
        dark: true,
      }
    : {
        surface: hexA(tone(n1, 50, '#fffbfe'), 0.92),
        surfaceStrong: hexA(tone(n1, 50, '#fffbfe'), 0.99),
        onSurface: tone(n1, 900, '#1c1b1f'),
        onSurfaceMuted: tone(n2, 700, '#49454f'),
        primary: tone(a1, 600, '#6750a4'),
        onPrimary: tone(a1, 0, '#ffffff'),
        primaryContainer: tone(a1, 100, '#eaddff'),
        onPrimaryContainer: tone(a1, 900, '#21005d'),
        outline: hexA(tone(n2, 500, '#79747e'), 0.35),
        scrim: 'rgba(0,0,0,0.3)',
        blur: 0,
        dark: false,
      };
}

function hsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Palette tonale approximative dérivée d'une teinte (repli hors Android 12+). */
export function tonalFromHue(hue: number, chroma = 0.35): DynamicPalette {
  const tones = [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const make = (h: number, s: number): Tonal =>
    Object.fromEntries(tones.map((t) => [t, hsl(h, s, 1 - t / 1000)])) as Tonal;
  return {
    accent1: make(hue, chroma),
    accent2: make(hue, chroma * 0.4),
    accent3: make((hue + 60) % 360, chroma * 0.6),
    neutral1: make(hue, 0.04),
    neutral2: make(hue, 0.08),
  };
}
