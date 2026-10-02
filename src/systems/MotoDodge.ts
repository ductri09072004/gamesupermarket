import { MOTO_DODGE } from '../config/traffic';

/** Thân xe máy theo toạ độ world; (dx, dz) là hướng đi đơn vị, off là độ lệch ngang hiện tại so với tim làn (m, dương = bên phải). */
export interface DodgeBody {
  x: number;
  z: number;
  dx: number;
  dz: number;
  off: number;
  hw: number;
}

/** Vật cản: tâm, nửa bề ngang cần chừa (lat), nửa chiều dài (hl). */
export interface Threat {
  x: number;
  z: number;
  lat: number;
  hl: number;
}

export interface DodgeResult {
  /** Độ lệch ngang mong muốn so với tim làn (0 = đi giữa làn) */
  want: number;
  /** Cả hai bên đều không còn chỗ lách → phải phanh */
  blocked: boolean;
  /** Khoảng cách tới vật cản gần nhất đang phải lách (Infinity nếu không có) */
  nearest: number;
}

/**
 * Chọn đường lách quanh các vật cản phía trước: vật nào chắn thân xe thì thử lách sang trái / phải (chọn bên cần lệch ít hơn,
 * trong phạm vi lòng đường một chiều); không bên nào lọt thì blocked. Không đổi trạng thái, dễ kiểm thử.
 */
export function dodgeOffset(c: DodgeBody, threats: Threat[], cfg = MOTO_DODGE): DodgeResult {
  const lo = -cfg.offLeft;
  const hi = cfg.offRight;
  const rel = threats
    .map((t) => {
      const rx = t.x - c.x;
      const rz = t.z - c.z;
      const along = rx * c.dx + rz * c.dz;
      // lệch ngang của vật cản so với tim làn (không tính độ lệch hiện tại của xe)
      const lane = rx * -c.dz + rz * c.dx + c.off;
      return { along, lane, need: c.hw + t.lat + cfg.margin, hl: t.hl };
    })
    .filter((t) => t.along > -(t.hl + 0.9) && t.along < cfg.look)
    .sort((a, b) => a.along - b.along);
  let want = 0;
  let nearest = Infinity;
  for (let pass = 0; pass < 2; pass++) {
    for (const t of rel) {
      if (Math.abs(t.lane - want) >= t.need) continue;
      const left = t.lane - t.need;
      const right = t.lane + t.need;
      const options = [left, right].filter((v) => v >= lo && v <= hi);
      if (options.length === 0) return { want, blocked: true, nearest: Math.max(0, t.along) };
      want = options.reduce((a, b) => (Math.abs(a - want) <= Math.abs(b - want) ? a : b));
      nearest = Math.min(nearest, Math.max(0, t.along));
    }
  }
  // sau khi xếp chỗ, còn vật cản nào vẫn chắn thì coi như kẹt
  if (rel.some((t) => Math.abs(t.lane - want) < t.need - 1e-6)) return { want, blocked: true, nearest };
  return { want, blocked: false, nearest };
}

export interface HitBody {
  x: number;
  z: number;
  dx: number;
  dz: number;
  hw: number;
  hl: number;
}

/** Xe máy (hình chữ nhật hw × hl) chạm người (hình tròn bán kính r)? side > 0: người ở bên phải tim xe. */
export function motoHits(c: HitBody, px: number, pz: number, r: number): { hit: boolean; side: number } {
  const rx = px - c.x;
  const rz = pz - c.z;
  const along = rx * c.dx + rz * c.dz;
  const side = rx * -c.dz + rz * c.dx;
  return { hit: Math.abs(along) < c.hl + r && Math.abs(side) < c.hw + r, side };
}
