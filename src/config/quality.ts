import type { Quality } from '../core/GameState';

/**
 * Mọi thông số chất lượng đồ hoạ theo mức (Siêu nhẹ → Cao). Mọi mức đều dựng ở độ phân giải thật và có khử răng cưa;
 * siêu nhẹ chỉ bỏ bóng, đèn điểm, bloom, giảm xe / người / khách và tầm dựng phố.
 */
export interface QualityProfile {
  /** Tỉ lệ điểm ảnh tối đa (không vượt độ phân giải thật của màn hình) */
  pixelRatio: number;
  /** Cạnh bản đồ bóng (px); shadows = false → không đổ bóng thật */
  shadowMap: number;
  shadows: boolean;
  gtao: boolean;
  bloom: boolean;
  smaa: boolean;
  fxaa: boolean;
  /** Tầm nhìn xa (m) và hệ số nhân sương mù — gần hơn thì bớt phải vẽ thành phố phía xa */
  farPlane: number;
  fogScale: number;
  /** Đèn điểm cục bộ (vũng sáng dưới đèn, đèn đường ban đêm) */
  pointLights: boolean;
  /** Hệ số nhân số xe cộ và người đi bộ */
  traffic: number;
  crowd: number;
  /** Số khách tối đa cùng lúc */
  maxCustomers: number;
  /** Chỉ dựng nhà / cây / đèn trong bán kính này quanh cửa hàng (m) — xa hơn đã chìm trong sương mù */
  cityRadius: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  lite: { pixelRatio: 1, shadowMap: 512, shadows: false, gtao: false, bloom: false, smaa: true, fxaa: false, farPlane: 80, fogScale: 0.6, pointLights: false, traffic: 0.3, crowd: 0.3, maxCustomers: 10, cityRadius: 70 },
  low: { pixelRatio: 1, shadowMap: 512, shadows: true, gtao: false, bloom: false, smaa: false, fxaa: true, farPlane: 200, fogScale: 1, pointLights: true, traffic: 0.7, crowd: 0.7, maxCustomers: 25, cityRadius: Infinity },
  medium: { pixelRatio: 1.5, shadowMap: 1024, shadows: true, gtao: false, bloom: true, smaa: true, fxaa: false, farPlane: 200, fogScale: 1, pointLights: true, traffic: 1, crowd: 1, maxCustomers: 25, cityRadius: Infinity },
  high: { pixelRatio: 2, shadowMap: 2048, shadows: true, gtao: true, bloom: true, smaa: true, fxaa: false, farPlane: 200, fogScale: 1, pointLights: true, traffic: 1, crowd: 1, maxCustomers: 25, cityRadius: Infinity },
};

let current: Quality = 'medium';

/** Mức đang dùng (Renderer đặt khi đổi chất lượng); các hệ thống game đọc để co giãn số xe, người, đèn. */
export function setActiveQuality(q: Quality): void {
  current = q;
}

export function activeQuality(): QualityProfile {
  return QUALITY_PROFILES[current];
}

/** Bật đủ mọi hiệu ứng nặng? (dùng để quyết định gợi ý hạ chất lượng khi máy chậm) */
export function nextLighter(q: Quality): Quality | null {
  return ({ high: 'medium', medium: 'low', low: 'lite', lite: null } as const)[q];
}
