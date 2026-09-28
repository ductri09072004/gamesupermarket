import { POTHOLE } from '../config/physics';
import type { VehicleDef } from '../config/vehicles';
import type { Rng } from '../core/Random';

/** Ổ gà (chỉ cần tâm & bán kính). */
export interface Hole {
  x: number;
  z: number;
  r: number;
}

/**
 * Tâm 4 bánh xe (xe máy: 2 bánh thẳng hàng). Hướng đầu xe = (-sin yaw, -cos yaw) theo quy ước game.
 */
export function wheelPoints(x: number, z: number, yaw: number, def: Pick<VehicleDef, 'id' | 'wheelbase' | 'size'>): Array<[number, number]> {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = -fz;
  const rz = fx;
  const half = def.wheelbase / 2;
  const track = def.id === 'moto' ? [0] : [-(def.size[0] / 2 - 0.2), def.size[0] / 2 - 0.2];
  const out: Array<[number, number]> = [];
  for (const a of [half, -half]) for (const t of track) out.push([x + fx * a + rx * t, z + fz * a + rz * t]);
  return out;
}

/** Chỉ số các ổ gà có ít nhất 1 bánh xe lọt vào. */
export function holesUnder(wheels: Array<[number, number]>, holes: Hole[]): number[] {
  const out: number[] = [];
  holes.forEach((h, i) => {
    const lim = h.r * POTHOLE.wheelInset;
    if (wheels.some(([x, z]) => (x - h.x) ** 2 + (z - h.z) ** 2 < lim * lim)) out.push(i);
  });
  return out;
}

/** Độ mạnh cú xóc 0..1: nhanh & ổ to thì mạnh. */
export function bumpStrength(speed: number, r: number): number {
  return Math.max(0, Math.min(1, (Math.abs(speed) / 12) * (0.5 + r / 0.6)));
}

/** Xác suất 1 thùng hàng văng khỏi xe khi xóc ổ gà. Đi chậm (dưới minSpeed) thì không rơi. */
export function dropChance(speed: number, r: number, vehicle: string): number {
  const v = Math.abs(speed);
  if (v < POTHOLE.minSpeed) return 0;
  const base = POTHOLE.dropBase[vehicle] ?? 0.2;
  return Math.min(POTHOLE.maxDrop, base * ((v - POTHOLE.minSpeed) / 8) * (r / 0.35));
}

/** Số món vỡ khi thùng rơi xuống đường (tối đa bằng số món còn trong thùng). */
export function brokenItems(speed: number, qty: number, rng: Rng): number {
  return Math.min(qty, Math.floor(rng() * (1 + Math.abs(speed) / 4)));
}
