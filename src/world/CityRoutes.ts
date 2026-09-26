import { ROAD_WIDTH } from '../config/city';
import type { Rect } from './CityLayout';

/** Tuyến khép kín (xe chạy / người đi bộ): polyline đã bo góc, kèm độ dài tích luỹ để tra vị trí theo quãng đường. */
export interface Route {
  pts: Array<{ x: number; z: number }>;
  /** cum[i] = quãng đường từ pts[0] tới pts[i] */
  cum: number[];
  total: number;
}

export interface RoutePose {
  x: number;
  z: number;
  /** Hướng đi (vector đơn vị) */
  dx: number;
  dz: number;
}

/** Làn xe: cách tim đường về bên phải (m) */
export const LANE_OFFSET = ROAD_WIDTH / 4;

function finish(pts: Array<{ x: number; z: number }>): Route {
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return { pts, cum, total: cum[pts.length] };
}

/** Đa giác khép kín → bo mỗi góc bằng cung bậc 2 bán kính r (tối đa nửa cạnh). */
export function roundedLoop(corners: Array<{ x: number; z: number }>, r: number, steps = 6): Route {
  const out: Array<{ x: number; z: number }> = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const p = corners[(i + n - 1) % n];
    const c = corners[i];
    const q = corners[(i + 1) % n];
    const la = Math.hypot(c.x - p.x, c.z - p.z);
    const lb = Math.hypot(q.x - c.x, q.z - c.z);
    const rr = Math.min(r, la / 2, lb / 2);
    const a = { x: c.x - ((c.x - p.x) / la) * rr, z: c.z - ((c.z - p.z) / la) * rr };
    const b = { x: c.x + ((q.x - c.x) / lb) * rr, z: c.z + ((q.z - c.z) / lb) * rr };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, z: u * u * a.z + 2 * u * t * c.z + t * t * b.z });
    }
  }
  return finish(out);
}

/** Vị trí + hướng tại quãng đường d (tự quay vòng). */
export function poseAt(r: Route, d: number): RoutePose {
  let t = d % r.total;
  if (t < 0) t += r.total;
  // tìm nhị phân đoạn chứa t
  let lo = 0;
  let hi = r.pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (r.cum[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = r.pts[lo];
  const b = r.pts[(lo + 1) % r.pts.length];
  const len = r.cum[lo + 1] - r.cum[lo] || 1;
  const k = (t - r.cum[lo]) / len;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
}

/** Rect → 4 góc theo chiều (x0,z0)→(x1,z0)→(x1,z1)→(x0,z1); đảo ngược nếu reverse. */
function corners(r: Rect, reverse: boolean) {
  const c = [{ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 }];
  return reverse ? c.reverse() : c;
}

/**
 * Vòng xe chạy quanh mỗi khối phố theo tim đường, lệch sang làn phải.
 * Mọi vòng cùng chiều → trên đường chung giữa 2 khối, xe 2 bên đi ngược chiều ở 2 làn khác nhau.
 */
export function carLoops(blocks: Rect[]): Route[] {
  const h = ROAD_WIDTH / 2;
  return blocks.map((b) => {
    // đi theo chiều (x0,z0)→(x1,z0)…: bên phải hướng đi là phía trong khối → thu vào LANE_OFFSET từ tim đường
    const center = { x0: b.x0 - h, x1: b.x1 + h, z0: b.z0 - h, z1: b.z1 + h };
    const lane = { x0: center.x0 + LANE_OFFSET, x1: center.x1 - LANE_OFFSET, z0: center.z0 + LANE_OFFSET, z1: center.z1 - LANE_OFFSET };
    return roundedLoop(corners(lane, false), 5);
  });
}

/** Vòng đi bộ trên vỉa hè quanh mỗi khối (cách mép đường `inset` m), 2 chiều lệch nhau 0.7m để khỏi đi xuyên nhau. */
export function walkLoops(blocks: Rect[], inset: number): Route[] {
  const out: Route[] = [];
  const ring = (b: Rect, k: number) => ({ x0: b.x0 + k, x1: b.x1 - k, z0: b.z0 + k, z1: b.z1 - k });
  for (const b of blocks) out.push(roundedLoop(corners(ring(b, inset), false), 1.2, 3), roundedLoop(corners(ring(b, inset + 0.7), true), 1.2, 3));
  return out;
}
