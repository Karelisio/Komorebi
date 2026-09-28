import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { APP_CONFIG } from '@/config/app';

export interface GeoLocation {
  lat: number;
  lon: number;
  source: 'device' | 'fallback';
}

const KEY = 'komorebi.location';

/** Arrondi à ~10 km : la position n'est utile que pour le soleil et la météo. */
const coarse = (v: number): number => Math.round(v * 10) / 10;

export const FALLBACK_LOCATION: GeoLocation = {
  lat: APP_CONFIG.fallbackLocation.lat,
  lon: APP_CONFIG.fallbackLocation.lon,
  source: 'fallback',
};

export async function loadStoredLocation(): Promise<{ location: GeoLocation; asked: boolean }> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      const parsed = JSON.parse(value) as GeoLocation & { asked?: boolean };
      if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
        return {
          location: { lat: parsed.lat, lon: parsed.lon, source: parsed.source },
          asked: true,
        };
      }
    }
  } catch {
    /* valeur corrompue : on repart du repli */
  }
  return { location: FALLBACK_LOCATION, asked: false };
}

/** Demande (une seule fois) une position approximative ; repli sur Grenoble. */
export async function requestLocation(): Promise<GeoLocation> {
  let location = FALLBACK_LOCATION;
  try {
    const perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
    if (perm.coarseLocation === 'granted' || perm.location === 'granted') {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 24 * 3600_000,
      });
      location = {
        lat: coarse(pos.coords.latitude),
        lon: coarse(pos.coords.longitude),
        source: 'device',
      };
    }
  } catch {
    /* refus ou indisponible : repli */
  }
  await Preferences.set({ key: KEY, value: JSON.stringify(location) }).catch(() => undefined);
  return location;
}

export async function setManualLocation(location: GeoLocation): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(location) });
}
