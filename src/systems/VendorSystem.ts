import { INCENSE } from '../config/constants';
import {
  VENDOR_CHEAP, VENDOR_GOODS, VENDOR_HOURS, VENDOR_TAKE, VENDOR_TAKE_CHEAP, type VendorShift,
} from '../config/city';

/** Sạp hàng rong đang bán món này vào giờ `hour` (null nếu không có sạp nào cạnh tranh). */
export function competingShift(productId: string, hour: number): VendorShift | null {
  for (const [shift, v] of Object.entries(VENDOR_GOODS) as Array<[VendorShift, (typeof VENDOR_GOODS)[VendorShift]]>) {
    const [from, to] = VENDOR_HOURS[shift];
    if (hour >= from && hour < to && v.goods.includes(productId)) return shift;
  }
  return null;
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
