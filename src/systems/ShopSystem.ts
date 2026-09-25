import {
  EXPANSION_BASE_PRICE, EXPANSION_PRICE_GROWTH, EXPANSION_STEP, FURNITURE_SELL_REFUND, INITIAL_STORE_H,
  INITIAL_STORE_W, MAX_STORE_H, MAX_STORE_W, WAREHOUSE_LEVEL, WAREHOUSE_PRICE,
} from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getLicense } from '../config/licenses';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../core/GameState';
import type { EconomySystem } from './EconomySystem';

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

export class ShopSystem {
  readonly packs = expansionPacks();

  constructor(private state: GameState, private bus: EventBus<GameEvents>, private economy: EconomySystem) {}

  licenseStatus(id: number): 'owned' | 'available' | 'locked-level' | 'locked-prev' {
    const d = this.state.data;
    if (d.licenses.includes(id)) return 'owned';
    const req = getLicense(id).requires;
    if (req !== null && !d.licenses.includes(req)) return 'locked-prev';
    if (d.level < getLicense(id).levelRequired) return 'locked-level';
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

  buyFurniture(type: string): R {
    const c = this.canBuyFurniture(type);
    if (!c.ok) return c;
    const def = getFurniture(type);
    this.economy.spend(def.price, `Mua ${def.name}`);
    this.state.data.furnitureStock.push(type);
    this.bus.emit('furniture:changed', {});
    return { ok: true };
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
    if (this.state.data.level < p.levelRequired) return { ok: false, reason: `Cần cấp ${p.levelRequired}` };
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
    if (d.level < WAREHOUSE_LEVEL) return { ok: false, reason: `Cần cấp ${WAREHOUSE_LEVEL}` };
    if (!this.economy.spend(WAREHOUSE_PRICE, 'Mở kho phía sau')) return { ok: false, reason: 'Không đủ tiền' };
    d.warehouseUnlocked = true;
    this.bus.emit('grid:changed', { reason: 'expansion' });
    this.bus.emit('toast', { message: '🏚️ Kho phía sau đã mở! Mua Kệ kho để chứa thùng.', kind: 'success' });
    return { ok: true };
  }
}
