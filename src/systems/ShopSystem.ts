import {
  EXPANSION_BASE_PRICE, EXPANSION_PRICE_GROWTH, EXPANSION_STEP, FURNITURE_SELL_REFUND, INITIAL_STORE_H,
  INITIAL_STORE_W, MAX_STORE_H, MAX_STORE_W, WAREHOUSE_LEVEL, WAREHOUSE_PRICE,
} from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getLicense } from '../config/licenses';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../core/GameState';
import type { EconomySystem } from './EconomySystem';
import type { OrderSystem } from './OrderSystem';

export interface ExpansionPack {
  index: number;
  axis: 'cols' | 'rows';
  price: number;
  levelRequired: number;
  sizeAfter: { w: number; h: number };
}

export function expansionPacks(): ExpansionPack[] {
  const packs: ExpansionPack[] = [];
  let w = INITIAL_STORE_W;
  let h = INITIAL_STORE_H;
  let i = 0;
  while (w < MAX_STORE_W || h < MAX_STORE_H) {
    const axis: 'cols' | 'rows' = (i % 2 === 0 && w < MAX_STORE_W) || h >= MAX_STORE_H ? 'cols' : 'rows';
    if (axis === 'cols') w += EXPANSION_STEP;
    else h += EXPANSION_STEP;
    packs.push({
      index: i,
      axis,
      price: Math.round(EXPANSION_BASE_PRICE * Math.pow(EXPANSION_PRICE_GROWTH, i) / 10) * 10,
      levelRequired: 2 + i,
      sizeAfter: { w, h },
    });
    i++;
  }
  return packs;
}

type R = { ok: boolean; reason?: string };

/** Giỏ nội thất: loại → số lượng */
export type FurnitureCart = Record<string, number>;

export class ShopSystem {
  readonly packs = expansionPacks();

  constructor(private state: GameState, private bus: EventBus<GameEvents>, private economy: EconomySystem, private orders?: Pick<OrderSystem, 'orderFurniture'>) {}

  licenseStatus(id: number): 'owned' | 'available' | 'locked-level' | 'locked-prev' {
    const d = this.state.data;
    if (d.licenses.includes(id)) return 'owned';
    const req = getLicense(id).requires;
    if (req !== null && !d.licenses.includes(req)) return 'locked-prev';
    if (!this.state.levelAtLeast(getLicense(id).levelRequired)) return 'locked-level';
    return 'available';
  }

  buyLicense(id: number): R {
    const st = this.licenseStatus(id);
    if (st === 'owned') return { ok: false, reason: 'Đã sở hữu' };
    if (st === 'locked-prev') return { ok: false, reason: 'Cần mua giấy phép trước đó' };
    if (st === 'locked-level') return { ok: false, reason: `Cần cấp ${getLicense(id).levelRequired}` };
    const l = getLicense(id);
    if (!this.economy.spend(l.price, `Giấy phép ${l.name}`)) return { ok: false, reason: 'Không đủ tiền' };
    this.state.data.licenses.push(id);
    this.bus.emit('license:bought', { id });
    this.bus.emit('toast', { message: `${l.icon} Đã mở khoá nhóm ${l.name}!`, kind: 'success' });
    return { ok: true };
  }

  canBuyFurniture(type: string): R {
    const def = getFurniture(type);
    if (!def.buyable) return { ok: false, reason: 'Không bán' };
    if (!this.state.hasLicense(def.licenseRequired)) return { ok: false, reason: 'Cần giấy phép' };
    if (def.warehouseOnly && !this.state.data.warehouseUnlocked) return { ok: false, reason: 'Cần mở kho' };
    if (!this.economy.canAfford(def.price)) return { ok: false, reason: 'Không đủ tiền' };
    return { ok: true };
  }

  /** Tổng tiền giỏ nội thất (loại → số lượng). */
  furnitureCartTotal(cart: FurnitureCart): number {
    let t = 0;
    for (const [type, n] of Object.entries(cart)) t += getFurniture(type).price * n;
    return Math.round(t * 100) / 100;
  }

  /** Mua cả giỏ nội thất: trả tiền một lần, xe tải chở các thùng tới trước cửa hàng. */
  buyFurnitureCart(cart: FurnitureCart): R {
    const items = Object.entries(cart).filter(([, n]) => n > 0);
    if (items.length === 0) return { ok: false, reason: 'Giỏ hàng trống' };
    for (const [type] of items) {
      const def = getFurniture(type);
      if (!def.buyable) return { ok: false, reason: 'Không bán' };
      if (!this.state.hasLicense(def.licenseRequired)) return { ok: false, reason: 'Cần giấy phép' };
      if (def.warehouseOnly && !this.state.data.warehouseUnlocked) return { ok: false, reason: 'Cần mở kho' };
    }
    const total = this.furnitureCartTotal(cart);
    if (!this.economy.spend(total, 'Mua nội thất')) return { ok: false, reason: 'Không đủ tiền' };
    const types = items.flatMap(([type, n]) => Array<string>(n).fill(type));
    // có hệ thống giao hàng → xe tải chở thùng tới; không thì vào kho nội thất như cũ
    if (this.orders) this.orders.orderFurniture(types);
    else this.state.data.furnitureStock.push(...types);
    this.bus.emit('furniture:changed', {});
    return { ok: true };
  }

  /** Mua 1 món (giỏ một phần tử). */
  buyFurniture(type: string): R {
    const c = this.canBuyFurniture(type);
    if (!c.ok) return c;
    return this.buyFurnitureCart({ [type]: 1 });
  }

  sellFurniture(type: string): number {
    const def = getFurniture(type);
    const refund = Math.round(def.price * FURNITURE_SELL_REFUND * 100) / 100;
    this.economy.addMoney(refund, `Bán lại ${def.name}`);
    return refund;
  }

  nextPack(): ExpansionPack | null {
    return this.packs[this.state.data.expansions] ?? null;
  }

  buyExpansion(): R {
    const p = this.nextPack();
    if (!p) return { ok: false, reason: 'Đã mở rộng tối đa' };
    if (!this.state.levelAtLeast(p.levelRequired)) return { ok: false, reason: `Cần cấp ${p.levelRequired}` };
    if (!this.economy.spend(p.price, 'Mở rộng cửa hàng')) return { ok: false, reason: 'Không đủ tiền' };
    const d = this.state.data;
    d.expansions += 1;
    d.storeW = p.sizeAfter.w;
    d.storeH = p.sizeAfter.h;
    this.bus.emit('grid:changed', { reason: 'expansion' });
    this.bus.emit('toast', { message: `🏗️ Cửa hàng đã mở rộng lên ${d.storeW}×${d.storeH}!`, kind: 'success' });
    return { ok: true };
  }

  buyWarehouse(): R {
    const d = this.state.data;
    if (d.warehouseUnlocked) return { ok: false, reason: 'Đã có kho' };
    if (!this.state.levelAtLeast(WAREHOUSE_LEVEL)) return { ok: false, reason: `Cần cấp ${WAREHOUSE_LEVEL}` };
    if (!this.economy.spend(WAREHOUSE_PRICE, 'Mở kho bên cạnh')) return { ok: false, reason: 'Không đủ tiền' };
    d.warehouseUnlocked = true;
    this.bus.emit('grid:changed', { reason: 'expansion' });
    this.bus.emit('toast', { message: '🏚️ Kho bên cạnh đã mở! Đi qua cửa ở tường trái. Mua Kệ kho để chứa thùng.', kind: 'success' });
    return { ok: true };
  }
}
