import { clamp, dayDistance, dayOfYear, smoothstep } from './math';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonState {
  season: Season;
  /** Jour de l'année ramené à l'hémisphère nord (0..364). */
  day: number;
  /** Intensité de floraison des cerisiers 0..1 (pic début avril). */
  sakura: number;
  /** Coloration automnale 0..1 (pic fin octobre). */
  autumn: number;
  /** Chute des feuilles 0..1. */
  leafFall: number;
  /** Feuillage présent sur les caducs 0..1. */
  foliage: number;
  /** Propension à la neige 0..1 (utilisé par la météo simulée). */
  winter: number;
  /** Floraisons générales (iris, azalées, lotus…) 0..1. */
  blossom: number;
  /** Saison des lucioles 0..1 (juin-juillet). */
  fireflies: number;
}

// Repères (jour de l'année, hémisphère nord).
const MAR_20 = 79;
const JUN_21 = 172;
const SEP_22 = 265;
const DEC_21 = 355;

export function seasonOf(day: number): Season {
  if (day >= MAR_20 && day < JUN_21) return 'spring';
  if (day >= JUN_21 && day < SEP_22) return 'summer';
  if (day >= SEP_22 && day < DEC_21) return 'autumn';
  return 'winter';
}

function bump(day: number, peak: number, width: number): number {
  return clamp(1 - dayDistance(day, peak) / width);
}

export function computeSeason(date: Date, lat: number): SeasonState {
  let day = dayOfYear(date);
  if (lat < 0) day = (day + 182) % 365;
  const foliage = smoothstep(85, 115, day) * (1 - smoothstep(300, 335, day));
  return {
    season: seasonOf(day),
    day,
    sakura: smoothstep(0, 0.6, bump(day, 95, 16)),
    autumn: smoothstep(0, 0.7, bump(day, 298, 36)),
    leafFall: smoothstep(0, 0.8, bump(day, 312, 26)),
    foliage,
    winter: smoothstep(0, 0.75, bump(day, 20, 70)),
    blossom: smoothstep(0, 0.7, bump(day, 140, 55)),
    fireflies: smoothstep(0, 0.6, bump(day, 185, 28)),
  };
}
