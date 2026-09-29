import { VEHICLE_DRAG, type VehicleDef } from '../config/vehicles';
import { WEATHER } from '../config/weather';

export interface DriveState {
  x: number;
  z: number;
  /** Hướng xe; mặt trước xe là -Z khi yaw = 0 (cùng quy ước nội thất). */
  yaw: number;
  speed: number;
  steer: number;
}

export interface DriveInput {
  /** 1 = ga (W), -1 = phanh/lùi (S) */
  throttle: number;
  /** 1 = rẽ trái (A), -1 = rẽ phải (D) */
  steer: number;
  handbrake: boolean;
}

export function forward(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(target, v + delta) : Math.max(target, v - delta);
}

/** Mô hình xe đạp đơn giản (arcade): ga/phanh/lùi, lái giảm dần theo tốc độ. wet (0..1): đường ướt → phanh dài, lái kém nhạy. Cập nhật tại chỗ. */
export function stepDrive(s: DriveState, inp: DriveInput, def: VehicleDef, dt: number, wet = 0): void {
  const t = inp.throttle;
  const brake = def.brake * (1 - WEATHER.brake * wet);
  if (inp.handbrake) s.speed = approach(s.speed, 0, brake * 1.4 * dt);
  else if (t > 0) s.speed = s.speed < 0 ? approach(s.speed, 0, brake * dt) : approach(s.speed, def.maxSpeed, def.accel * t * dt);
  else if (t < 0) s.speed = s.speed > 0.2 ? approach(s.speed, 0, brake * dt) : approach(s.speed, -def.reverseSpeed, def.accel * 0.6 * dt);
  else s.speed = approach(s.speed, 0, VEHICLE_DRAG * dt);
  const k = Math.min(1, Math.abs(s.speed) / def.maxSpeed);
  const target = inp.steer * def.maxSteer * (1 - 0.55 * k) * (1 - 0.15 * wet);
  s.steer = approach(s.steer, target, 2.8 * dt);
  s.yaw += (s.speed * Math.tan(s.steer) / def.wheelbase) * dt;
  const f = forward(s.yaw);
  s.x += f.x * s.speed * dt;
  s.z += f.z * s.speed * dt;
}
