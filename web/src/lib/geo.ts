// Small geometry helpers (no external GIS library needed).
export type LatLng = [number, number];

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Ray-casting point-in-polygon. Points are [lat, lng]. */
export function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect = yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Hexagonal zone boundary around a locality centroid.
 * Real ward boundaries can be dropped in later (GeoJSON) without changing the rest of the app.
 */
export function hexPolygon(lat: number, lng: number, radiusKm = 1.1): LatLng[] {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i + 30);
    return [round6(lat + dLat * Math.sin(a)), round6(lng + dLng * Math.cos(a))] as LatLng;
  });
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Round a coordinate to ~100 m for the public (privacy-safe) view. */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;
