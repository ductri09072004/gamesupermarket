import { DENOMINATIONS, MIN_NOTE } from '../config/constants';
import type { Rng } from '../core/Random';

export const toCents = (x: number): number => Math.round(x * 100);
export const fromCents = (c: number): number => c / 100;

export interface CheckoutItem {
  productId: string;
  price: number;
  cost: number;
  scanned: boolean;
}

/** Số tiền khách đưa (luôn là tổng các tờ giấy, không bao giờ nhỏ hơn đơn hàng). */
export function customerCashPayment(total: number, rng: Rng): number {
  const c = toCents(total);
  const note = toCents(MIN_NOTE);
  const roll = rng();
  // đưa vừa đủ: đơn lẻ dưới 200đ thì làm tròn lên tờ nhỏ nhất
  if (roll < 0.12) return fromCents(Math.ceil(c / note) * note);
  if (roll < 0.35) return fromCents(Math.ceil(c / 100) * 100 + (c % 100 === 0 ? 100 : 0));
  const bills = [2, 5, 10, 20, 50, 100].map((b) => b * 100).filter((b) => b > c);
  if (bills.length === 0) return fromCents(Math.ceil(c / 10000) * 10000);
  return fromCents(roll < 0.7 ? bills[0] : bills[Math.min(1, bills.length - 1)]);
}

export function changeDueCents(total: number, paid: number): number {
  return Math.max(0, toCents(paid) - toCents(total));
}

export function sumCents(values: number[]): number {
  return values.reduce((a, v) => a + toCents(v), 0);
}

/** exact: đúng từng đồng · rounded: thiếu dưới 200đ (lẻ không có tiền để thối, vẫn đúng) · short: thiếu · over: dư */
export type ChangeStatus = 'exact' | 'rounded' | 'short' | 'over';

export function evaluateChange(dueCents: number, givenCents: number): { status: ChangeStatus; diffCents: number } {
  const diff = givenCents - dueCents;
  if (diff === 0) return { status: 'exact', diffCents: 0 };
  if (diff > 0) return { status: 'over', diffCents: diff };
  return { status: -diff < toCents(MIN_NOTE) ? 'rounded' : 'short', diffCents: -diff };
}

/** Các tờ lớn (≥ 5.000đ) chia hết cho nhau nên tham lam là tối ưu; phần còn lại < 5.000đ giải bằng quy hoạch động. */
const BIG = DENOMINATIONS.filter((d) => d >= 5);
const SMALL = DENOMINATIONS.filter((d) => d < 5);

/**
 * Bộ tờ tiền nhiều nhất không vượt `cents` và ít tờ nhất — dùng cho thu ngân NPC, tiền khách đưa và gợi ý.
 * Tổng có thể thiếu một chút (dưới 200đ) nếu số tiền không ghép nổi từ các mệnh giá.
 */
export function optimalChange(cents: number): number[] {
  const out: number[] = [];
  let rest = cents;
  for (const d of BIG) {
    const dc = toCents(d);
    while (rest >= dc) {
      out.push(d);
      rest -= dc;
    }
  }
  // quy hoạch động theo bước 100đ (10 "cent") cho phần còn lại < 5.000đ
  const step = 10;
  const n = Math.floor(rest / step);
  const small = SMALL.map((d) => ({ d, k: Math.round(toCents(d) / step) }));
  const best: number[] = Array(n + 1).fill(Infinity);
  const from: number[] = Array(n + 1).fill(-1);
  best[0] = 0;
  for (let v = 1; v <= n; v++) {
    small.forEach(({ k }, i) => {
      if (v >= k && best[v - k] + 1 < best[v]) {
        best[v] = best[v - k] + 1;
        from[v] = i;
      }
    });
  }
  let v = n;
  while (v > 0 && !Number.isFinite(best[v])) v--;
  while (v > 0) {
    const i = from[v];
    out.push(small[i].d);
    v -= small[i].k;
  }
  return out.sort((a, b) => b - a);
}

export interface SaleResult {
  revenue: number;
  cogs: number;
  netCash: number;
  changeLoss: number;
  shortChanged: boolean;
}

/** Tính kết quả giao dịch tiền mặt. netCash = tiền thực nhận vào két. */
export function settleSale(items: CheckoutItem[], paid: number, changeGivenCents: number): SaleResult {
  const revenueC = items.reduce((a, i) => a + toCents(i.price), 0);
  const cogs = items.reduce((a, i) => a + i.cost, 0);
  const due = Math.max(0, toCents(paid) - revenueC);
  const ev = evaluateChange(due, changeGivenCents);
  return {
    revenue: fromCents(revenueC),
    cogs,
    netCash: fromCents(toCents(paid) - changeGivenCents),
    changeLoss: ev.status === 'over' ? fromCents(ev.diffCents) : 0,
    shortChanged: ev.status === 'short',
  };
}

export function itemsTotal(items: CheckoutItem[]): number {
  return fromCents(items.reduce((a, i) => a + toCents(i.price), 0));
}
