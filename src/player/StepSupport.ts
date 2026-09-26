import type { AABB } from '../world/Colliders';

/** Vật có thể đứng lên / va vào (thùng hàng trên sàn): hộp bao XZ + độ cao mặt trên (m). */
export interface Support {
  uid: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
}

/** Bậc cao nhất bước lên được mà không cần nhảy (≈ 1 thùng nằm dưới đất) */
export const STEP_UP = 0.36;

function overlaps(s: Support, x: number, z: number, r: number): boolean {
  const cx = Math.max(s.minX, Math.min(x, s.maxX));
  const cz = Math.max(s.minZ, Math.min(z, s.maxZ));
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
}

/** Độ cao mặt đỡ dưới chân: mặt trên cao nhất trong tầm bước (đứng hẳn lên mép cũng được tính). */
export function groundHeight(x: number, z: number, r: number, feet: number, supports: Support[]): number {
  let g = 0;
  for (const s of supports) if (s.top <= feet + STEP_UP && s.top > g && overlaps(s, x, z, r * 0.6)) g = s.top;
  return g;
}

/** Thùng cao hơn tầm bước → là vật cản chặn người chơi. */
export function blockers(feet: number, supports: Support[]): AABB[] {
  return supports.filter((s) => s.top > feet + STEP_UP).map((s) => ({ minX: s.minX, maxX: s.maxX, minZ: s.minZ, maxZ: s.maxZ, tag: `box:${s.uid}` }));
}

/** Thùng đang bị tì vào theo hướng đi (dx, dz đơn vị) — để đẩy nó. */
export function pushedBy(x: number, z: number, r: number, dx: number, dz: number, feet: number, supports: Support[]): string[] {
  const out: string[] = [];
  for (const s of supports) {
    if (s.top <= feet + STEP_UP || !overlaps(s, x, z, r + 0.05)) continue;
    const cx = (s.minX + s.maxX) / 2 - x;
    const cz = (s.minZ + s.maxZ) / 2 - z;
    if (cx * dx + cz * dz > 0) out.push(s.uid);
  }
  return out;
}
