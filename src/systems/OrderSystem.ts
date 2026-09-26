import { DELIVERY_MAX_MS, DELIVERY_MIN_MS, DELIVERY_STACK } from '../config/constants';
import { WHOLESALE_PRICE_FACTOR } from '../config/vehicles';
import { boxCost, getProduct } from '../config/products';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState, OrderData } from '../core/GameState';
import type { Rng } from '../core/Random';
import { round2 } from '../core/Random';
import type { GridPoint } from '../world/Footprint';
import type { EconomySystem } from './EconomySystem';
import type { InventorySystem } from './InventorySystem';

export type Cart = Record<string, number>; // productId → số thùng

export function cartTotal(cart: Cart): number {
  let t = 0;
  for (const [id, n] of Object.entries(cart)) t += boxCost(getProduct(id)) * n;
  return round2(t);
}

/** Giá mua sỉ tại kho (tự lấy hàng). */
export function wholesaleTotal(cart: Cart): number {
  return round2(cartTotal(cart) * WHOLESALE_PRICE_FACTOR);
}

export function cartBoxes(cart: Cart): number {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

/** Chọn điểm giao hàng (m) còn ít thùng nhất (tối đa DELIVERY_STACK thùng chồng / điểm). */
export function pickDeliveryTile(tiles: GridPoint[], counts: Map<string, number>): GridPoint {
  let best = tiles[0];
  let bestN = Infinity;
  for (const t of tiles) {
    const n = counts.get(`${t.gx.toFixed(2)},${t.gy.toFixed(2)}`) ?? 0;
    if (n < DELIVERY_STACK && n < bestN) {
      best = t;
      bestN = n;
    }
  }
  if (bestN === Infinity) {
    for (const t of tiles) {
      const n = counts.get(`${t.gx.toFixed(2)},${t.gy.toFixed(2)}`) ?? 0;
      if (n < bestN) { best = t; bestN = n; }
    }
  }
  return best;
}

export class OrderSystem {
  constructor(
    private state: GameState,
    private bus: EventBus<GameEvents>,
    private economy: EconomySystem,
    private inventory: InventorySystem,
    private rng: Rng,
    private deliveryTiles: () => GridPoint[],
    private crateTiles: () => GridPoint[] = () => [],
  ) {}

  /** Có đặt thì đơn tới hạn sẽ gọi hàm này (xe tải chạy tới rồi mới deliver); không đặt → giao ngay. */
  onDue: ((order: OrderData) => void) | null = null;

  /** Nội thất đã trả tiền → đơn giao hàng dạng thùng lắp đặt. */
  orderFurniture(type: string): OrderData {
    const order: OrderData = {
      id: this.state.newUid('o'), items: [], furniture: [type], total: 0,
      remainingMs: DELIVERY_MIN_MS + this.rng() * (DELIVERY_MAX_MS - DELIVERY_MIN_MS),
    };
    this.state.data.orders.push(order);
    this.bus.emit('order:placed', { orderId: order.id });
    return order;
  }

  placeOrder(cart: Cart): { ok: boolean; reason?: string; order?: OrderData } {
    const items = Object.entries(cart).filter(([, n]) => n > 0).map(([productId, boxes]) => ({ productId, boxes }));
    if (items.length === 0) return { ok: false, reason: 'Giỏ hàng trống' };
    for (const it of items) {
      if (!this.state.hasLicense(getProduct(it.productId).licenseId)) return { ok: false, reason: 'Chưa có giấy phép' };
    }
    const total = cartTotal(cart);
    if (!this.economy.spend(total, 'Đặt hàng')) return { ok: false, reason: 'Không đủ tiền' };
    this.state.data.stats.purchases = round2(this.state.data.stats.purchases + total);
    const order: OrderData = {
      id: this.state.newUid('o'),
      items,
      total,
      remainingMs: DELIVERY_MIN_MS + this.rng() * (DELIVERY_MAX_MS - DELIVERY_MIN_MS),
    };
    this.state.data.orders.push(order);
    this.bus.emit('order:placed', { orderId: order.id });
    return { ok: true, order };
  }

  /** Mua sỉ tại kho: trả tiền rẻ hơn, thùng xuất hiện ngay ở bãi lấy hàng của kho (pad). */
  buyWholesale(cart: Cart, pad: GridPoint[]): { ok: boolean; reason?: string; uids?: string[] } {
    const items = Object.entries(cart).filter(([, n]) => n > 0);
    if (items.length === 0) return { ok: false, reason: 'Giỏ hàng trống' };
    for (const [id] of items) if (!this.state.hasLicense(getProduct(id).licenseId)) return { ok: false, reason: 'Chưa có giấy phép' };
    const total = wholesaleTotal(cart);
    if (!this.economy.spend(total, 'Mua hàng sỉ')) return { ok: false, reason: 'Không đủ tiền' };
    this.state.data.stats.purchases = round2(this.state.data.stats.purchases + total);
    const counts = new Map<string, number>();
    const uids: string[] = [];
    for (const [id, n] of items) {
      const p = getProduct(id);
      for (let i = 0; i < n; i++) {
        const t = pickDeliveryTile(pad, counts);
        const k = `${t.gx.toFixed(2)},${t.gy.toFixed(2)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
        uids.push(this.inventory.createBox(p.id, p.unitsPerBox, t.gx, t.gy).uid);
      }
    }
    this.bus.emit('order:arrived', { orderId: 'wholesale', boxUids: uids });
    this.bus.emit('boxes:changed', {});
    return { ok: true, uids };
  }

  /** dtMs: thời gian thực (không nhân tốc độ). */
  update(dtMs: number): void {
    const d = this.state.data;
    if (d.orders.length === 0) return;
    const due: OrderData[] = [];
    for (const o of d.orders) {
      if (o.dispatched) continue;
      o.remainingMs -= dtMs;
      if (o.remainingMs <= 0) due.push(o);
    }
    for (const o of due) {
      if (this.onDue) {
        o.dispatched = true;
        this.onDue(o);
      } else this.deliver(o);
    }
  }

  /** Thùng xuất hiện ở ô giao hàng (from: điểm bay ra — đuôi xe tải). */
  deliver(order: OrderData, from?: { x: number; y: number; z: number }): string[] {
    const d = this.state.data;
    d.orders = d.orders.filter((o) => o !== order);
    const tiles = this.deliveryTiles();
    const counts = new Map<string, number>();
    for (const b of d.boxes) {
      if (b.location !== 'floor') continue;
      const k = `${b.gx.toFixed(2)},${b.gy.toFixed(2)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const uids: string[] = [];
    for (const it of order.items) {
      const p = getProduct(it.productId);
      for (let i = 0; i < it.boxes; i++) {
        const t = pickDeliveryTile(tiles, counts);
        const k = `${t.gx.toFixed(2)},${t.gy.toFixed(2)}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
        uids.push(this.inventory.createBox(p.id, p.unitsPerBox, t.gx, t.gy).uid);
      }
    }
    for (const type of order.furniture ?? []) {
      const t = pickCrateTile(this.crateTiles(), d.crates);
      d.crates.push({ uid: this.state.newUid('k'), type, x: t.gx, z: t.gy });
    }
    if (order.furniture?.length) this.bus.emit('crates:changed', {});
    this.bus.emit('order:arrived', { orderId: order.id, boxUids: uids, from });
    this.bus.emit('boxes:changed', {});
    const n = uids.length + (order.furniture?.length ?? 0);
    this.bus.emit('toast', { message: `📦 Hàng đã giao (${n} thùng) — ra vỉa hè nhận hàng!`, kind: 'success' });
    return uids;
  }
}

/** Ô đặt thùng nội thất: ô đầu tiên chưa có thùng (thùng to, không chồng); hết chỗ thì đặt ô cuối. */
export function pickCrateTile(tiles: GridPoint[], crates: Array<{ x: number; z: number; held?: boolean }>): GridPoint {
  const free = tiles.find((t) => !crates.some((c) => !c.held && Math.abs(c.x - t.gx) < 0.7 && Math.abs(c.z - t.gy) < 0.7));
  return free ?? tiles[tiles.length - 1] ?? { gx: 0, gy: 0 };
}
