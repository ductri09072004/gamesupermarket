import type { StorageType } from './furniture';

export type PackShape = 'box' | 'can' | 'bottle' | 'jar' | 'bag' | 'carton' | 'tube';
export type LabelPattern = 'stripes' | 'dots' | 'wave' | 'solid';

export interface LabelStyle {
  bg: string;
  accent: string;
  text: string;
  pattern: LabelPattern;
}

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
  shape: PackShape;
  /** Kích thước thật [rộng, cao, sâu] (m) */
  size: [number, number, number];
  brand: string;
  label: LabelStyle;
  volumeText: string;
}

type Row = [
  id: string, name: string, icon: string, storage: StorageType, units: number, cost: number, market: number,
  color: string, shape: PackShape, size: [number, number, number], brand: string, label: LabelStyle, volume: string,
];

const L = (bg: string, accent: string, text: string, pattern: LabelPattern): LabelStyle => ({ bg, accent, text, pattern });

// Tên hãng đều là hư cấu.
const groups: Array<{ category: string; licenseId: number; rows: Row[] }> = [
  {
    category: 'Cơ bản',
    licenseId: 0,
    rows: [
      ['noodles', 'Mì gói', '🍜', 'shelf', 24, 0.5, 0.75, '#f4a261', 'bag', [0.13, 0.17, 0.04], 'Lucky Noodle', L('#e63946', '#ffd166', '#ffffff', 'wave'), '75g'],
      ['water', 'Nước suối', '💧', 'shelf', 24, 0.6, 0.85, '#8ecae6', 'bottle', [0.068, 0.23, 0.068], 'AquaViva', L('#caf0f8', '#0077b6', '#023e8a', 'wave'), '500ml'],
      ['cookies', 'Bánh quy', '🍪', 'shelf', 12, 1.2, 1.75, '#c68b59', 'box', [0.16, 0.2, 0.05], 'Bisco Bear', L('#7f4f24', '#ffe8d6', '#ffe8d6', 'dots'), '300g'],
      ['soda', 'Nước ngọt lon', '🥤', 'shelf', 24, 0.8, 1.2, '#e63946', 'can', [0.066, 0.122, 0.066], 'FizzUp', L('#d62828', '#fcbf49', '#ffffff', 'stripes'), '330ml'],
      ['rice', 'Gạo túi 1kg', '🍚', 'shelf', 10, 1.8, 2.6, '#e9e4d4', 'bag', [0.16, 0.24, 0.07], 'Đồng Xanh', L('#f1faee', '#2d6a4f', '#1b4332', 'solid'), '1kg'],
      ['oil', 'Dầu ăn', '🫙', 'shelf', 12, 2.5, 3.6, '#ffd166', 'bottle', [0.085, 0.28, 0.085], 'Golden Drop', L('#ffba08', '#9d0208', '#370617', 'solid'), '1L'],
      ['chips', 'Snack khoai tây', '🥔', 'shelf', 16, 1.0, 1.5, '#ffb703', 'bag', [0.16, 0.22, 0.06], 'Crispo', L('#ffb703', '#023047', '#023047', 'stripes'), '90g'],
      ['chocolate', 'Sô-cô-la', '🍫', 'shelf', 20, 1.3, 1.9, '#6f4518', 'box', [0.16, 0.08, 0.025], 'Cocoa Kiss', L('#4a2c2a', '#f4a261', '#ffe8d6', 'wave'), '100g'],
      ['cupnoodle', 'Mì ly', '🥡', 'shelf', 24, 0.6, 0.9, '#fca311', 'jar', [0.1, 0.11, 0.1], 'Cup Go', L('#fca311', '#d00000', '#370617', 'stripes'), '65g'],
      ['ketchup', 'Tương cà', '🍅', 'shelf', 12, 1.1, 1.6, '#d00000', 'bottle', [0.07, 0.2, 0.05], 'Red Ruby', L('#d00000', '#2d6a4f', '#ffffff', 'solid'), '250g'],
      ['fishsauce', 'Nước mắm', '🐟', 'shelf', 12, 1.6, 2.3, '#bc6c25', 'bottle', [0.07, 0.26, 0.07], 'Biển Xanh', L('#023e8a', '#ffd166', '#ffffff', 'wave'), '500ml'],
      ['sugar', 'Đường 1kg', '🧂', 'shelf', 10, 1.0, 1.45, '#f8f9fa', 'bag', [0.14, 0.22, 0.07], 'Sweet Cane', L('#ffffff', '#e76f51', '#9d0208', 'dots'), '1kg'],
      ['bread', 'Bánh mì gói', '🍞', 'shelf', 10, 0.9, 1.35, '#e9c46a', 'bag', [0.22, 0.12, 0.12], 'Oven Joy', L('#f4d58d', '#bc6c25', '#582f0e', 'dots'), '400g'],
      ['condensed', 'Sữa đặc', '🥫', 'shelf', 24, 1.0, 1.45, '#1d4ed8', 'can', [0.075, 0.08, 0.075], 'Ngôi Sao', L('#1d4ed8', '#ffd166', '#ffffff', 'stripes'), '380g'],
      ['candy', 'Kẹo', '🍬', 'shelf', 20, 0.5, 0.8, '#ff8fab', 'jar', [0.09, 0.12, 0.09], 'Sugar Pop', L('#ff8fab', '#ffffff', '#590d22', 'dots'), '200g'],
    ],
  },
  {
    category: 'Sữa & Lạnh',
    licenseId: 1,
    rows: [
      ['milk', 'Sữa tươi', '🥛', 'fridge', 12, 1.1, 1.6, '#f8f9fa', 'carton', [0.072, 0.2, 0.072], 'Moo Farm', L('#ffffff', '#1d4ed8', '#1e3a8a', 'dots'), '1L'],
      ['yogurt', 'Sữa chua', '🍶', 'fridge', 16, 0.7, 1.05, '#cdb4db', 'jar', [0.075, 0.07, 0.075], 'Yogo', L('#cdb4db', '#ffffff', '#3c096c', 'wave'), '100g'],
      ['cheese', 'Phô mai', '🧀', 'fridge', 8, 3.5, 5.0, '#ffe066', 'box', [0.12, 0.05, 0.1], 'Cheddy', L('#ffd60a', '#c1121f', '#6a040f', 'solid'), '200g'],
      ['butter', 'Bơ', '🧈', 'fridge', 12, 2.0, 2.9, '#ffe066', 'box', [0.1, 0.05, 0.07], 'Butterly', L('#fff3b0', '#e09f3e', '#540b0e', 'solid'), '200g'],
      ['soymilk', 'Sữa đậu nành', '🫘', 'fridge', 12, 0.8, 1.2, '#e9d8a6', 'carton', [0.065, 0.17, 0.065], 'Soya Fresh', L('#e9d8a6', '#2d6a4f', '#1b4332', 'wave'), '1L'],
      ['eggs', 'Trứng', '🥚', 'fridge', 10, 2.2, 3.2, '#e9c46a', 'box', [0.24, 0.07, 0.1], 'Farm Fresh', L('#e9c46a', '#6f4518', '#432818', 'stripes'), '10 quả'],
    ],
  },
  {
    category: 'Đông lạnh',
    licenseId: 2,
    rows: [
      ['icecream', 'Kem', '🍦', 'freezer', 12, 1.5, 2.3, '#bde0fe', 'jar', [0.12, 0.1, 0.12], 'Polar Bite', L('#bde0fe', '#ff006e', '#03045e', 'dots'), '450ml'],
      ['dumplings', 'Há cảo', '🥟', 'freezer', 8, 3.0, 4.4, '#fefae0', 'bag', [0.18, 0.24, 0.05], 'Dim Sum Co', L('#fefae0', '#bc4749', '#6a040f', 'wave'), '500g'],
      ['sausage', 'Xúc xích', '🌭', 'freezer', 10, 2.6, 3.8, '#c1121f', 'box', [0.2, 0.05, 0.1], 'Grill King', L('#9d0208', '#ffba08', '#ffffff', 'stripes'), '400g'],
      ['pizza', 'Pizza đông lạnh', '🍕', 'freezer', 6, 4.0, 5.8, '#e63946', 'box', [0.26, 0.04, 0.26], 'Napoli Nights', L('#1d3557', '#e63946', '#ffffff', 'solid'), '420g'],
      ['fries', 'Khoai tây chiên', '🍟', 'freezer', 8, 2.2, 3.2, '#ffb703', 'bag', [0.2, 0.28, 0.06], 'Crispy Fries', L('#e63946', '#ffb703', '#ffffff', 'stripes'), '1kg'],
      ['springroll', 'Chả giò', '🥢', 'freezer', 8, 3.0, 4.3, '#bc6c25', 'bag', [0.2, 0.26, 0.05], 'Nem Ngon', L('#ffba08', '#9d0208', '#370617', 'dots'), '500g'],
      ['meat', 'Thịt đông lạnh', '🥩', 'freezer', 6, 6.0, 8.8, '#9d0208', 'box', [0.22, 0.06, 0.15], 'Prime Cut', L('#370617', '#e85d04', '#ffffff', 'solid'), '500g'],
    ],
  },
  {
    category: 'Hoá phẩm',
    licenseId: 3,
    rows: [
      ['shampoo', 'Dầu gội', '🧴', 'shelf', 8, 3.2, 4.6, '#2a9d8f', 'bottle', [0.08, 0.22, 0.05], 'Silky', L('#2a9d8f', '#e9c46a', '#ffffff', 'wave'), '400ml'],
      ['toothpaste', 'Kem đánh răng', '🪥', 'shelf', 12, 1.6, 2.4, '#48cae4', 'tube', [0.05, 0.19, 0.04], 'Brite', L('#ffffff', '#0096c7', '#023e8a', 'stripes'), '150g'],
      ['detergent', 'Bột giặt', '🧺', 'shelf', 6, 4.5, 6.4, '#4361ee', 'box', [0.25, 0.3, 0.1], 'CleanWave', L('#4361ee', '#f72585', '#ffffff', 'wave'), '3kg'],
      ['soap', 'Xà phòng', '🧼', 'shelf', 24, 0.8, 1.2, '#90e0ef', 'box', [0.09, 0.06, 0.035], 'Bubble Bliss', L('#caf0f8', '#ff70a6', '#03045e', 'dots'), '90g'],
      ['dishsoap', 'Nước rửa chén', '🍽️', 'shelf', 12, 1.5, 2.2, '#80ed99', 'bottle', [0.08, 0.24, 0.05], 'Shine Dish', L('#38b000', '#ffffff', '#ffffff', 'wave'), '750ml'],
      ['facial', 'Khăn giấy hộp', '🤧', 'shelf', 12, 1.2, 1.75, '#ffc8dd', 'box', [0.22, 0.09, 0.12], 'Tissu', L('#ffc8dd', '#cdb4db', '#590d22', 'wave'), '180 tờ'],
      ['tissue', 'Giấy vệ sinh', '🧻', 'shelf', 10, 2.0, 2.9, '#dfe7ec', 'bag', [0.22, 0.24, 0.11], 'SoftCloud', L('#f8f9fa', '#90e0ef', '#0077b6', 'dots'), '10 cuộn'],
    ],
  },
  {
    category: 'Đồ uống cao cấp',
    licenseId: 4,
    rows: [
      ['coffee', 'Cà phê', '☕', 'shelf', 8, 5.0, 7.4, '#6f4518', 'jar', [0.1, 0.15, 0.1], 'Bean Brothers', L('#432818', '#ffe8d6', '#ffe8d6', 'solid'), '200g'],
      ['tea', 'Trà', '🍵', 'shelf', 10, 3.0, 4.4, '#588157', 'box', [0.12, 0.08, 0.07], 'Leafy', L('#588157', '#dad7cd', '#ffffff', 'wave'), '25 gói'],
      ['juice', 'Nước ép', '🧃', 'fridge', 12, 2.4, 3.5, '#fb8500', 'carton', [0.072, 0.2, 0.072], 'Sunny Squeeze', L('#fb8500', '#ffb703', '#ffffff', 'dots'), '1L'],
      ['energy', 'Nước tăng lực', '⚡', 'fridge', 24, 1.0, 1.5, '#3a86ff', 'can', [0.058, 0.16, 0.058], 'VoltUp', L('#10002b', '#3a86ff', '#ffbe0b', 'stripes'), '250ml'],
      ['milktea', 'Trà sữa chai', '🧋', 'fridge', 12, 1.4, 2.05, '#d4a373', 'bottle', [0.07, 0.2, 0.07], 'Boba Bay', L('#faedcd', '#6f4518', '#432818', 'dots'), '450ml'],
      ['wine', 'Rượu vang', '🍷', 'shelf', 6, 7.5, 10.9, '#7b2cbf', 'bottle', [0.08, 0.3, 0.08], 'Vino Rosa', L('#f8f1e7', '#7b2cbf', '#3c096c', 'solid'), '750ml'],
      ['beer', 'Bia', '🍺', 'fridge', 24, 1.5, 2.2, '#f9c74f', 'can', [0.066, 0.122, 0.066], 'Hop Hop', L('#1b4332', '#f9c74f', '#f9c74f', 'stripes'), '330ml'],
    ],
  },
];

export const PRODUCTS: ProductDef[] = groups.flatMap((g) =>
  g.rows.map(([id, name, icon, storage, unitsPerBox, costPerUnit, marketPrice, color, shape, size, brand, label, volumeText]) => ({
    id, name, icon, category: g.category, storage, unitsPerBox, costPerUnit, marketPrice, licenseId: g.licenseId,
    color, shape, size, brand, label, volumeText,
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
