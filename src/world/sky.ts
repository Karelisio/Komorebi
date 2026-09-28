import * as SunCalc from 'suncalc';
import { clamp, hexToRgb, invLerp, mixRgb, smoothstep, type RGB } from './math';

export type DayPhase =
  'night' | 'dawn' | 'morningGolden' | 'day' | 'eveningGolden' | 'dusk' | 'blueHour';

export interface SkyState {
  /** Altitude du soleil en degrés (négative sous l'horizon). */
  sunAltitude: number;
  /** Azimut du soleil, degrés depuis le nord, sens horaire. */
  sunAzimuth: number;
  moonAltitude: number;
  moonAzimuth: number;
  /** 0 nouvelle lune → 0.5 pleine lune → 1. */
  moonPhase: number;
  /** Fraction éclairée 0..1. */
  moonFraction: number;
  moonWaxing: boolean;
  /** Vrai le matin (avant midi solaire). */
  morning: boolean;
  phase: DayPhase;
  /** 0 = nuit noire, 1 = plein jour. */
  daylight: number;
  /** Visibilité des étoiles 0..1. */
  stars: number;
  /** Intensité de l'heure dorée 0..1. */
  golden: number;
  sunrise: Date | null;
  sunset: Date | null;
  /** Direction de regard de la scène (azimut). 180 = sud (hémisphère nord). */
  viewAzimuth: number;
}

export interface Lighting {
  skyTop: RGB;
  skyHorizon: RGB;
  ambient: RGB;
  sunColor: RGB;
  /** Force des rayons komorebi 0..1. */
  rays: number;
}

/** Détermine la phase de la journée à partir de l'altitude du soleil. */
export function phaseFromAltitude(altitude: number, morning: boolean): DayPhase {
  if (altitude < -12) return 'night';
  if (morning) {
    if (altitude < -2) return 'dawn';
    if (altitude < 8) return 'morningGolden';
    return 'day';
  }
  if (altitude >= 8) return 'day';
  if (altitude >= -2) return 'eveningGolden';
  if (altitude >= -8) return 'dusk';
  return 'blueHour';
}

export function computeSky(date: Date, lat: number, lon: number): SkyState {
  const sun = SunCalc.getPosition(date, lat, lon);
  const moon = SunCalc.getMoonPosition(date, lat, lon);
  const illum = SunCalc.getMoonIllumination(date);
  const times = SunCalc.getTimes(date, lat, lon);
  const morning = date.getTime() < times.solarNoon.getTime();
  const alt = sun.altitude;
  return {
    sunAltitude: alt,
    sunAzimuth: sun.azimuth,
    moonAltitude: moon.altitude,
    moonAzimuth: moon.azimuth,
    moonPhase: illum.phase,
    moonFraction: illum.fraction,
    moonWaxing: illum.waxing,
    morning,
    phase: phaseFromAltitude(alt, morning),
    daylight: smoothstep(-10, 10, alt),
    stars: 1 - smoothstep(-14, -4, alt),
    golden: alt > -4 && alt < 14 ? 1 - Math.abs(alt - 3) / 11 : 0,
    sunrise: times.sunrise,
    sunset: times.sunset,
    viewAzimuth: lat >= 0 ? 180 : 0,
  };
}

interface Key {
  alt: number;
  top: string;
  horizon: string;
  ambient: string;
  sun: string;
}

const MORNING: Key[] = [
  { alt: -18, top: '#0a1024', horizon: '#18214a', ambient: '#56689e', sun: '#000000' },
  { alt: -12, top: '#101a3c', horizon: '#2a3666', ambient: '#5c6ca6', sun: '#000000' },
  { alt: -6, top: '#1c2958', horizon: '#6a6f9c', ambient: '#7680b0', sun: '#553344' },
  { alt: -2, top: '#35467c', horizon: '#e0a3a8', ambient: '#a08aa6', sun: '#ff9c8a' },
  { alt: 2, top: '#6589bf', horizon: '#f7c9a0', ambient: '#e2b8a4', sun: '#ffc48e' },
  { alt: 8, top: '#78a4d6', horizon: '#f4dcb8', ambient: '#f4dcc4', sun: '#ffe0b0' },
  { alt: 20, top: '#6ca2dc', horizon: '#d2e6f2', ambient: '#fbf3e6', sun: '#fff2d6' },
  { alt: 50, top: '#5795d8', horizon: '#bddcf2', ambient: '#ffffff', sun: '#fffaf0' },
];

const EVENING: Key[] = [
  { alt: -18, top: '#0a1024', horizon: '#18214a', ambient: '#56689e', sun: '#000000' },
  { alt: -12, top: '#111a3e', horizon: '#2e3468', ambient: '#5e6aa8', sun: '#000000' },
  { alt: -6, top: '#1f2a5e', horizon: '#6e5c8c', ambient: '#7a78ac', sun: '#6a3050' },
  { alt: -2, top: '#3a3d74', horizon: '#f08c62', ambient: '#b48a96', sun: '#ff8050' },
  { alt: 2, top: '#6078b0', horizon: '#f8a868', ambient: '#eeb088', sun: '#ffa860' },
  { alt: 8, top: '#74a0d4', horizon: '#f6cf9a', ambient: '#f8d8b4', sun: '#ffd49a' },
  { alt: 20, top: '#6ca2dc', horizon: '#d2e6f2', ambient: '#fbf3e6', sun: '#fff2d6' },
  { alt: 50, top: '#5795d8', horizon: '#bddcf2', ambient: '#ffffff', sun: '#fffaf0' },
];

function sample(keys: Key[], alt: number): Omit<Lighting, 'rays'> {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (alt <= first.alt) return toLighting(first, first, 0);
  if (alt >= last.alt) return toLighting(last, last, 0);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (alt >= a.alt && alt <= b.alt) return toLighting(a, b, invLerp(a.alt, b.alt, alt));
  }
  return toLighting(last, last, 0);
}

function toLighting(a: Key, b: Key, t: number): Omit<Lighting, 'rays'> {
  return {
    skyTop: mixRgb(hexToRgb(a.top), hexToRgb(b.top), t),
    skyHorizon: mixRgb(hexToRgb(a.horizon), hexToRgb(b.horizon), t),
    ambient: mixRgb(hexToRgb(a.ambient), hexToRgb(b.ambient), t),
    sunColor: mixRgb(hexToRgb(a.sun), hexToRgb(b.sun), t),
  };
}

/** Palette lumineuse continue, interpolée selon l'altitude du soleil (et matin/soir). */
export function computeLighting(sky: SkyState): Lighting {
  const base = sample(sky.morning ? MORNING : EVENING, sky.sunAltitude);
  const alt = sky.sunAltitude;
  // Rayons : absents la nuit, maximaux quand le soleil est bas à moyen (lumière rasante).
  const rays = clamp(smoothstep(-1, 6, alt) * (1 - 0.45 * smoothstep(30, 60, alt)));
  return { ...base, rays };
}
