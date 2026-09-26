import { getVehicle } from '../config/vehicles';
import { forward } from '../systems/VehicleDrive';
import type { Pusher } from './BoxPhysics';
import type { World } from './World';

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
