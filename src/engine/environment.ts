import { natureActivity } from '@/world/events';
import type { GeoLocation } from '@/world/location';
import { computeSeason } from '@/world/season';
import { computeLighting, computeSky } from '@/world/sky';
import type { WeatherState } from '@/world/weatherTypes';
import type { SceneEnv } from '@/render/Scene';

export function computeEnv(
  date: Date,
  location: GeoLocation,
  weather: WeatherState,
  seasonDate?: Date,
): SceneEnv {
  const sky = computeSky(date, location.lat, location.lon);
  const lighting = computeLighting(sky);
  const season = computeSeason(seasonDate ?? date, location.lat);
  const nature = natureActivity(date, sky, season, {
    rain: weather.rain,
    hoursSinceRain: weather.hoursSinceRain,
    temperature: weather.temperature,
    cloudCover: weather.cloudCover,
  });
  return { sky, lighting, season, weather, nature };
}
