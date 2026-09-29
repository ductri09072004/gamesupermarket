import { BUS, RUSH_HOURS, TRAFFIC_DENSITY } from '../config/traffic';
import type { Rng } from '../core/Random';

/** Mật độ xe theo giờ: cao điểm sáng/chiều xe máy đông nghẹt, khuya vắng. */
export function trafficDensity(hour: number, kind: 'car' | 'moto' = 'car'): number {
  if (RUSH_HOURS.some(([a, b]) => hour >= a && hour < b)) return TRAFFIC_DENSITY.rush[kind];
  if (hour >= 22 || hour < 5) return TRAFFIC_DENSITY.night;
  if (hour < 7) return TRAFFIC_DENSITY.earlyMorning;
  return 1;
}

/** Giờ các chuyến buýt đến trạm trong ngày. */
export function busTimes(): number[] {
  const out: number[] = [];
  for (let t = BUS.firstHour; t <= BUS.lastHour + 1e-6; t += BUS.everyH) out.push(t);
  return out;
}

/** Có chuyến buýt nào đến trong (prev, now]? Trả về giờ chuyến đó (null nếu không). Sang ngày mới (now < prev) thì bắt đầu lại. */
export function busDue(prev: number, now: number): number | null {
  if (now < prev) return null;
  return busTimes().find((t) => t > prev && t <= now) ?? null;
}

/** Số hành khách xuống trạm chuyến này: giờ cao điểm đông hơn. */
export function busPassengers(hour: number, rng: Rng): number {
  const rush = RUSH_HOURS.some(([a, b]) => hour >= a && hour < b) ? BUS.rushExtra : 0;
  return BUS.passengers[0] + Math.floor(rng() * (BUS.passengers[1] - BUS.passengers[0] + 1)) + rush;
}

/** Xe máy mặc áo mưa khi trời mưa (xác suất theo cường độ). */
export function wearsRaincoat(rain: number, roll: number): boolean {
  return rain >= 0.2 && roll < Math.min(0.95, 0.45 + rain * 0.6);
}
