import type { VehicleType } from './vehicles';

/**
 * Đội xe kiểu Việt Nam xưa: xe máy cổ, jeep/bán tải quân đội, ô tô cổ, xe tải tiếp tế. Model Sketchfab (CC-BY) đã chuẩn hoá
 * (mét, gốc giữa đáy, đầu xe -Z) trong public/assets/models/city — xem CREDITS.md. Đơn vị: mét.
 */
export interface VehicleVariant {
  id: string;
  type: VehicleType;
  name: string;
  /** Tên model trong registry thành phố (cityModel) */
  model: string;
  /** Kích thước thân xe [rộng, cao, dài] — làm hộp va chạm */
  size: [number, number, number];
  /** Hệ số nhân giá so với giá gốc của loại xe */
  priceMul: number;
  description: string;
  /** Đảo đầu xe 180° nếu model nạp lên bị ngược */
  flip?: boolean;
  /** Vị trí xếp thùng: lưới cols × rows (dọc thân) × layers, căn giữa theo X; y = mặt đặt thùng, z = hàng đầu (âm = phía trước) */
  cargo: { cols: number; rows: number; layers: number; y: number; z: number };
}

export const VARIANTS: VehicleVariant[] = [
  // xe máy: 2 thùng chồng ở sau yên
  { id: 'vespa_red', type: 'moto', name: 'Vespa cũ (đỏ)', model: 'moto_vespa_red', flip: true, size: [0.8, 1.1, 1.75], priceMul: 1, description: 'Xe tay ga cổ có giỏ sau, cưỡi êm. Chở 2 thùng.', cargo: { cols: 1, rows: 1, layers: 2, y: 0.55, z: 0.5 } },
  { id: 'vespa_white', type: 'moto', name: 'Vespa trắng ngà', model: 'moto_vespa_white', flip: true, size: [0.6, 1.1, 1.7], priceMul: 1.1, description: 'Vespa đời cũ sơn trắng ngà, dáng thanh.', cargo: { cols: 1, rows: 1, layers: 2, y: 0.6, z: 0.45 } },
  { id: 'lambretta', type: 'moto', name: 'Lambretta xanh', model: 'moto_lambretta', flip: true, size: [0.6, 1.1, 1.8], priceMul: 1.25, description: 'Lambretta thập niên 60, bền và "lì".', cargo: { cols: 1, rows: 1, layers: 2, y: 0.6, z: 0.5 } },
  { id: 'yamaha_xs1', type: 'moto', name: 'Yamaha XS1 1970', model: 'moto_yamaha', flip: true, size: [0.8, 1.25, 2.1], priceMul: 1.7, description: 'Mô tô cổ 650cc, cực ngầu, baga sau rộng.', cargo: { cols: 1, rows: 1, layers: 2, y: 0.75, z: 0.65 } },
  // bán tải: xe quân đội / bán tải bạt
  { id: 'uaz469', type: 'pickup', name: 'UAZ-469 quân đội', model: 'jeep_uaz469', size: [1.95, 2.07, 4.0], priceMul: 1, description: 'Jeep quân đội Liên Xô, gầm cao, thùng sau bạt kín.', cargo: { cols: 2, rows: 3, layers: 4, y: 0.7, z: -0.1 } },
  { id: 'peugeot404', type: 'pickup', name: 'Peugeot 404 bạt', model: 'pickup_peugeot404', size: [1.75, 2.0, 4.5], priceMul: 0.9, description: 'Bán tải Pháp phủ bạt, thùng sau khá rộng.', cargo: { cols: 3, rows: 4, layers: 2, y: 0.7, z: 0.35 } },
  // ô tô cổ
  { id: 'volga', type: 'car', name: 'Volga GAZ-21', model: 'car_volga', size: [1.87, 1.6, 4.8], priceMul: 1, description: 'Xe công vụ thời bao cấp.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.5, z: 0.35 } },
  { id: 'volga_low', type: 'car', name: 'Volga (bản đen)', model: 'car_volga_low', flip: true, size: [1.86, 1.59, 4.8], priceMul: 1, description: 'Volga sơn đen.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.5, z: 0.35 } },
  { id: 'willys', type: 'car', name: 'Jeep Willys', model: 'car_willys', size: [1.66, 1.6, 3.4], priceMul: 0.85, description: 'Jeep Mỹ thời chiến tranh, nhỏ gọn.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.55, z: 0.2 } },
  { id: 'willys_b', type: 'car', name: 'Jeep Willys (bản xanh)', model: 'car_willys_low', size: [1.7, 1.6, 3.4], priceMul: 0.85, description: 'Willys MB sơn xanh quân đội.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.55, z: 0.2 } },
  { id: 'chevy_c10', type: 'car', name: 'Chevrolet C10 1963', model: 'car_c10', size: [2.0, 1.75, 5.0], priceMul: 1.3, description: 'Bán tải Mỹ cổ sơn xanh ngọc.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.7, z: 0.9 } },
  { id: 'cadillac', type: 'car', name: 'Cadillac 75 (1953)', model: 'car_cadillac', flip: true, size: [1.85, 1.6, 5.6], priceMul: 1.5, description: 'Sedan Mỹ dài, đen bóng như xe Sài Gòn xưa.', cargo: { cols: 2, rows: 2, layers: 2, y: 0.5, z: 0.5 } },
];

export function variantsOf(type: string): VehicleVariant[] {
  return VARIANTS.filter((v) => v.type === type);
}

/** Kiểu xe theo id; không có/không hợp lệ → kiểu đầu tiên của loại xe. */
export function getVariant(type: string, id?: string): VehicleVariant {
  const list = variantsOf(type);
  return list.find((v) => v.id === id) ?? list[0];
}

/** Ô tô chạy ngoài phố & đỗ trong bãi: cùng bộ với xe người chơi có thể mua (kèm UAZ) */
export const NPC_CAR_MODELS = [...VARIANTS.filter((v) => v.type === 'car'), VARIANTS.find((v) => v.id === 'uaz469')!];

/** Xe máy chạy & đậu trên phố: xe cổ ngẫu nhiên. seat = chỉnh chỗ người lái (m) so với xe Vespa chuẩn. */
export interface BikeModel {
  model: string;
  seat: { dy: number; dz: number; scale: number };
  flip?: boolean;
}
export const BIKE_MODELS: BikeModel[] = [
  { model: 'moto_vespa_red', seat: { dy: 0, dz: 0, scale: 1 }, flip: true },
  { model: 'moto_vespa_white', seat: { dy: 0, dz: 0, scale: 1 }, flip: true },
  { model: 'moto_yamaha', seat: { dy: 0.1, dz: 0.05, scale: 1.05 }, flip: true },
  { model: 'moto_lambretta', seat: { dy: 0, dz: 0, scale: 1 }, flip: true },
];

/** Xe tải tiếp tế giao hàng: mỗi chuyến chọn ngẫu nhiên một kiểu. len = chiều dài (m). */
export interface TruckKind {
  model: string;
  len: number;
  flip?: boolean;
}
export const DELIVERY_TRUCKS: TruckKind[] = [
  { model: 'truck_gaz66', len: 5.9 },
  { model: 'truck_supply', len: 6.3 },
  { model: 'truck_zil131', len: 7.0 },
];
