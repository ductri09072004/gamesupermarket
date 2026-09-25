import {
  SELF_HELP_BASE, SELF_HELP_ELDER, SELF_HELP_MAX, SELF_HELP_PER_ITEM, SELF_QUEUE_BIAS,
} from '../config/constants';
import type { Rng } from '../core/Random';

/** Xác suất khách không biết dùng máy tự tính tiền: nhiều món / lớn tuổi thì dễ bí hơn. */
export function helpChance(itemCount: number, elder: boolean): number {
  const p = SELF_HELP_BASE + SELF_HELP_PER_ITEM * Math.max(0, itemCount) + (elder ? SELF_HELP_ELDER : 0);
  return Math.min(SELF_HELP_MAX, p);
}

/**
 * Tung xúc xắc lúc khách bắt đầu tự quét: trả về vị trí món khách bị bí (0..n-1), -1 nếu tự làm được hết.
 * Món bị bí rơi ngẫu nhiên — có khi ngay món đầu, có khi giữa chừng.
 */
export function rollHelpIndex(itemCount: number, elder: boolean, rng: Rng): number {
  if (itemCount <= 0) return -1;
  if (rng() >= helpChance(itemCount, elder)) return -1;
  return Math.min(itemCount - 1, Math.floor(rng() * itemCount));
}

export interface CheckoutOption {
  uid: string;
  queueLen: number;
  self: boolean;
}

/** Khách chọn hàng ngắn nhất; máy tự tính bị cộng thêm SELF_QUEUE_BIAS (khách hơi thích quầy có người). */
export function chooseCheckout(options: CheckoutOption[]): string | null {
  let best: CheckoutOption | null = null;
  let bestScore = Infinity;
  for (const o of options) {
    const score = o.queueLen + (o.self ? SELF_QUEUE_BIAS : 0);
    if (score < bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best?.uid ?? null;
}
