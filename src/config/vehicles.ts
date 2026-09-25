/** Xe của người chơi. Đơn vị: m, m/s, giây. Sức chở tính theo "suất": thùng thường 1, thùng cồng kềnh 2. */
export type VehicleType = 'moto' | 'car' | 'pickup';

export interface VehicleDef {
  id: VehicleType;
  name: string;
  icon: string;
  price: number;
  levelRequired: number;
  /** Sức chở (suất). Xe máy đếm theo số thùng, bỏ qua cỡ thùng. */
  capacity: number;
  countBySize: boolean;
  maxSpeed: number;
  reverseSpeed: number;
  accel: number;
  brake: number;
  /** Chiều dài cơ sở — quyết định bán kính quay */
  wheelbase: number;
  maxSteer: number;
  /** Kích thước thân xe [rộng, cao, dài] */
  size: [number, number, number];
  /** Camera bám đuôi: khoảng cách, độ cao */
  camDist: number;
  camHeight: number;
  description: string;
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'moto', name: 'Xe máy', icon: '🛵', price: 900, levelRequired: 1, capacity: 2, countBySize: false,
    maxSpeed: 13, reverseSpeed: 2, accel: 6, brake: 12, wheelbase: 1.3, maxSteer: 0.6, size: [0.75, 1.15, 1.9],
    camDist: 3.6, camHeight: 1.9, description: 'Nhanh, rẻ, luồn lách tốt. Chở tối đa 2 thùng trên baga.',
  },
  {
    id: 'car', name: 'Ô tô con', icon: '🚗', price: 5500, levelRequired: 3, capacity: 8, countBySize: true,
    maxSpeed: 19, reverseSpeed: 5, accel: 5, brake: 14, wheelbase: 2.6, maxSteer: 0.55, size: [1.81, 1.18, 4.22],
    camDist: 6.2, camHeight: 2.6, description: '8 suất chở (thùng cồng kềnh tính 2 suất) ở cốp và ghế sau.',
  },
  {
    id: 'pickup', name: 'Bán tải', icon: '🛻', price: 11000, levelRequired: 5, capacity: 20, countBySize: true,
    maxSpeed: 17, reverseSpeed: 4.5, accel: 4, brake: 12, wheelbase: 3.1, maxSteer: 0.5, size: [1.95, 1.8, 5.2],
    camDist: 7.2, camHeight: 3, description: 'Thùng sau rộng: 20 suất chở. Hợp để gom hàng sỉ số lượng lớn.',
  },
];

export function getVehicle(id: string): VehicleDef {
  const v = VEHICLES.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown vehicle ${id}`);
  return v;
}

/** Thể tích 1 thùng (m³) từ mức này trở lên là "cồng kềnh" → 2 suất. */
export const BULKY_BOX_VOLUME = 0.03;
/** Giá sỉ so với đặt online (bù lại phải tự đi lấy). */
export const WHOLESALE_PRICE_FACTOR = 0.8;
/** Tầm tương tác với xe / chỗ lấy hàng sỉ (m) */
export const VEHICLE_REACH = 3.2;
/** Trôi / ma sát lăn khi nhả ga (m/s²) */
export const VEHICLE_DRAG = 2.2;
