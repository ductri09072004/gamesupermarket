import { PLAYER_RADIUS } from '../config/constants';
import { MOTO_DODGE, MOTO_HIT } from '../config/traffic';
import { dodgeOffset, motoHits, type Threat } from '../systems/MotoDodge';

/** Phần của xe NPC mà logic xe máy cần đọc / ghi. */
export interface MotoCar {
  kind: string;
  knock: unknown;
  x: number;
  z: number;
  dx: number;
  dz: number;
  hw: number;
  hl: number;
  speed: number;
  /** Lệch ngang so với tim làn (m, dương = bên phải) — Traffic cộng vào vị trí thật */
  off: number;
  /** Không còn chỗ lách → phanh như xe thường */
  noDodge: boolean;
  /** Giây còn lại trước khi được bóp còi tiếp */
  hornT: number;
}

export interface MotoSteer {
  /** Vừa bắt đầu lách một vật cản gần → bóp còi */
  honk: boolean;
}

/**
 * Xe máy luồn lách: đánh lái sang bên còn chỗ để vượt người / ô tô / xe khác mà không giảm tốc,
 * hết vật cản thì từ từ trở về làn. Chỉ khi chặn kín cả hai bên (noDodge) mới phanh.
 */
export function steerMoto(c: MotoCar, threats: Threat[], dt: number): MotoSteer {
  c.hornT = Math.max(0, c.hornT - dt);
  const r = dodgeOffset(c, threats);
  c.noDodge = r.blocked;
  const step = (r.nearest < Infinity ? MOTO_DODGE.latSpeed : MOTO_DODGE.returnSpeed) * dt;
  c.off += Math.max(-step, Math.min(step, r.want - c.off));
  const honk = r.nearest < MOTO_DODGE.hornDist && c.speed > 2 && c.hornT <= 0;
  if (honk) c.hornT = MOTO_DODGE.hornCooldownS;
  return { honk };
}

/** Hướng + vận tốc văng của người bị xe máy tông (cùng chiều xe, hơi hất ra xa tim xe). */
export function launchVelocity(c: MotoCar, side: number): { vx: number; vz: number } {
  const dir = side >= 0 ? 1 : -1;
  const kx = c.dx + -c.dz * dir * MOTO_HIT.sideKick;
  const kz = c.dz + c.dx * dir * MOTO_HIT.sideKick;
  const len = Math.hypot(kx, kz) || 1;
  const v = MOTO_HIT.launch + MOTO_HIT.perSpeed * c.speed;
  return { vx: (kx / len) * v, vz: (kz / len) * v };
}

/** Tìm xe máy đang tông người chơi (đang chạy đủ nhanh); trả về xe và phía va chạm. */
export function findMotoHit<T extends MotoCar>(cars: T[], px: number, pz: number, r: number): { car: T; side: number } | null {
  for (const c of cars) {
    if (c.kind !== 'moto' || c.knock || c.speed < MOTO_HIT.minSpeed) continue;
    const h = motoHits(c, px, pz, r);
    if (h.hit) return { car: c, side: h.side };
  }
  return null;
}

/** Vị trí & kích thước của xe NPC bất kỳ (kể cả đang bị văng) để xe máy tính đường lách. */
export interface OtherCar extends MotoCar {
  knock: { body: { x: number; z: number } } | null;
}

/** Vật cản mà xe máy c phải lách: người / xe người chơi, xe khác (xe máy phía trước chạy cùng tốc độ thì không tính). */
export function motoThreats(c: MotoCar, cars: OtherCar[], obstacles: Array<{ x: number; z: number; lat: number }>): Threat[] {
  const t: Threat[] = obstacles.map((o) => ({ x: o.x, z: o.z, lat: o.lat * 0.6, hl: 0.4 }));
  for (const o of cars) {
    if (o === c) continue;
    if (o.knock) {
      t.push({ x: o.knock.body.x, z: o.knock.body.z, lat: 1.1, hl: 2 });
      continue;
    }
    if (o.kind === 'moto') {
      const along = (o.x - c.x) * c.dx + (o.z - c.z) * c.dz;
      if (along > 3.5 && o.speed > c.speed * 0.85) continue;
    }
    t.push({ x: o.x, z: o.z, lat: o.hw, hl: o.hl });
  }
  return t;
}

/** Xe máy lách không kịp → tông người chơi đi bộ: trả vận tốc văng + vị trí xe; xe va xong chậm lại. */
export function hitByMoto(cars: OtherCar[], px: number, pz: number): { vx: number; vz: number; speed: number; x: number; z: number } | null {
  const hit = findMotoHit(cars, px, pz, PLAYER_RADIUS);
  if (!hit) return null;
  const v = launchVelocity(hit.car, hit.side);
  const out = { ...v, speed: hit.car.speed, x: hit.car.x, z: hit.car.z };
  hit.car.speed *= MOTO_HIT.slow;
  return out;
}
