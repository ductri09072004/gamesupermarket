import * as THREE from 'three';
import { FLOOD } from '../config/weather';
import type { VehicleDef } from '../config/vehicles';
import type { DriveState } from '../systems/VehicleDrive';
import { wadeState } from '../systems/WeatherSystem';
import { onRoad } from '../world/CityRoutes';
import type { World } from './World';

/** Sau chết máy, được N giây nổ lại êm để thoát khỏi vũng nước trước khi chết tiếp */
const RESTART_GRACE_S = 5;

/**
 * Lái xe qua đường ngập: nước hơi sâu thì lết chậm & bắn nước, sâu hơn nữa thì xe chết máy
 * (xe máy chết máy sớm nhất) — đứng im vài giây rồi nổ lại được.
 */
export class WadeDrive {
  private stalled = 0;
  private grace = 0;
  private splashT = 0;

  constructor(private w: World) {}

  reset(): void {
    this.stalled = this.grace = this.splashT = 0;
  }

  /** Gọi sau mỗi bước lái (dt = giây thực của khung). */
  apply(s: DriveState, def: VehicleDef, dt: number): void {
    const w = this.w;
    const level = w.s.weather.flood;
    this.grace = Math.max(0, this.grace - dt);
    if (this.stalled > 0) {
      this.stalled -= dt;
      s.speed = Math.abs(s.speed) > 3 ? s.speed * Math.max(0, 1 - 7 * dt) : 0;
      if (this.stalled <= 0) {
        this.grace = RESTART_GRACE_S;
        w.toast('🔧 Nổ máy lại được rồi — chạy khỏi chỗ ngập đi', 'info');
      }
      return;
    }
    if (level <= 0.01 || !onRoad(w.city.layout.roads, s.x, s.z)) return;
    const state = wadeState(level, def.id);
    if (state === 'ok') return;
    const cap = def.maxSpeed * FLOOD.slowSpeed;
    if (Math.abs(s.speed) > cap) s.speed = Math.sign(s.speed) * Math.max(cap, Math.abs(s.speed) - 20 * dt);
    this.splashT -= dt;
    if (this.splashT <= 0 && Math.abs(s.speed) > 1.5) {
      this.splashT = 0.45;
      w.sound('splash', new THREE.Vector3(s.x, 0.1, s.z), 0.8 + Math.random() * 0.4, 0.7);
    }
    if (state === 'stall' && this.grace <= 0 && Math.abs(s.speed) > 0.5) {
      this.stalled = FLOOD.stallS;
      w.toast(`💦 ${def.name} chết máy vì nước ngập!`, 'error');
    }
  }
}
