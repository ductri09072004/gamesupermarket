import { BULKY_BOX_VOLUME, getVehicle, type VehicleDef } from '../config/vehicles';
import { getProduct } from '../config/products';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { BoxData, GameState, VehicleData } from '../core/GameState';
import type { EconomySystem } from './EconomySystem';

/** Số suất chở của 1 thùng: thùng cồng kềnh (thể tích lớn) tính 2. */
export function boxLoadUnits(productId: string): number {
  const p = getProduct(productId);
  const [w, h, d] = p.size;
  return w * h * d * p.unitsPerBox >= BULKY_BOX_VOLUME ? 2 : 1;
}

function units(def: VehicleDef, productId: string): number {
  return def.countBySize ? boxLoadUnits(productId) : 1;
}

export function cargoUsed(v: VehicleData, boxes: BoxData[]): number {
  const def = getVehicle(v.type);
  let n = 0;
  for (const uid of v.cargo) {
    const b = boxes.find((x) => x.uid === uid);
    if (b) n += units(def, b.productId);
  }
  return n;
}

export function canLoad(v: VehicleData, boxes: BoxData[], productId: string): { ok: boolean; reason?: string } {
  const def = getVehicle(v.type);
  const need = units(def, productId);
  const used = cargoUsed(v, boxes);
  if (used + need > def.capacity) {
    return { ok: false, reason: `${def.name} đã đầy (${used}/${def.capacity}${def.countBySize ? ' suất' : ' thùng'})` };
  }
  return { ok: true };
}

/**
 * Xe của người chơi: mua, chất / dỡ thùng. Vị trí & lái xe do lớp 3D cập nhật trực tiếp vào VehicleData.
 */
export class VehicleSystem {
  constructor(private state: GameState, private bus: EventBus<GameEvents>, private economy: EconomySystem) {}

  get list(): VehicleData[] {
    return this.state.data.vehicles;
  }

  get(uid: string): VehicleData | undefined {
    return this.state.data.vehicles.find((v) => v.uid === uid);
  }

  owns(type: string): boolean {
    return this.list.some((v) => v.type === type);
  }

  buy(type: string, spot: { x: number; z: number; yaw: number }): { ok: boolean; reason?: string; vehicle?: VehicleData } {
    const def = getVehicle(type);
    if (this.owns(type)) return { ok: false, reason: 'Đã có xe này' };
    if (!this.state.levelAtLeast(def.levelRequired)) return { ok: false, reason: `Cần cấp ${def.levelRequired}` };
    if (!this.economy.spend(def.price, `Mua ${def.name}`)) return { ok: false, reason: 'Không đủ tiền' };
    const v: VehicleData = { uid: this.state.newUid('v'), type: def.id, x: spot.x, z: spot.z, yaw: spot.yaw, cargo: [] };
    this.state.data.vehicles.push(v);
    this.bus.emit('vehicles:changed', {});
    this.bus.emit('toast', { message: `${def.icon} Đã mua ${def.name}! Xe đang đỗ ở bãi cạnh cửa hàng.`, kind: 'success' });
    return { ok: true, vehicle: v };
  }

  /** Chất 1 thùng (đang cầm) lên xe. */
  load(vehicleUid: string, box: BoxData): { ok: boolean; reason?: string } {
    const v = this.get(vehicleUid);
    if (!v) return { ok: false, reason: 'Không tìm thấy xe' };
    const r = canLoad(v, this.state.data.boxes, box.productId);
    if (!r.ok) return r;
    v.cargo.push(box.uid);
    box.location = 'vehicle';
    box.holderId = v.uid;
    this.bus.emit('boxes:changed', {});
    this.bus.emit('vehicles:changed', {});
    return { ok: true };
  }

  /** Lấy thùng trên cùng xuống (trả về thùng để người chơi cầm). */
  unload(vehicleUid: string): BoxData | null {
    const v = this.get(vehicleUid);
    if (!v || v.cargo.length === 0) return null;
    const uid = v.cargo.pop()!;
    const box = this.state.data.boxes.find((b) => b.uid === uid) ?? null;
    this.bus.emit('boxes:changed', {});
    this.bus.emit('vehicles:changed', {});
    return box;
  }
}
