import { RUSH_HOURS } from '../config/traffic';
import type { SoundName } from '../core/EventBus';
import type { StallArea } from '../world/CityStreetLife';

type Emit = (e: { name: SoundName; pos?: { x: number; y: number; z: number }; pitch?: number; volume?: number }) => void;

/** Giờ cao điểm: còi xe dày hơn */
const RUSH = RUSH_HOURS;

/**
 * Âm thanh phố: còi xe máy "tít tít" từ xe đang chạy gần người nghe (giờ cao điểm dày hơn),
 * tiếng rao từ sạp hàng rong đang bày bán trong bán kính nghe được.
 */
export class StreetSounds {
  private hornT = 3;
  private callT = 5;

  update(dt: number, hour: number, ear: { x: number; z: number }, cars: Array<{ x: number; z: number }>, stalls: StallArea[], emit: Emit): void {
    const rush = RUSH.some(([a, b]) => hour >= a && hour < b);
    const night = hour >= 22 || hour < 6;
    this.hornT -= dt;
    if (this.hornT <= 0) {
      this.hornT = (rush ? 1.5 : night ? 12 : 4) * (0.5 + Math.random());
      const near = cars.filter((c) => Math.hypot(c.x - ear.x, c.z - ear.z) < 45);
      const c = near[Math.floor(Math.random() * near.length)];
      if (c) emit({ name: 'horn', pos: { x: c.x, y: 1, z: c.z }, pitch: 0.85 + Math.random() * 0.35, volume: 0.5 + Math.random() * 0.4 });
    }
    this.callT -= dt;
    if (this.callT <= 0) {
      this.callT = 9 + Math.random() * 14;
      const open = stalls.filter((s) => hour >= s.hours[0] && hour < s.hours[1]
        && Math.hypot((s.x0 + s.x1) / 2 - ear.x, (s.z0 + s.z1) / 2 - ear.z) < 35);
      const s = open[Math.floor(Math.random() * open.length)];
      if (s) emit({ name: 'vendorCall', pos: { x: (s.x0 + s.x1) / 2, y: 1.5, z: (s.z0 + s.z1) / 2 }, pitch: 0.9 + Math.random() * 0.25, volume: 0.8 });
    }
  }
}
