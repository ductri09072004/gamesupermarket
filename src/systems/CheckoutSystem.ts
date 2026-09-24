import { DENOMINATIONS } from '../config/constants';
import type { Rng } from '../core/Random';

export const toCents = (x: number): number => Math.round(x * 100);
export const fromCents = (c: number): number => c / 100;

export interface CheckoutItem {
  productId: string;
  price: number;
  cost: number;
  scanned: boolean;
}

export type PaymentMethod = 'cash' | 'card';

/** Số tiền khách đưa khi trả tiền mặt. */
export function customerCashPayment(total: number, rng: Rng): number {
  const c = toCents(total);
  const roll = rng();
  if (roll < 0.12) return fromCents(c);
  if (roll < 0.35) return fromCents(Math.ceil(c / 100) * 100 + (c % 100 === 0 ? 100 : 0));
  const bills = [5, 10, 20, 50, 100].map((b) => b * 100).filter((b) => b > c);
  if (bills.length === 0) return fromCents(Math.ceil(c / 10000) * 10000);
  return fromCents(roll < 0.7 ? bills[0] : bills[Math.min(1, bills.length - 1)]);
}

export function changeDueCents(total: number, paid: number): number {
  return Math.max(0, toCents(paid) - toCents(total));
}

export function sumCents(values: number[]): number {
  return values.reduce((a, v) => a + toCents(v), 0);
}

export type ChangeStatus = 'exact' | 'short' | 'over';

export function evaluateChange(dueCents: number, givenCents: number): { status: ChangeStatus; diffCents: number } {
  const diff = givenCents - dueCents;
  if (diff === 0) return { status: 'exact', diffCents: 0 };
  return { status: diff < 0 ? 'short' : 'over', diffCents: Math.abs(diff) };
}

/** Thối tiền tối ưu (tham lam) — dùng cho thu ngân NPC và gợi ý. */
export function optimalChange(cents: number): number[] {
  const out: number[] = [];
  let rest = cents;
  for (const d of DENOMINATIONS) {
    const dc = toCents(d);
    while (rest >= dc) {
      out.push(d);
      rest -= dc;
    }
  }
  return out;
}

/** Kiểm tra số người chơi gõ vào máy POS. */
export function verifyCardInput(input: string, total: number): boolean {
  const s = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return false;
  return toCents(parseFloat(s)) === toCents(total);
}

/** Nhập ký tự vào bàn phím POS, giữ tối đa 2 chữ số thập phân. */
export function posInput(current: string, key: string): string {
  if (key === 'clear') return '';
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : (current || '0') + '.';
  if (!/^\d$/.test(key)) return current;
  const dot = current.indexOf('.');
  if (dot >= 0 && current.length - dot > 2) return current;
  if (current === '0') return key;
  if (current.length >= 8) return current;
  return current + key;
}

export interface SaleResult {
  revenue: number;
  cogs: number;
  netCash: number;
  changeLoss: number;
  shortChanged: boolean;
}

/** Tính kết quả giao dịch. netCash = tiền thực nhận vào két. */
export function settleSale(
  items: CheckoutItem[],
  method: PaymentMethod,
  paid: number,
  changeGivenCents: number,
): SaleResult {
  const revenueC = items.reduce((a, i) => a + toCents(i.price), 0);
  const cogs = items.reduce((a, i) => a + i.cost, 0);
  if (method === 'card') {
    return { revenue: fromCents(revenueC), cogs, netCash: fromCents(revenueC), changeLoss: 0, shortChanged: false };
  }
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
