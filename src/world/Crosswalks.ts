import type { Rect } from './CityLayout';
import { poseAt, type Route } from './CityRoutes';
import { signalColor, type TrafficSignal } from './TrafficSignals';

export interface Crosswalk {
  id: number;
  axis: 'x' | 'z';
  approach: number;
  offset: number;
  rect: Rect;
  from: { x: number; z: number };
  to: { x: number; z: number };
  length: number;
}

export function planCrosswalks(signals: TrafficSignal[], xs: number[], zs: number[], halves: number[], vHalf: number): Crosswalk[] {
  return signals.map((s, id) => {
    const X = xs.reduce((a, b) => Math.abs(a - s.x) < Math.abs(b - s.x) ? a : b);
    const j = zs.reduce((a, _, b) => Math.abs(zs[a] - s.z) < Math.abs(zs[b] - s.z) ? a : b, 0);
    const Z = zs[j];
    const half = s.axis === 'x' ? halves[j] : vHalf;
    const center = s.axis === 'x' ? X + Math.sign(s.x - X) * (vHalf + 2.8) : Z + Math.sign(s.z - Z) * (halves[j] + 2.8);
    const rect = s.axis === 'x' ? { x0: center - 1.2, x1: center + 1.2, z0: Z - half, z1: Z + half }
      : { x0: X - half, x1: X + half, z0: center - 1.2, z1: center + 1.2 };
    const from = s.axis === 'x' ? { x: center, z: Z - half - 0.9 } : { x: X - half - 0.9, z: center };
    const to = s.axis === 'x' ? { x: center, z: Z + half + 0.9 } : { x: X + half + 0.9, z: center };
    return { id, axis: s.axis, approach: s.axis === 'x' ? Math.sign(X - center) : Math.sign(Z - center), offset: s.offset, rect, from, to, length: 2 * (half + 0.9) };
  });
}

export interface CrossingStop { d: number; crosswalk: Crosswalk }

/** Tìm mép vạch trên tuyến bo góc thực, tính một lần khi dựng phố. */
export function routeCrossingStops(route: Route, crossings: Crosswalk[]): CrossingStop[] {
  const stops: CrossingStop[] = [];
  for (const crosswalk of crossings) {
    const r = crosswalk.rect;
    for (let d = 0; d < route.total; d += 0.1) {
      const p = poseAt(route, d);
      if (p.x < r.x0 || p.x > r.x1 || p.z < r.z0 || p.z > r.z1) continue;
      if ((crosswalk.axis === 'x' ? p.dx : p.dz) * crosswalk.approach < 0.5) continue;
      stops.push({ d, crosswalk });
      break;
    }
  }
  return stops;
}

/** Khoảng đường tới vạch dừng của tâm xe, chừa đầu xe và 0.6m trước zebra. */
export function redStopDistance(route: Route, d: number, halfLength: number, stops: CrossingStop[], time: number, occupied: Set<number>): number {
  let nearest = Infinity;
  for (const s of stops) {
    const c = s.crosswalk;
    if (signalColor(time, c.axis, c.offset) === 'green' && !occupied.has(c.id)) continue;
    const dist = ((s.d - halfLength - 0.6 - d) % route.total + route.total) % route.total;
    nearest = Math.min(nearest, dist);
  }
  return nearest;
}
