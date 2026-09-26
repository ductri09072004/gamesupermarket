import * as THREE from 'three';
import { CAR_IMPACT } from '../config/physics';
import type { VehicleDef } from '../config/vehicles';
import { obbContact, resolveImpact, type CarBody } from '../systems/CarImpact';
import { forward, type DriveState } from '../systems/VehicleDrive';
import type { World } from './World';

const inertia = (m: number, w: number, l: number) => (m * (w * w + l * l)) / 12;

/**
 * Phản ứng va chạm của xe người chơi: nảy ra theo pháp tuyến, trượt ngang & xoay (tắt dần theo độ bám lốp),
 * xe NPC bị đâm văng theo xung lượng, tiếng va chạm + rung camera theo lực va.
 */
export class DriveImpact {
  private slipX = 0;
  private slipZ = 0;
  private spin = 0;
  private shake = 0;
  private cd = 0;

  constructor(private w: World) {}

  reset(): void {
    this.slipX = this.slipZ = this.spin = this.shake = 0;
  }

  private mass(def: VehicleDef): number {
    return CAR_IMPACT.mass[def.id];
  }

  private body(s: DriveState, def: VehicleDef): CarBody {
    const f = forward(s.yaw);
    return {
      x: s.x, z: s.z, yaw: s.yaw, vx: f.x * s.speed + this.slipX, vz: f.z * s.speed + this.slipZ,
      w: (s.speed * Math.tan(s.steer)) / def.wheelbase + this.spin, hw: def.size[0] / 2, hl: def.size[2] / 2, mass: this.mass(def),
    };
  }

  /** Đọc lại vận tốc sau va chạm → tốc độ dọc thân xe + trượt ngang + xoay thêm. */
  private apply(s: DriveState, def: VehicleDef, b: CarBody): void {
    const f = forward(s.yaw);
    s.x = b.x;
    s.z = b.z;
    s.speed = b.vx * f.x + b.vz * f.z;
    this.slipX = b.vx - f.x * s.speed;
    this.slipZ = b.vz - f.z * s.speed;
    this.spin = b.w - (s.speed * Math.tan(s.steer)) / def.wheelbase;
  }

  /** Mỗi bước con sau stepDrive: xe trượt / xoay theo quán tính rồi lốp bám lại. */
  integrate(s: DriveState, dt: number): void {
    s.x += this.slipX * dt;
    s.z += this.slipZ * dt;
    s.yaw += this.spin * dt;
    const g = Math.exp(-CAR_IMPACT.slipGrip * dt);
    this.slipX *= g;
    this.slipZ *= g;
    this.spin *= Math.exp(-CAR_IMPACT.spinDamping * dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.cd = Math.max(0, this.cd - dt);
  }

  /**
   * Đụng vật cố định (tường, nhà, cây, xe đỗ): (nx, nz) pháp tuyến đẩy xe ra, (cx, cz) điểm chạm trên thân xe.
   * Xung lượng với khối lượng vô hạn phía vật cản.
   */
  hitStatic(s: DriveState, def: VehicleDef, nx: number, nz: number, cx: number, cz: number): void {
    const b = this.body(s, def);
    const m = b.mass;
    const I = inertia(m, def.size[0], def.size[2]);
    const rx = cx - b.x, rz = cz - b.z;
    const vpx = b.vx + b.w * rz, vpz = b.vz - b.w * rx;
    const vn = vpx * nx + vpz * nz;
    if (vn >= 0) return;
    const rn = rz * nx - rx * nz;
    const jn = (-(1 + CAR_IMPACT.restitution) * vn) / (1 / m + (rn * rn) / I);
    // ma sát trượt dọc tường
    const tx = vpx - vn * nx, tz = vpz - vn * nz;
    const jx = nx * jn - tx * m * CAR_IMPACT.friction * 0.5;
    const jz = nz * jn - tz * m * CAR_IMPACT.friction * 0.5;
    b.vx += jx / m;
    b.vz += jz / m;
    b.w += (rz * jx - rx * jz) / I;
    this.apply(s, def, b);
    this.crash(-vn, cx, cz);
  }

  /** Va chạm với xe NPC (và xe đó văng ra). */
  hitTraffic(s: DriveState, def: VehicleDef): void {
    for (const t of this.w.life.traffic.bodies()) {
      const me = this.body(s, def);
      const c = obbContact(me, t.body);
      if (!c) continue;
      const speed = resolveImpact(me, t.body, c);
      t.commit();
      this.apply(s, def, me);
      this.crash(speed, c.px, c.pz);
    }
  }

  private crash(speed: number, x: number, z: number): void {
    if (speed < CAR_IMPACT.quietSpeed) return;
    this.shake = Math.min(1, Math.max(this.shake, speed / 14));
    if (this.cd > 0) return;
    this.cd = 0.35;
    this.w.s.bus.emit('sound', { name: speed > 6 ? 'crash' : 'thud', pos: { x, y: 0.7, z }, volume: Math.min(1.4, 0.4 + speed / 10), pitch: 0.85 + Math.random() * 0.2 });
  }

  /** Độ lệch camera do rung sau va chạm. */
  cameraShake(out: THREE.Vector3): THREE.Vector3 {
    const a = this.shake * this.shake * 0.35;
    return out.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  }
}
