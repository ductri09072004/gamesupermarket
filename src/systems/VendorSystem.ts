import { INCENSE } from '../config/constants';
import { vendorsPackUp } from './WeatherSystem';
import {
  VENDOR_CHEAP, VENDOR_GOODS, VENDOR_HOURS, VENDOR_TAKE, VENDOR_TAKE_CHEAP, WALKING_VENDOR, type VendorShift,
} from '../config/city';

/** Sạp hàng rong đang bán món này vào giờ `hour` (null nếu không có sạp nào cạnh tranh; trời mưa thì sạp đã dọn về). */
export function competingShift(productId: string, hour: number, rain = 0): VendorShift | null {
  if (vendorsPackUp(rain)) return null;
  for (const [shift, v] of Object.entries(VENDOR_GOODS) as Array<[VendorShift, (typeof VENDOR_GOODS)[VendorShift]]>) {
    const [from, to] = VENDOR_HOURS[shift];
    if (hour >= from && hour < to && v.goods.includes(productId)) return shift;
  }
  return null;
}

/** Gánh hàng rong đi bộ ra phố vào các khung giờ này (mưa thì nghỉ). */
export function walkingVendorsOut(hour: number, rain = 0): boolean {
  return !vendorsPackUp(rain) && WALKING_VENDOR.hours.some(([a, b]) => hour >= a && hour < b);
}

/** Câu khách nói nếu gánh hàng rong đang đi ngang cửa hàng bán đúng món này (null = không cạnh tranh). */
export function walkingVendorSays(productId: string, near: boolean): string | null {
  return near && WALKING_VENDOR.goods.includes(productId) ? WALKING_VENDOR.say : null;
}

/** Xác suất khách bỏ món để mua ngoài sạp: bán rẻ hơn giá thị trường thì giữ được phần lớn khách. */
export function vendorTakeChance(price: number, market: number): number {
  return price <= market * VENDOR_CHEAP ? VENDOR_TAKE_CHEAP : VENDOR_TAKE;
}

/** Đã thắp nhang Thần Tài hôm nay chưa. */
export function incenseLitToday(incense: { day: number; hour: number } | undefined, day: number): boolean {
  return !!incense && incense.day === day;
}

/** Nhang còn cháy (hiện khói) — trong INCENSE.burnHours giờ kể từ lúc thắp. */
export function incenseBurning(incense: { day: number; hour: number } | undefined, day: number, hour: number): boolean {
  return incenseLitToday(incense, day) && hour - incense!.hour < INCENSE.burnHours;
}
