import { getFurniture, type StorageType } from '../config/furniture';
import { getProduct } from '../config/products';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { BoxData, FurnitureData, GameState } from '../core/GameState';
import { acceptsProduct, slotCapacity } from './SlotLayout';

export type Result<T = number> = { ok: true; value: T } | { ok: false; reason: string };

export const STORAGE_NAMES: Record<StorageType, string> = {
  shelf: 'kệ thường',
  fridge: 'tủ lạnh',
  freezer: 'tủ đông',
  clothing: 'giá treo quần áo',
  electronics: 'tủ kính điện tử',
};

function acceptCheck(furnType: string, productId: string): Result | null {
  const def = getFurniture(furnType);
  if (def.kind !== 'display') return { ok: false, reason: 'Không thể xếp hàng lên đây' };
  const product = getProduct(productId);
  if (acceptsProduct(def, product)) return null;
  if (def.vending && (product.storage === 'shelf' || product.storage === 'fridge')) {
    return { ok: false, reason: `${product.name} không lọt ngăn máy bán hàng` };
  }
  return { ok: false, reason: `${product.name} phải đặt trong ${STORAGE_NAMES[product.storage]}` };
}

/** Tìm slot để xếp 1 món productId lên nội thất. */
export function findStockSlot(furn: FurnitureData, productId: string): Result {
  const bad = acceptCheck(furn.type, productId);
  if (bad) return bad;
  const cap = slotCapacity(furn.type, productId);
  const same = furn.slots.findIndex((s) => s.productId === productId && s.qty > 0 && s.qty < cap);
  if (same >= 0) return { ok: true, value: same };
  const labeled = furn.slots.findIndex((s) => s.qty === 0 && s.productId === productId);
  if (labeled >= 0) return { ok: true, value: labeled };
  const empty = furn.slots.findIndex((s) => s.qty === 0 && s.productId === null);
  if (empty >= 0) return { ok: true, value: empty };
  const anyEmpty = furn.slots.findIndex((s) => s.qty === 0);
  if (anyEmpty >= 0) return { ok: true, value: anyEmpty };
  if (furn.slots.some((s) => s.productId === productId)) return { ok: false, reason: 'Slot đã đầy' };
  return { ok: false, reason: 'Không còn slot trống cho sản phẩm này' };
}

/** Kiểm tra 1 slot cụ thể có nhận được sản phẩm không. */
export function canStockSlot(furn: FurnitureData, slot: number, productId: string): Result {
  const bad = acceptCheck(furn.type, productId);
  if (bad) return bad;
  const s = furn.slots[slot];
  if (!s) return { ok: false, reason: 'Slot không tồn tại' };
  if (s.qty > 0 && s.productId !== productId) return { ok: false, reason: 'Slot này đang bày sản phẩm khác' };
  if (s.qty >= slotCapacity(furn.type, productId)) return { ok: false, reason: 'Slot đã đầy' };
  return { ok: true, value: slot };
}

/** Xếp 1 món từ thùng lên kệ (slot chỉ định hoặc tự tìm). */
export function stockOne(box: BoxData, furn: FurnitureData, slot?: number): Result {
  if (!box.open) return { ok: false, reason: 'Thùng đang đóng — nhấn F để mở' };
  if (box.qty <= 0) return { ok: false, reason: 'Thùng đã hết hàng' };
  const r = slot === undefined ? findStockSlot(furn, box.productId) : canStockSlot(furn, slot, box.productId);
  if (!r.ok) return r;
  const target = furn.slots[r.value];
  target.productId = box.productId;
  target.qty += 1;
  box.qty -= 1;
  return r;
}

/** Lấy lại 1 món từ kệ vào thùng đang cầm (chuột phải). */
export function takeBackOne(box: BoxData, furn: FurnitureData, slotIndex?: number): Result {
  const def = getFurniture(furn.type);
  if (def.kind !== 'display') return { ok: false, reason: 'Không thể lấy hàng từ đây' };
  if (!box.open) return { ok: false, reason: 'Thùng đang đóng — nhấn F để mở' };
  const ok = (i: number) => furn.slots[i]?.qty > 0 && (furn.slots[i].productId === box.productId || box.qty === 0);
  let idx = slotIndex !== undefined ? (ok(slotIndex) ? slotIndex : -1) : furn.slots.findIndex((s) => s.productId === box.productId && s.qty > 0);
  if (idx < 0 && slotIndex === undefined && box.qty === 0) idx = furn.slots.findIndex((s) => s.qty > 0);
  if (idx < 0) return { ok: false, reason: 'Kệ không có sản phẩm phù hợp với thùng' };
  const slot = furn.slots[idx];
  const productId = slot.productId!;
  if (box.qty >= getProduct(productId).unitsPerBox && box.productId === productId) {
    return { ok: false, reason: 'Thùng đã đầy' };
  }
  box.productId = productId;
  box.qty += 1;
  slot.qty -= 1;
  return { ok: true, value: idx };
}

