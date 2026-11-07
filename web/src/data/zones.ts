import type { ZoneDef } from '@/lib/types';
import { haversineKm, hexPolygon, pointInPolygon, type LatLng } from '@/lib/geo';
import raw from './zones.json';

/** 35 disaster-relevant cities / districts across India. */
export const ZONES: ZoneDef[] = raw as ZoneDef[];
/** Radius of each monitoring zone's hexagon (km). */
export const ZONE_RADIUS_KM = 25;
/** Map opens on the whole of India. */
export const CITY_CENTER: LatLng = [22.8, 80.5];
export const DEFAULT_ZOOM = 5;
/** Bounding box of India (used to sanity-check GPS). */
export const CITY_BOUNDS = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 98 };

export const ZONE_POLYGONS: Record<string, LatLng[]> = Object.fromEntries(
  ZONES.map((z) => [z.id, hexPolygon(z.lat, z.lng, ZONE_RADIUS_KM)]),
);

/** Which zone contains this point? Falls back to the nearest centre within 60 km. */
export function findZone(lat: number, lng: number): ZoneDef | null {
  const inside = ZONES.find((z) => pointInPolygon([lat, lng], ZONE_POLYGONS[z.id]));
  if (inside) return inside;
  let best: ZoneDef | null = null;
  let bestD = 60;
  for (const z of ZONES) {
    const d = haversineKm([lat, lng], [z.lat, z.lng]);
    if (d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}

/** Is this point inside India's bounding box? */
export function inCity(lat: number, lng: number) {
  const b = CITY_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
