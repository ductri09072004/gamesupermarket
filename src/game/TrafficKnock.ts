import { CAR_IMPACT } from '../config/physics';
import type { CarBody } from '../systems/CarImpact';
import { resolveCircle, type AABB } from '../world/Colliders';
import { poseAt, type Route } from '../world/CityRoutes';

/** Xe NPC bị đâm: trượt / xoay theo vật lý, đứng yên một lúc rồi từ từ nhập lại làn. */
export interface Knock {
  body: CarBody;
  still: number;
  back: { t: number; from: { x: number; z: number; yaw: number }; d: number } | null;
}

export interface KnockCar {
  route: Route;
  d: number;
  speed: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  knock: Knock | null;
}

/** yaw theo quy ước game (đầu xe = (-sin, -cos)) từ vector hướng. */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);

export function carBody(c: KnockCar, mass: number): CarBody {
  return { x: c.x, z: c.z, yaw: yawOf(c.dx, c.dz), vx: c.dx * c.speed, vz: c.dz * c.speed, w: 0, hw: 0.92, hl: 2.05, mass };
}

/** Quãng đường trên tuyến gần vị trí (x, z) nhất. */
function nearestD(r: Route, x: number, z: number): number {
  let best = 0;
  let bd = Infinity;
  for (let d = 0; d < r.total; d += 1) {
    const p = poseAt(r, d);
    const dd = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Chạy 1 bước cho xe đang bị văng; trả false khi đã về làn (xe chạy tiếp bình thường). */
export function stepKnock(c: KnockCar, dt: number, statics: AABB[]): boolean {
  const k = c.knock!;
  const b = k.body;
  if (k.back) {
    k.back.t = Math.min(1, k.back.t + dt / CAR_IMPACT.recoverS);
    const e = k.back.t * k.back.t * (3 - 2 * k.back.t);
    const p = poseAt(c.route, k.back.d);
    b.x = k.back.from.x + (p.x - k.back.from.x) * e;
    b.z = k.back.from.z + (p.z - k.back.from.z) * e;
    b.yaw = lerpAngle(k.back.from.yaw, yawOf(p.dx, p.dz), e);
    if (k.back.t < 1) return true;
    Object.assign(c, { d: k.back.d, speed: 0, knock: null }, p);
    return false;
  }
  // trượt: ma sát lốp hãm vận tốc tịnh tiến, quay tắt dần
  const v = Math.hypot(b.vx, b.vz);
  const nv = Math.max(0, v - CAR_IMPACT.knockedFriction * dt);
  if (v > 1e-4) { b.vx *= nv / v; b.vz *= nv / v; }
  b.w *= Math.exp(-CAR_IMPACT.spinDamping * dt);
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  b.yaw += b.w * dt;
  // không văng xuyên nhà / cây / cột đèn
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  for (const s of [-1, 1]) {
    const cx = b.x + fx * s * (b.hl - b.hw);
    const cz = b.z + fz * s * (b.hl - b.hw);
    const r = resolveCircle(cx, cz, b.hw, statics, 2);
    if (r.hit) {
      b.x += r.x - cx;
      b.z += r.z - cz;
      b.vx *= 0.3;
      b.vz *= 0.3;
    }
  }
  if (nv < 0.2 && Math.abs(b.w) < 0.15) k.still += dt;
  else k.still = 0;
  if (k.still > CAR_IMPACT.recoverAfterS) k.back = { t: 0, from: { x: b.x, z: b.z, yaw: b.yaw }, d: nearestD(c.route, b.x, b.z) + 3 };
  return true;
}