/** Khách lấy tối đa n món productId khỏi kệ. Trả về số món lấy được. */
export function takeFromShelf(furn: FurnitureData, productId: string, n: number): number {
  let taken = 0;
  for (const s of furn.slots) {
    if (s.productId !== productId) continue;
    const t = Math.min(s.qty, n - taken);
    s.qty -= t;
    taken += t;
    if (taken >= n) break;
  }
  return taken;
}

export function productQty(furn: FurnitureData, productId: string): number {
  return furn.slots.reduce((a, s) => a + (s.productId === productId ? s.qty : 0), 0);
}

export function findProductLocations(list: FurnitureData[], productId: string): FurnitureData[] {
  return list.filter((f) => productQty(f, productId) > 0);
}

export function stockedProductIds(list: FurnitureData[]): string[] {
  const s = new Set<string>();
  for (const f of list) for (const slot of f.slots) if (slot.productId && slot.qty > 0) s.add(slot.productId);
  return [...s];
}

export interface RestockTarget {
  furn: FurnitureData;
  slot: number;
  productId: string;
  fill: number;
}

export function restockTargets(list: FurnitureData[], threshold: number): RestockTarget[] {
  const out: RestockTarget[] = [];
  for (const f of list) {
    const def = getFurniture(f.type);
    if (def.kind !== 'display') continue;
    f.slots.forEach((s, i) => {
      if (!s.productId) return;
      const fill = s.qty / slotCapacity(f.type, s.productId);
      if (fill < threshold) out.push({ furn: f, slot: i, productId: s.productId, fill });
    });
  }
  return out.sort((a, b) => a.fill - b.fill);
}

export function isFurnitureEmpty(furn: FurnitureData): boolean {
  return furn.slots.every((s) => s.qty === 0) && furn.boxes.length === 0;
}

/**
 * Dọn hàng trên kệ vào thùng (khi bán kệ): gom theo sản phẩm, mỗi thùng tối đa unitsPerBox món.
 * Xoá hàng khỏi slot và trả về danh sách thùng cần tạo.
 */
export function packFurnitureContents(furn: FurnitureData): Array<{ productId: string; qty: number }> {
  const totals = new Map<string, number>();
  for (const s of furn.slots) {
    if (s.productId && s.qty > 0) totals.set(s.productId, (totals.get(s.productId) ?? 0) + s.qty);
    s.qty = 0;
    s.productId = null;
  }
  const out: Array<{ productId: string; qty: number }> = [];
  for (const [productId, total] of totals) {
    const per = getProduct(productId).unitsPerBox;
    for (let left = total; left > 0; left -= per) out.push({ productId, qty: Math.min(per, left) });
  }
  return out;
}

export function rackCanAdd(rack: FurnitureData): boolean {
  const def = getFurniture(rack.type);
  return def.kind === 'rack' && rack.boxes.length < def.slots;
}

export class InventorySystem {
  constructor(private state: GameState, private bus: EventBus<GameEvents>) {}

  createBox(productId: string, qty: number, gx: number, gy: number): BoxData {
    const box: BoxData = {
      uid: this.state.newUid('b'), productId, qty, open: false, gx, gy, location: 'floor', holderId: null,
    };
    this.state.data.boxes.push(box);
    return box;
  }

  removeBox(uid: string): void {
    const d = this.state.data;
    d.boxes = d.boxes.filter((b) => b.uid !== uid);
    for (const f of d.furniture) f.boxes = f.boxes.filter((b) => b !== uid);
    this.bus.emit('boxes:changed', {});
  }

  stock(box: BoxData, furn: FurnitureData, slot?: number): Result {
    const r = stockOne(box, furn, slot);
    if (r.ok) {
      this.bus.emit('inventory:changed', { furnitureUid: furn.uid });
      this.bus.emit('boxes:changed', {});
    }
    return r;
  }

  takeBack(box: BoxData, furn: FurnitureData, slot?: number): Result {
    const r = takeBackOne(box, furn, slot);
    if (r.ok) {
      this.bus.emit('inventory:changed', { furnitureUid: furn.uid });
      this.bus.emit('boxes:changed', {});
    }
    return r;
  }

  customerTake(furn: FurnitureData, productId: string, n: number): number {
    const t = takeFromShelf(furn, productId, n);
    if (t > 0) this.bus.emit('inventory:changed', { furnitureUid: furn.uid });
    return t;
  }

  putOnRack(box: BoxData, rack: FurnitureData): Result {
    if (!rackCanAdd(rack)) return { ok: false, reason: 'Kệ kho đã đầy' };
    rack.boxes.push(box.uid);
    box.location = 'rack';
    box.holderId = rack.uid;
    box.gx = rack.gx + 0.5;
    box.gy = rack.gy + 0.5;
    this.bus.emit('boxes:changed', {});
    this.bus.emit('inventory:changed', { furnitureUid: rack.uid });
    return { ok: true, value: rack.boxes.length - 1 };
  }

  takeFromRack(rack: FurnitureData, boxUid?: string): BoxData | null {
    const uid = boxUid ?? rack.boxes[rack.boxes.length - 1];
    if (!uid) return null;
    rack.boxes = rack.boxes.filter((b) => b !== uid);
    const box = this.state.box(uid) ?? null;
    this.bus.emit('inventory:changed', { furnitureUid: rack.uid });
    return box;
  }
}
