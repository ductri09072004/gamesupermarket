export type StorageType = 'shelf' | 'fridge' | 'freezer';
export type FurnitureKind = 'display' | 'checkout' | 'trash' | 'computer' | 'rack';

export interface FurnitureDef {
  id: string;
  name: string;
  icon: string;
  kind: FurnitureKind;
  footprint: { w: number; h: number };
  price: number;
  slots: number; // số slot sản phẩm (display) hoặc số thùng (rack)
  slotCapacity: number;
  storage: StorageType | null;
  licenseRequired: number;
  height: number; // px
  colors: { top: number; left: number; right: number };
  electricity: number; // $/ngày
  buyable: boolean;
  sellable: boolean;
  warehouseOnly: boolean;
}

const base = {
  slots: 0,
  slotCapacity: 0,
  storage: null,
  licenseRequired: 0,
  electricity: 0,
  buyable: true,
  sellable: true,
  warehouseOnly: false,
} as const;

export const FURNITURE: FurnitureDef[] = [
  {
    ...base, id: 'shelf_small', name: 'Kệ nhỏ', icon: '🗄️', kind: 'display', footprint: { w: 1, h: 1 },
    price: 120, slots: 2, slotCapacity: 12, storage: 'shelf', height: 34,
    colors: { top: 0xf7e1c4, left: 0xd9a86c, right: 0xc08a4e },
  },
  {
    ...base, id: 'shelf_large', name: 'Kệ lớn', icon: '🧱', kind: 'display', footprint: { w: 2, h: 1 },
    price: 220, slots: 4, slotCapacity: 12, storage: 'shelf', height: 34,
    colors: { top: 0xf7e1c4, left: 0xd9a86c, right: 0xc08a4e },
  },
  {
    ...base, id: 'fridge', name: 'Tủ lạnh', icon: '🧊', kind: 'display', footprint: { w: 2, h: 1 },
    price: 450, slots: 3, slotCapacity: 12, storage: 'fridge', licenseRequired: 1, height: 44, electricity: 12,
    colors: { top: 0xe8f4fb, left: 0xa8d8f0, right: 0x86c3e3 },
  },
  {
    ...base, id: 'freezer', name: 'Tủ đông', icon: '❄️', kind: 'display', footprint: { w: 2, h: 1 },
    price: 550, slots: 3, slotCapacity: 12, storage: 'freezer', licenseRequired: 2, height: 24, electricity: 16,
    colors: { top: 0xd6ecff, left: 0x8fb8de, right: 0x6f9cc8 },
  },
  {
    ...base, id: 'checkout', name: 'Quầy thu ngân', icon: '🧾', kind: 'checkout', footprint: { w: 2, h: 1 },
    price: 350, height: 22, electricity: 2,
    colors: { top: 0xb8e0d2, left: 0x7fb8a4, right: 0x5f9c88 },
  },
  {
    ...base, id: 'trash', name: 'Thùng rác', icon: '🗑️', kind: 'trash', footprint: { w: 1, h: 1 },
    price: 40, height: 22,
    colors: { top: 0x6a994e, left: 0x4f7a38, right: 0x3e6329 },
  },
  {
    ...base, id: 'rack', name: 'Kệ kho', icon: '📦', kind: 'rack', footprint: { w: 2, h: 1 },
    price: 180, slots: 4, slotCapacity: 1, height: 40, warehouseOnly: true,
    colors: { top: 0xb0b7c3, left: 0x8d95a3, right: 0x6f7786 },
  },
  {
    ...base, id: 'computer', name: 'Bàn máy tính', icon: '💻', kind: 'computer', footprint: { w: 1, h: 1 },
    price: 0, height: 20, buyable: false, sellable: false, electricity: 1,
    colors: { top: 0xcdb4db, left: 0xa98bbd, right: 0x8c6fa3 },
  },
];

const byId = new Map(FURNITURE.map((f) => [f.id, f]));

export function getFurniture(id: string): FurnitureDef {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown furniture ${id}`);
  return f;
}
