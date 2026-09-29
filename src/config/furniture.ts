import { CELL, MAX_SLOT_ROWS } from './constants';

export type StorageType = 'shelf' | 'fridge' | 'freezer' | 'clothing' | 'electronics';
export type FurnitureKind = 'display' | 'checkout' | 'selfcheckout' | 'trash' | 'computer' | 'rack' | 'lamp' | 'gate' | 'altar';

export interface FurnitureDef {
  id: string;
  name: string;
  icon: string;
  kind: FurnitureKind;
  /** Kích thước thật (m): rộng (X), sâu (Z), cao (Y) — mặt trước hướng -Z trước khi xoay */
  size: { w: number; d: number; h: number };
  /** Footprint theo ô NavGrid (0.5m), suy ra từ size */
  footprint: { w: number; h: number };
  price: number;
  tiers: number;
  columns: number;
  /** tiers × columns (display) hoặc số thùng (rack) */
  slots: number;
  storage: StorageType | null;
  licenseRequired: number;
  color: number;
  electricity: number;
  buyable: boolean;
  sellable: boolean;
  warehouseOnly: boolean;
  /** Tên file model tuỳ chọn trong public/assets/models/furniture */
  model: string;
  /** Loại hàng nhận thêm ngoài `storage` (máy bán hàng nhận cả hàng kệ & tủ lạnh) */
  accepts: StorageType[];
  /** Máy bán hàng tự động: khách mua & trả tiền ngay tại máy */
  vending: boolean;
  /** Số hàng sâu tối đa / số lớp chồng tối đa trong 1 ngăn */
  maxRows: number;
  maxStack: number;
  /** Khoá hình học ngăn kệ trong SlotLayout (mặc định theo storage) — kệ model cổ có tầng riêng */
  geom?: string;
  /** Mẫu cũ (kệ inox đen–gỗ): vẫn dùng được trong bản lưu nhưng ẩn khỏi cửa hàng mua sắm */
  legacy?: boolean;
  /** Đèn trần: diện tích chiếu sáng (m²) và màu ánh sáng */
  light?: { area: number; color: number };
}

type Base = Omit<FurnitureDef, 'id' | 'name' | 'icon' | 'kind' | 'size' | 'footprint' | 'price' | 'slots' | 'color' | 'model'>;
const base: Base = {
  tiers: 1, columns: 1, storage: null, licenseRequired: 0, electricity: 0, buyable: true, sellable: true, warehouseOnly: false,
  accepts: [], vending: false, maxRows: MAX_SLOT_ROWS, maxStack: 2,
};

function def(d: Partial<Base> & Pick<FurnitureDef, 'id' | 'name' | 'icon' | 'kind' | 'size' | 'price' | 'color'>): FurnitureDef {
  const merged = { ...base, ...d };
  return {
    ...merged,
    footprint: { w: Math.ceil(d.size.w / CELL - 1e-6), h: Math.ceil(d.size.d / CELL - 1e-6) },
    slots: merged.tiers * merged.columns,
    model: `${d.id}.glb`,
  };
}

