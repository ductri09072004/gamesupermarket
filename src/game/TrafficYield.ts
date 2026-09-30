import { YIELD } from '../config/traffic';

export interface YieldCar {
  kind: string;
  knock: unknown;
  blockedNow: boolean;
  blockedT: number;
  yieldLeft: number;
  off: number;
}

/**
 * Gỡ kẹt: xe (ô tô, buýt) bị chặn đứng quá YIELD.afterS giây thì tự nhích lên lề phải nhường / vượt qua vật cản, giữ độ lệch
 * YIELD.holdM mét rồi mới nhập lại làn. Xe máy đã đi sát lề nên không cần; xe đang bị văng thì bỏ qua.
 */
export function yieldStep(c: YieldCar, dt: number, step: number): void {
  if (c.kind === 'moto' || c.knock) return;
  c.blockedT = c.blockedNow ? c.blockedT + dt : Math.max(0, c.blockedT - dt * 2);
  if (c.blockedT > YIELD.afterS && c.yieldLeft <= 0) c.yieldLeft = YIELD.holdM;
  const hold = c.yieldLeft > 0;
  if (hold) c.yieldLeft -= step;
  const want = hold ? YIELD.offset[c.kind === 'bus' ? 'bus' : 'car'] : 0;
  c.off += Math.max(-YIELD.speed * dt, Math.min(YIELD.speed * dt, want - c.off));
}
