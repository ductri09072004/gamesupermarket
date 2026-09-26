import { getVehicle } from '../config/vehicles';
import { forward } from '../systems/VehicleDrive';
import type { Pusher } from './BoxPhysics';
import type { World } from './World';

/** Người chơi đi bộ như thân kinematic đẩy thùng: vận tốc lấy từ độ dời mỗi bước logic (60 Hz). */
export class WalkPusher {
  private last: { x: number; z: number } | null = null;

  next(p: { x: number; z: number }): Pusher {
    const l = this.last ?? p;
    this.last = { x: p.x, z: p.z };
    return { x: p.x, z: p.z, vx: (p.x - l.x) * 60, vz: (p.z - l.z) * 60 };
  }
}

/** Xe đang lái (hộp theo hướng) đẩy thùng; null khi không lái. */
export function drivePusher(w: World): Pusher | null {
  const uid = w.driving.uid;
  const v = uid ? w.s.vehicles.get(uid) : undefined;
  if (!v) return null;
  const st = w.driving.state;
  const def = getVehicle(v.type);
  const f = forward(st.yaw);
  return { x: st.x, z: st.z, vx: f.x * st.speed, vz: f.z * st.speed, car: { yaw: st.yaw, w: def.size[0], l: def.size[2], h: def.size[1] } };
}