export const FURNITURE: FurnitureDef[] = [
  def({ id: 'shelf_small', name: 'Kệ nhỏ (inox)', icon: '🗄️', kind: 'display', size: { w: 1, d: 0.5, h: 1.6 }, price: 120, tiers: 4, columns: 1, storage: 'shelf', color: 0xe9ecef, legacy: true }),
  def({ id: 'shelf_large', name: 'Kệ lớn (inox)', icon: '🧱', kind: 'display', size: { w: 2, d: 0.5, h: 1.8 }, price: 220, tiers: 4, columns: 2, storage: 'shelf', color: 0xe9ecef, legacy: true }),
  // kệ cổ (model Sketchfab): ngăn khớp từng tầng ván của model — xem GEOM 'pantry' | 'hutch' | 'ladder' trong SlotLayout
  def({ id: 'shelf_pantry', name: 'Kệ gỗ sắt cũ', icon: '🪵', kind: 'display', size: { w: 1, d: 0.4, h: 1.15 }, price: 90, tiers: 3, columns: 1, storage: 'shelf', color: 0x4a3f36, geom: 'pantry' }),
  def({ id: 'shelf_ladder', name: 'Kệ thang gỗ', icon: '🪜', kind: 'display', size: { w: 2, d: 0.6, h: 2.4 }, price: 240, tiers: 4, columns: 2, storage: 'shelf', color: 0xb08050, geom: 'ladder' }),
  // tủ mát / tủ đông cổ (model Sketchfab đã khoét cửa kính) — GEOM 'coke' | 'chest'
  def({ id: 'fridge_coke', name: 'Tủ mát Coca cổ', icon: '🥤', kind: 'display', size: { w: 1.1, d: 0.77, h: 1.85 }, price: 380, tiers: 3, columns: 1, storage: 'fridge', licenseRequired: 1, electricity: 8, color: 0xb91c1c, geom: 'coke' }),
  def({ id: 'freezer_chest', name: 'Tủ đông nằm cũ', icon: '🧊', kind: 'display', size: { w: 1.6, d: 0.72, h: 0.83 }, price: 420, tiers: 1, columns: 2, storage: 'freezer', licenseRequired: 2, electricity: 12, maxStack: 3, color: 0xf1f5f9, geom: 'chest' }),
  def({ id: 'shelf_hutch', name: 'Tủ kệ gỗ cổ', icon: '🏚️', kind: 'display', size: { w: 2, d: 0.53, h: 2.5 }, price: 340, tiers: 5, columns: 2, storage: 'shelf', color: 0x3f2f26, geom: 'hutch' }),
  def({ id: 'fridge', name: 'Tủ lạnh (kính)', icon: '🧊', kind: 'display', size: { w: 2, d: 0.75, h: 2.0 }, price: 450, tiers: 4, columns: 2, storage: 'fridge', licenseRequired: 1, electricity: 12, color: 0xdfe7ee, legacy: true }),
  def({ id: 'freezer', name: 'Tủ đông đảo (kính)', icon: '❄️', kind: 'display', size: { w: 2, d: 0.9, h: 0.9 }, price: 550, tiers: 1, columns: 3, storage: 'freezer', licenseRequired: 2, electricity: 16, maxStack: 3, color: 0xf1f5f9, legacy: true }),
  def({ id: 'clothing_rack', name: 'Giá treo quần áo', icon: '👕', kind: 'display', size: { w: 1.6, d: 0.6, h: 1.7 }, price: 260, tiers: 1, columns: 3, storage: 'clothing', licenseRequired: 5, maxRows: 10, maxStack: 1, color: 0xc0c7d0 }),
  def({ id: 'electronics_case', name: 'Tủ kính điện tử', icon: '📱', kind: 'display', size: { w: 1.6, d: 0.6, h: 1.9 }, price: 650, tiers: 4, columns: 2, storage: 'electronics', licenseRequired: 6, electricity: 5, maxRows: 3, maxStack: 1, color: 0x1f2937 }),
  def({ id: 'vending', name: 'Máy bán hàng tự động', icon: '🥤', kind: 'display', size: { w: 1, d: 0.8, h: 1.9 }, price: 900, tiers: 4, columns: 4, storage: 'shelf', accepts: ['shelf', 'fridge'], vending: true, electricity: 6, maxRows: 8, maxStack: 1, color: 0xe63946 }),
  def({ id: 'checkout', name: 'Quầy thu ngân', icon: '🧾', kind: 'checkout', size: { w: 2, d: 0.8, h: 0.9 }, price: 350, electricity: 2, color: 0x6c8ea4 }),
  def({ id: 'self_checkout', name: 'Máy tự tính tiền', icon: '🖥️', kind: 'selfcheckout', size: { w: 1, d: 0.8, h: 1 }, price: 1200, licenseRequired: 1, electricity: 4, color: 0x2f3e46 }),
  def({ id: 'lamp_tube', name: 'Đèn LED tuýp', icon: '💡', kind: 'lamp', size: { w: 1.5, d: 0.5, h: 0.08 }, price: 45, electricity: 1, light: { area: 10, color: 0xffe9c4 }, color: 0xffffff }),
  def({ id: 'lamp_pendant', name: 'Đèn thả trần', icon: '🏮', kind: 'lamp', size: { w: 0.5, d: 0.5, h: 0.7 }, price: 80, electricity: 1, light: { area: 6, color: 0xffd9a8 }, color: 0x2b2d42 }),
  def({ id: 'security_gate', name: 'Cổng an ninh', icon: '🚨', kind: 'gate', size: { w: 1.6, d: 0.4, h: 1.55 }, price: 650, electricity: 2, color: 0xe5e7eb }),
  def({ id: 'altar', name: 'Bàn thờ Thần Tài', icon: '🧧', kind: 'altar', size: { w: 1, d: 0.5, h: 2.3 }, price: 150, color: 0xb91c1c }),
  def({ id: 'trash', name: 'Thùng rác', icon: '🗑️', kind: 'trash', size: { w: 0.5, d: 0.5, h: 0.8 }, price: 40, color: 0x4f7a38 }),
  def({ id: 'rack', name: 'Kệ kho', icon: '📦', kind: 'rack', size: { w: 2, d: 0.6, h: 2.0 }, price: 180, tiers: 3, columns: 2, warehouseOnly: true, color: 0x5c6b7a }),
  def({ id: 'computer', name: 'Bàn máy tính', icon: '💻', kind: 'computer', size: { w: 1.2, d: 0.6, h: 0.75 }, price: 0, buyable: false, sellable: false, electricity: 1, color: 0x8d6e63 }),
];

const byId = new Map(FURNITURE.map((f) => [f.id, f]));

/** Nội thất gắn trần (đèn): không chiếm ô sàn, không chặn đường, không va chạm. */
export function isCeiling(def: Pick<FurnitureDef, 'kind'>): boolean {
  return def.kind === 'lamp';
}

/** Không chiếm ô sàn / không chặn đường (đèn trần, cổng an ninh — khách đi xuyên qua giữa 2 cột). */
export function isPassable(def: Pick<FurnitureDef, 'kind'>): boolean {
  return def.kind === 'lamp' || def.kind === 'gate';
}

export function getFurniture(id: string): FurnitureDef {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown furniture ${id}`);
  return f;
}
