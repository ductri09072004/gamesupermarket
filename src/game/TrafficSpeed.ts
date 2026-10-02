import { MOTO_DODGE, MOTO_TRAFFIC, BUS, TRAFFIC } from '../config/traffic';
import { poseAt } from '../world/CityRoutes';
import type { Car } from './Traffic';

/** Vận tốc mong muốn: giảm khi có vật cản phía trước cùng làn, sắp vào cua hoặc buýt sắp tới trạm. */
export function targetSpeed(c: Car, cars: Car[], obstacles: Array<{ x: number; z: number; lat: number }>, speedScale: number): number {
  let v = c.max * speedScale;
  const ahead = poseAt(c.route, c.d + TRAFFIC.lookAhead);
  if (ahead.dx * c.dx + ahead.dz * c.dz < 0.9) v = Math.min(v, c.kind === 'moto' ? MOTO_TRAFFIC.cornerSpeed : TRAFFIC.cornerSpeed);
  const check = (x: number, z: number, lat: number) => {
    const rx = x - c.x;
    const rz = z - c.z;
    const along = rx * c.dx + rz * c.dz;
    const side = Math.abs(rx * c.dz - rz * c.dx);
    if (along <= 0 || along > TRAFFIC.brakeDist || side > lat) return;
    v = Math.min(v, Math.max(0, (along - TRAFFIC.stopDist) / (TRAFFIC.brakeDist - TRAFFIC.stopDist)) * c.max);
  };
  // xe cùng chiều phía trước (bề ngang cần né theo cỡ 2 xe), hoặc xe đang nằm chắn đường sau va chạm
  if (c.kind !== 'moto' || c.noDodge) {
    for (const o of cars) {
      if (o === c) continue;
      if (o.knock) check(o.knock.body.x, o.knock.body.z, 2.2);
      else if (o.dx * c.dx + o.dz * c.dz > 0.3) check(o.x, o.z, (c.hw + o.hw) * 0.85);
    }
    for (const o of obstacles) check(o.x, o.z, o.lat);
  } else if (Math.abs(c.off) > 0.3) v *= MOTO_DODGE.slow;
  c.blockedNow = v < 0.4 && c.speed < 0.6 && !(c.stop && c.stop.state !== 'approach');
  const s = c.stop;
  if (s && s.state !== 'done') {
    const total = c.route.total;
    let dist = (((s.d - c.d) % total) + total) % total;
    if (dist > total / 2) dist = 0; // đã lố qua điểm dừng
    v = s.state === 'dwell' ? 0 : Math.min(v, Math.sqrt(2 * BUS.decel * Math.max(0, dist - 0.2)));
  }
  return v;
}
