import type { StorageType } from './furniture';

export interface ProductDef {
  id: string;
  name: string;
  icon: string;
  category: string;
  storage: StorageType;
  unitsPerBox: number;
  costPerUnit: number;
  marketPrice: number;
  licenseId: number;
  color: string;
}

type Row = [string, string, string, StorageType, number, number, number, string];

const groups: Array<{ category: string; licenseId: number; rows: Row[] }> = [
  {
    category: 'Cơ bản',
    licenseId: 0,
    rows: [
      ['noodles', 'Mì gói', '🍜', 'shelf', 24, 0.5, 0.75, '#f4a261'],
      ['water', 'Nước suối', '💧', 'shelf', 24, 0.6, 0.85, '#8ecae6'],
      ['cookies', 'Bánh quy', '🍪', 'shelf', 12, 1.2, 1.75, '#c68b59'],
      ['soda', 'Nước ngọt lon', '🥤', 'shelf', 24, 0.8, 1.2, '#e63946'],
      ['rice', 'Gạo túi 1kg', '🍚', 'shelf', 10, 1.8, 2.6, '#e9e4d4'],
      ['oil', 'Dầu ăn', '🫙', 'shelf', 12, 2.5, 3.6, '#ffd166'],
      ['chips', 'Snack khoai tây', '🥔', 'shelf', 16, 1.0, 1.5, '#ffb703'],
      ['candy', 'Kẹo', '🍬', 'shelf', 20, 0.5, 0.8, '#ff8fab'],
    ],
  },
  {
    category: 'Sữa & Lạnh',
    licenseId: 1,
    rows: [
      ['milk', 'Sữa tươi', '🥛', 'fridge', 12, 1.1, 1.6, '#f8f9fa'],
      ['yogurt', 'Sữa chua', '🍶', 'fridge', 16, 0.7, 1.05, '#cdb4db'],
      ['cheese', 'Phô mai', '🧀', 'fridge', 8, 3.5, 5.0, '#ffe066'],
      ['eggs', 'Trứng', '🥚', 'fridge', 10, 2.2, 3.2, '#e9c46a'],
    ],
  },
  {
    category: 'Đông lạnh',
    licenseId: 2,
    rows: [
      ['icecream', 'Kem', '🍦', 'freezer', 12, 1.5, 2.3, '#bde0fe'],
      ['dumplings', 'Há cảo', '🥟', 'freezer', 8, 3.0, 4.4, '#fefae0'],
      ['sausage', 'Xúc xích', '🌭', 'freezer', 10, 2.6, 3.8, '#c1121f'],
      ['meat', 'Thịt đông lạnh', '🥩', 'freezer', 6, 6.0, 8.8, '#9d0208'],
    ],
  },
  {
    category: 'Hoá phẩm',
    licenseId: 3,
    rows: [
      ['shampoo', 'Dầu gội', '🧴', 'shelf', 8, 3.2, 4.6, '#2a9d8f'],
      ['toothpaste', 'Kem đánh răng', '🪥', 'shelf', 12, 1.6, 2.4, '#48cae4'],
      ['detergent', 'Bột giặt', '🧺', 'shelf', 6, 4.5, 6.4, '#4361ee'],
      ['tissue', 'Giấy vệ sinh', '🧻', 'shelf', 10, 2.0, 2.9, '#dfe7ec'],
    ],
  },
  {
    category: 'Đồ uống cao cấp',
    licenseId: 4,
    rows: [
      ['coffee', 'Cà phê', '☕', 'shelf', 8, 5.0, 7.4, '#6f4518'],
      ['tea', 'Trà', '🍵', 'shelf', 10, 3.0, 4.4, '#588157'],
      ['juice', 'Nước ép', '🧃', 'fridge', 12, 2.4, 3.5, '#fb8500'],
      ['beer', 'Bia', '🍺', 'fridge', 24, 1.5, 2.2, '#f9c74f'],
    ],
  },
];

export const PRODUCTS: ProductDef[] = groups.flatMap((g) =>
  g.rows.map(([id, name, icon, storage, unitsPerBox, costPerUnit, marketPrice, color]) => ({
    id,
    name,
    icon,
    category: g.category,
    storage,
    unitsPerBox,
    costPerUnit,
    marketPrice,
    licenseId: g.licenseId,
    color,
  })),
);

const byId = new Map(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): ProductDef {
  const p = byId.get(id);
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
}

export function boxCost(p: ProductDef): number {
  return Math.round(p.unitsPerBox * p.costPerUnit * 100) / 100;
}
