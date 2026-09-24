import {
  FAST_CHECKOUT_S, REP_FAST_CHECKOUT, REP_NORMAL_CHECKOUT, REP_SHORT_CHANGE, REP_SLOW_CHECKOUT, SLOW_CHECKOUT_S,
  XP_PER_REVENUE,
} from '../config/constants';
import type { Services } from '../core/Services';
import { formatMoney, round2 } from '../core/Random';
import { settleSale, type CheckoutItem, type PaymentMethod, type SaleResult } from './CheckoutSystem';

export function checkoutReputation(durationS: number): number {
  if (durationS <= FAST_CHECKOUT_S) return REP_FAST_CHECKOUT;
  if (durationS >= SLOW_CHECKOUT_S) return REP_SLOW_CHECKOUT;
  return REP_NORMAL_CHECKOUT;
}

/** Hoàn tất một giao dịch ở quầy (dùng cho cả người chơi và thu ngân NPC). */
export function completeSale(
  s: Services,
  customerId: string,
  items: CheckoutItem[],
  method: PaymentMethod,
  paid: number,
  changeGivenCents: number,
  durationS: number,
  at: { gx: number; gy: number },
): SaleResult {
  const r = settleSale(items, method, paid, changeGivenCents);
  s.economy.addMoney(r.netCash, method === 'card' ? 'Bán hàng (thẻ)' : 'Bán hàng (tiền mặt)');
  s.economy.recordSale(r.revenue, r.cogs, items.length);
  if (r.changeLoss > 0) {
    s.data.stats.changeLoss = round2(s.data.stats.changeLoss + r.changeLoss);
    s.bus.emit('toast', { message: `Thối dư ${formatMoney(r.changeLoss)} — mất tiền chênh lệch`, kind: 'error' });
  }
  if (r.shortChanged) {
    s.progression.changeReputation(REP_SHORT_CHANGE);
    s.bus.emit('toast', { message: '😠 Khách phàn nàn: thối thiếu tiền!', kind: 'error' });
  } else {
    s.progression.changeReputation(checkoutReputation(durationS));
  }
  s.progression.addXp(r.revenue * XP_PER_REVENUE);
  s.bus.emit('sale', { amount: r.revenue, gx: at.gx, gy: at.gy });
  s.bus.emit('sound', { name: 'ching' });
  s.bus.emit('customer:checkout', { customerId, amount: r.revenue });
  return r;
}
