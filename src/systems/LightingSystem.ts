import { getFurniture } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';

/** Mức "đêm" theo giờ: 0 ban ngày → 1 tối hẳn (bình minh 8h hơi tối, hoàng hôn 16h30–20h). */
export function nightAt(hour: number): number {
  if (hour < 9) return Math.max(0, 0.35 * (9 - hour));
  if (hour < 16.5) return 0;
  if (hour < 18.5) return ((hour - 16.5) / 2) * 0.3;
  if (hour < 20) return 0.3 + ((hour - 18.5) / 1.5) * 0.7;
  return 1;
}

/** Tỉ lệ diện tích sàn cửa hàng được đèn trần phủ sáng (có thể > 1). */
export function lampCoverage(furniture: FurnitureData[], storeW: number, storeH: number): number {
  const area = furniture.reduce((a, f) => a + (getFurniture(f.type).light?.area ?? 0), 0);
  return area / Math.max(1, storeW * storeH);
}

/** Độ sáng do đèn (0..1): tăng theo căn bậc hai độ phủ — vài đèn đầu tiên tạo khác biệt lớn nhất. */
export function interiorLight(lightsOn: boolean, coverage: number): number {
  return lightsOn ? Math.sqrt(Math.min(1, Math.max(0, coverage))) : 0;
}

/** Độ sáng cảm nhận trong cửa hàng: ánh ngày lọt qua mặt kính hoặc đèn, cái nào mạnh hơn. */
export function storeBrightness(night: number, interior: number): number {
  return Math.max((1 - night) * 0.9, interior);
}
