import { getProduct } from './products';

/** Thùng carton giao hàng có 3 cỡ theo thể tích hàng bên trong: nhỏ (s), vừa (m), lớn (l). */
export type BoxClass = 's' | 'm' | 'l';

/**
 * Mỗi cỡ dựng từ 1 hộp trong public/assets/models/props/boxes.glb (kích thước gốc, m) phóng đều k lần.
 * Phóng đều để hoạ tiết, băng keo, chữ in trên hộp không bị méo.
 */
const BASE: Record<BoxClass, { node: string; size: [number, number, number]; k: number }> = {
  s: { node: 'box_s', size: [0.29, 0.17, 0.19], k: 1.3 },
  m: { node: 'box_xl', size: [0.43, 0.21, 0.27], k: 1.25 },
  l: { node: 'box_l', size: [0.4, 0.29, 0.29], k: 1.5 },
};

/** Ngưỡng thể tích hàng trong thùng (m³): dưới small → cỡ nhỏ, từ large trở lên → cỡ lớn. */
export const BOX_CLASS_VOLUME = { small: 0.022, large: 0.05 };

export interface BoxDims {
  cls: BoxClass;
  /** Tên nút trong boxes.glb */
  node: string;
  /** Hệ số phóng của model so với hộp gốc */
  k: number;
  w: number;
  h: number;
  d: number;
}

/** Ô xếp thùng trên thùng xe (m): thùng cỡ lớn hơn được thu nhỏ cho vừa ô khi nằm trên xe. */
export const CARGO_SLOT = { w: 0.46, h: 0.3, d: 0.36 };

export function boxClassOf(productId: string): BoxClass {
  const p = getProduct(productId);
  const v = p.size[0] * p.size[1] * p.size[2] * p.unitsPerBox;
  return v < BOX_CLASS_VOLUME.small ? 's' : v < BOX_CLASS_VOLUME.large ? 'm' : 'l';
}

/** Kích thước thùng (m): rộng X, cao Y, sâu Z — dùng cho model, vật lý, xếp chồng, đặt xuống sàn. */
export function boxDims(productId: string): BoxDims {
  const cls = boxClassOf(productId);
  const b = BASE[cls];
  return { cls, node: b.node, k: b.k, w: b.size[0] * b.k, h: b.size[1] * b.k, d: b.size[2] * b.k };
}
