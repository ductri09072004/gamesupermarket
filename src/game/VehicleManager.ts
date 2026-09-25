import * as THREE from 'three';
import { getVehicle, type VehicleType } from '../config/vehicles';
import type { VehicleData } from '../core/GameState';
import type { Services } from '../core/Services';
import { BoxModel } from '../entities/Box';
import { buildVehicleModel, type VehicleModel } from '../entities/VehicleModels';
import type { DriveState } from '../systems/VehicleDrive';
import type { AABB } from '../world/Colliders';
import type { Spot } from '../world/CityLayout';

interface View {
  data: VehicleData;
  root: THREE.Group;
  model: VehicleModel;
  cargo: BoxModel[];
  cargoKey: string;
  dist: number;
}

/** Hộp thẳng trục bao quanh xe (xe xoay góc bất kỳ). */
export function vehicleAABB(v: { x: number; z: number; yaw: number }, type: string, pad = 0): AABB {
  const [w, , l] = getVehicle(type).size;
  const c = Math.abs(Math.cos(v.yaw));
  const s = Math.abs(Math.sin(v.yaw));
  const hx = (c * w + s * l) / 2 + pad;
  const hz = (s * w + c * l) / 2 + pad;
  return { minX: v.x - hx, maxX: v.x + hx, minZ: v.z - hz, maxZ: v.z + hz, tag: 'vehicle' };
}

/** Xe người chơi trong cảnh: model, thùng hàng trên xe, bánh quay / nghiêng khi lái. */
export class VehicleManager {
  readonly group = new THREE.Group();
  private views = new Map<string, View>();
  private dirty = true;
  private offs: Array<() => void> = [];

  constructor(private s: Services, private spots: () => Spot[]) {
    this.offs.push(
      s.bus.on('vehicles:changed', () => { this.dirty = true; }),
      s.bus.on('boxes:changed', () => { this.dirty = true; }),
    );
  }

  get(uid: string): View | undefined {
    return this.views.get(uid);
  }

  /** Chỗ đỗ trống đầu tiên trong bãi cạnh cửa hàng (3 chỗ dành cho xe người chơi). */
  freeSpot(ignore?: string): Spot {
    const spots = this.spots();
    const own = spots.slice(0, 3);
    for (const sp of own) {
      if (!this.s.data.vehicles.some((v) => v.uid !== ignore && Math.hypot(v.x - sp.x, v.z - sp.z) < 1.5)) return sp;
    }
    return own[0];
  }

  private sync(): void {
    const alive = new Set<string>();
    for (const v of this.s.data.vehicles) {
      alive.add(v.uid);
      let view = this.views.get(v.uid);
      if (!view) {
        const model = buildVehicleModel(v.type as VehicleType);
        const root = new THREE.Group();
        root.add(model.group);
        root.userData = { kind: 'vehicle', uid: v.uid };
        this.group.add(root);
        view = { data: v, root, model, cargo: [], cargoKey: '', dist: 0 };
        this.views.set(v.uid, view);
      }
      view.data = v;
      this.syncCargo(view);
    }
    for (const [uid, view] of this.views) {
      if (alive.has(uid)) continue;
      view.root.removeFromParent();
      view.cargo.forEach((b) => b.dispose());
      this.views.delete(uid);
    }
  }

  private syncCargo(view: View): void {
    const boxes = view.data.cargo.map((u) => this.s.state.box(u)).filter((b) => !!b);
    const key = boxes.map((b) => `${b.uid}:${b.qty}:${b.open}`).join('|');
    if (key === view.cargoKey) return;
    view.cargoKey = key;
    view.cargo.forEach((b) => b.dispose());
    view.cargo = [];
    const parent = view.model.lean ?? view.model.group;
    boxes.forEach((b, i) => {
      const slot = view.model.slots[i % view.model.slots.length];
      const m = new BoxModel(b.productId);
      m.setOpen(b.open);
      m.setContents(b.productId, b.qty);
      m.group.position.copy(slot);
      m.group.rotation.y = ((i % 3) - 1) * 0.04;
      parent.add(m.group);
      view.cargo.push(m);
    });
  }

  /** Cập nhật vị trí từ dữ liệu; xe đang lái nhận thêm tốc độ/góc lái để quay bánh & nghiêng. */
  update(dt: number, driving: { uid: string; state: DriveState } | null): void {
    if (this.dirty) {
      this.dirty = false;
      this.sync();
    }
    for (const view of this.views.values()) {
      const v = view.data;
      view.root.position.set(v.x, 0, v.z);
      view.root.rotation.y = v.yaw;
      const st = driving && driving.uid === v.uid ? driving.state : null;
      const speed = st?.speed ?? 0;
      view.dist += speed * dt;
      for (const w of view.model.wheels) w.rotation.x = -view.dist / view.model.wheelRadius;
      const lean = view.model.lean;
      if (lean) {
        const target = st ? -st.steer * Math.min(1, Math.abs(speed) / 8) * 0.35 : 0.12;
        lean.rotation.z += (target - lean.rotation.z) * Math.min(1, dt * 6);
      }
      for (const b of view.cargo) b.update(dt);
    }
  }

  setHeadlights(on: number): void {
    for (const view of this.views.values()) for (const m of view.model.headlights) m.emissiveIntensity = 0.2 + on * 2.5;
  }

  colliders(exclude?: string): AABB[] {
    return this.s.data.vehicles.filter((v) => v.uid !== exclude).map((v) => vehicleAABB(v, v.type));
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    for (const v of this.views.values()) v.cargo.forEach((b) => b.dispose());
    this.views.clear();
    this.group.removeFromParent();
  }
}
