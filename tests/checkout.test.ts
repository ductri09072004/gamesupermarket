import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/Random';
import { DENOMINATIONS } from '../src/config/constants';
import {
  changeDueCents, customerCashPayment, evaluateChange, optimalChange, settleSale, sumCents, toCents,
  type CheckoutItem,
} from '../src/systems/CheckoutSystem';

const items: CheckoutItem[] = [
  { productId: 'noodles', price: 0.75, cost: 0.5, scanned: true },
  { productId: 'rice', price: 2.6, cost: 1.8, scanned: true },
  { productId: 'oil', price: 10.05, cost: 2.5, scanned: true },
];

describe('Tính tiền thối', () => {
  it('ví dụ tổng 13.40 đưa 20 → thối 6.60', () => {
    expect(changeDueCents(13.4, 20)).toBe(660);
    expect(sumCents([5, 1, 0.2, 0.2, 0.2])).toBe(660);
  });

  it('tránh lỗi số thực', () => {
    expect(sumCents([0.1, 0.1, 0.1])).toBe(30);
    expect(changeDueCents(0.3, 1)).toBe(70);
  });

  it('chỉ còn tiền giấy: 200đ → 100.000đ', () => {
    expect(DENOMINATIONS).toEqual([100, 50, 20, 10, 5, 2, 1, 0.5, 0.2]);
  });

  it('đánh giá thối: đủ / lẻ dưới 200đ vẫn đúng / thiếu / thừa', () => {
    expect(evaluateChange(660, 660)).toEqual({ status: 'exact', diffCents: 0 });
    expect(evaluateChange(660, 650)).toEqual({ status: 'rounded', diffCents: 10 });
    expect(evaluateChange(660, 641)).toEqual({ status: 'rounded', diffCents: 19 });
    expect(evaluateChange(660, 640)).toEqual({ status: 'short', diffCents: 20 });
    expect(evaluateChange(660, 600)).toEqual({ status: 'short', diffCents: 60 });
    expect(evaluateChange(660, 700)).toEqual({ status: 'over', diffCents: 40 });
    // đơn lẻ: thối 150đ nhưng không có tờ nào nhỏ hơn 200đ → không thối cũng đúng
    expect(evaluateChange(15, 0).status).toBe('rounded');
  });

  it('thối tối ưu bằng tiền giấy, thiếu tối đa dưới 200đ', () => {
    expect(optimalChange(660)).toEqual([5, 1, 0.2, 0.2, 0.2]);
    expect(optimalChange(110)).toEqual([0.5, 0.2, 0.2, 0.2]);
    expect(optimalChange(0)).toEqual([]);
    for (let c = 0; c < 20000; c += 7) {
      const out = optimalChange(c);
      const sum = sumCents(out);
      expect(sum).toBeLessThanOrEqual(c);
      expect(c - sum).toBeLessThan(toCents(0.2));
      for (const d of out) expect(DENOMINATIONS).toContain(d);
    }
    // mọi bội của 200đ đều ghép đúng
    for (let c = 0; c < 20000; c += 20) expect(sumCents(optimalChange(c))).toBe(c);
  });

  it('khách đưa tiền ≥ tổng, bằng các tờ giấy ghép đúng', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const total = Math.round(rng() * 20000) / 100;
      const paid = customerCashPayment(total, rng);
      expect(toCents(paid)).toBeGreaterThanOrEqual(toCents(total));
      expect(sumCents(optimalChange(toCents(paid)))).toBe(toCents(paid));
    }
  });

  it('kết toán tiền mặt: thối thừa mất tiền, thối thiếu khách phàn nàn, lẻ dưới 200đ thì không', () => {
    const exact = settleSale(items, 20, 660);
    expect(exact).toMatchObject({ revenue: 13.4, netCash: 13.4, changeLoss: 0, shortChanged: false });
    const over = settleSale(items, 20, 700);
    expect(over.netCash).toBeCloseTo(13);
    expect(over.changeLoss).toBeCloseTo(0.4);
    const short = settleSale(items, 20, 600);
    expect(short.shortChanged).toBe(true);
    expect(short.cogs).toBeCloseTo(4.8);
    const rounded = settleSale(items, 20, 650);
    expect(rounded.shortChanged).toBe(false);
    expect(rounded.changeLoss).toBe(0);
  });
});
