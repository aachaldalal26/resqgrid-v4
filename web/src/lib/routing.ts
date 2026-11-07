/**
 * Smart emergency routing: A* search over a fine grid covering the trip area.
 * The grid adapts to trip length (~220 m cells for city trips).
 * Every grid cell inherits the risk of the zone it lies in:
 *   Critical = blocked, High = 8x cost, Moderate = 1.5x, Low = 1x.
 * Result: the cheapest (safest-short) path that steers around danger.
 * The path is risk-aware but not snapped to roads; plug in OSRM/Google Directions
 * with these avoid-areas for turn-by-turn navigation in production.
 */
import { haversineKm, pointInPolygon, type LatLng } from './geo';
import type { Category, ZoneState } from './types';

export interface RouteResult {
  path: LatLng[];
  distanceKm: number;
  etaMin: number;
  avoided: string[];
  passesThrough: string[];
  forcedThroughDanger: boolean;
  startsInDanger: boolean;
}

const MULT: Record<Category, number> = { Low: 1, Moderate: 1.5, High: 8, Critical: Infinity };

class MinHeap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(item: [number, number]) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function safeRoute(from: LatLng, to: LatLng, zones: ZoneState[]): RouteResult | null {
  const span = Math.max(Math.abs(from[0] - to[0]), Math.abs(from[1] - to[1]));
  const step = Math.max(0.002, span / 250); // ~220 m, coarser for long trips
  const pad = Math.max(0.03, span * 0.25);
  const minLat = Math.min(from[0], to[0]) - pad;
  const maxLat = Math.max(from[0], to[0]) + pad;
  const minLng = Math.min(from[1], to[1]) - pad;
  const maxLng = Math.max(from[1], to[1]) + pad;
  const rows = Math.ceil((maxLat - minLat) / step) + 1;
  const cols = Math.ceil((maxLng - minLng) / step) + 1;
  const N = rows * cols;
  const pt = (i: number): LatLng => [minLat + Math.floor(i / cols) * step, minLng + (i % cols) * step];

  // Which zone each cell belongs to
  const zoneOf = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const p = pt(i);
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi];
      if (Math.abs(z.lat - p[0]) > 0.25 || Math.abs(z.lng - p[1]) > 0.28) continue;
      if (pointInPolygon(p, z.polygon)) {
        zoneOf[i] = zi;
        break;
      }
    }
  }
  const cellOf = (p: LatLng) => {
    const r = Math.min(rows - 1, Math.max(0, Math.round((p[0] - minLat) / step)));
    const c = Math.min(cols - 1, Math.max(0, Math.round((p[1] - minLng) / step)));
    return r * cols + c;
  };
  const start = cellOf(from);
  const goal = cellOf(to);
  const goalPt = pt(goal);

  // You can always walk OUT of the zone you start in (or INTO the one you must reach) - at a high cost.
  const escapeZones = new Set([zoneOf[start], zoneOf[goal]].filter((z) => z >= 0));

  const run = (criticalMult: number) => {
    const mult = (i: number) => {
      if (zoneOf[i] < 0) return 1;
      const m = MULT[zones[zoneOf[i]].risk.category];
      if (!Number.isFinite(m)) return escapeZones.has(zoneOf[i]) ? 12 : criticalMult;
      return m;
    };
    const g = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    g[start] = 0;
    const heap = new MinHeap();
    heap.push([haversineKm(pt(start), goalPt), start]);
    while (heap.size) {
      const [, cur] = heap.pop()!;
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      const r = Math.floor(cur / cols);
      const c = cur % cols;
      const cp = pt(cur);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const n = nr * cols + nc;
          if (closed[n]) continue;
          const m = mult(n);
          if (!Number.isFinite(m)) continue;
          const np = pt(n);
          const cost = g[cur] + haversineKm(cp, np) * m;
          if (cost < g[n]) {
            g[n] = cost;
            prev[n] = cur;
            heap.push([cost + haversineKm(np, goalPt), n]);
          }
        }
    }
    if (!Number.isFinite(g[goal])) return null;
    const cells: number[] = [];
    for (let c = goal; c !== -1; c = prev[c]) cells.push(c);
    return cells.reverse();
  };

  let cells = run(Infinity);
  let forced = false;
  if (!cells) {
    cells = run(40);
    forced = true;
  }
  if (!cells) return null;

  const path: LatLng[] = [from, ...cells.slice(1, -1).filter((_, i) => i % 2 === 0).map(pt), to];
  let distanceKm = 0;
  for (let i = 1; i < path.length; i++) distanceKm += haversineKm(path[i - 1], path[i]);

  const danger = (zi: number) => zi >= 0 && (zones[zi].risk.category === 'High' || zones[zi].risk.category === 'Critical');
  const through = new Set<string>();
  cells.forEach((c) => danger(zoneOf[c]) && !escapeZones.has(zoneOf[c]) && through.add(zones[zoneOf[c]].name));
  const straight = new Set<string>();
  for (let k = 0; k <= 60; k++) {
    const p: LatLng = [from[0] + ((to[0] - from[0]) * k) / 60, from[1] + ((to[1] - from[1]) * k) / 60];
    const zi = zoneOf[cellOf(p)];
    if (danger(zi) && !escapeZones.has(zi)) straight.add(zones[zi].name);
  }
  return {
    path,
    distanceKm: Math.round(distanceKm * 1.25 * 10) / 10, // x1.25 road-network factor
    etaMin: Math.max(1, Math.round(((distanceKm * 1.25) / 22) * 60)),
    avoided: [...straight].filter((n) => !through.has(n)),
    passesThrough: [...through],
    forcedThroughDanger: forced,
    startsInDanger: danger(zoneOf[start]),
  };
}
