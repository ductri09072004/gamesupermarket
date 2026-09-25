import { CELL } from './constants';

export type StorageType = 'shelf' | 'fridge' | 'freezer';
export type FurnitureKind = 'display' | 'checkout' | 'trash' | 'computer' | 'rack';

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
}

type Base = Omit<FurnitureDef, 'id' | 'name' | 'icon' | 'kind' | 'size' | 'footprint' | 'price' | 'slots' | 'color' | 'model'>;
const base: Base = {
  tiers: 1, columns: 1, storage: null, licenseRequired: 0, electricity: 0, buyable: true, sellable: true, warehouseOnly: false,
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
  def({ id: 'shelf_small', name: 'Kệ nhỏ', icon: '🗄️', kind: 'display', size: { w: 1, d: 0.5, h: 1.6 }, price: 120, tiers: 4, columns: 1, storage: 'shelf', color: 0xe9ecef }),
  def({ id: 'shelf_large', name: 'Kệ lớn', icon: '🧱', kind: 'display', size: { w: 2, d: 0.5, h: 1.8 }, price: 220, tiers: 4, columns: 2, storage: 'shelf', color: 0xe9ecef }),
  def({ id: 'fridge', name: 'Tủ lạnh', icon: '🧊', kind: 'display', size: { w: 2, d: 0.75, h: 2.0 }, price: 450, tiers: 4, columns: 2, storage: 'fridge', licenseRequired: 1, electricity: 12, color: 0xdfe7ee }),
  def({ id: 'freezer', name: 'Tủ đông', icon: '❄️', kind: 'display', size: { w: 2, d: 0.9, h: 0.9 }, price: 550, tiers: 1, columns: 3, storage: 'freezer', licenseRequired: 2, electricity: 16, color: 0xf1f5f9 }),
  def({ id: 'checkout', name: 'Quầy thu ngân', icon: '🧾', kind: 'checkout', size: { w: 2, d: 0.8, h: 0.9 }, price: 350, electricity: 2, color: 0x6c8ea4 }),
  def({ id: 'trash', name: 'Thùng rác', icon: '🗑️', kind: 'trash', size: { w: 0.5, d: 0.5, h: 0.8 }, price: 40, color: 0x4f7a38 }),
  def({ id: 'rack', name: 'Kệ kho', icon: '📦', kind: 'rack', size: { w: 2, d: 0.6, h: 2.0 }, price: 180, tiers: 3, columns: 2, warehouseOnly: true, color: 0x5c6b7a }),
  def({ id: 'computer', name: 'Bàn máy tính', icon: '💻', kind: 'computer', size: { w: 1.2, d: 0.6, h: 0.75 }, price: 0, buyable: false, sellable: false, electricity: 1, color: 0x8d6e63 }),
];

const byId = new Map(FURNITURE.map((f) => [f.id, f]));

export function getFurniture(id: string): FurnitureDef {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown furniture ${id}`);
  return f;
}
