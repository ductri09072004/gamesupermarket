import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/Random';
import {
  changeDueCents, customerCashPayment, evaluateChange, optimalChange, posInput, settleSale, sumCents, toCents,
  verifyCardInput, type CheckoutItem,
} from '../src/systems/CheckoutSystem';

const items: CheckoutItem[] = [
  { productId: 'noodles', price: 0.75, cost: 0.5, scanned: true },
  { productId: 'rice', price: 2.6, cost: 1.8, scanned: true },
  { productId: 'oil', price: 10.05, cost: 2.5, scanned: true },
];

describe('Tính tiền thối', () => {
  it('ví dụ tổng 13.40 đưa 20 → thối 6.60', () => {
    expect(changeDueCents(13.4, 20)).toBe(660);
    expect(sumCents([5, 1, 0.25, 0.25, 0.1])).toBe(660);
  });

  it('tránh lỗi số thực', () => {
    expect(sumCents([0.1, 0.1, 0.1])).toBe(30);
    expect(changeDueCents(0.3, 1)).toBe(70);
  });

  it('đánh giá thối đủ / thiếu / thừa', () => {
    expect(evaluateChange(660, 660)).toEqual({ status: 'exact', diffCents: 0 });
    expect(evaluateChange(660, 600)).toEqual({ status: 'short', diffCents: 60 });
    expect(evaluateChange(660, 700)).toEqual({ status: 'over', diffCents: 40 });
  });

  it('thối tối ưu bằng mệnh giá', () => {
    expect(optimalChange(660)).toEqual([5, 1, 0.25, 0.25, 0.1]);
    expect(optimalChange(0)).toEqual([]);
    for (let c = 0; c < 10000; c += 37) expect(sumCents(optimalChange(c))).toBe(c);
  });

  it('khách đưa tiền ≥ tổng', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const total = Math.round(rng() * 20000) / 100;
      expect(toCents(customerCashPayment(total, rng))).toBeGreaterThanOrEqual(toCents(total));
    }
  });

  it('kết toán tiền mặt: thối thừa mất tiền, thối thiếu khách phàn nàn', () => {
    const exact = settleSale(items, 'cash', 20, 660);
    expect(exact).toMatchObject({ revenue: 13.4, netCash: 13.4, changeLoss: 0, shortChanged: false });
    const over = settleSale(items, 'cash', 20, 700);
    expect(over.netCash).toBeCloseTo(13);
    expect(over.changeLoss).toBeCloseTo(0.4);
    const short = settleSale(items, 'cash', 20, 600);
    expect(short.shortChanged).toBe(true);
    expect(short.cogs).toBeCloseTo(4.8);
  });

  it('thẻ: gõ đúng số tiền', () => {
    expect(verifyCardInput('13.40', 13.4)).toBe(true);
    expect(verifyCardInput('13.4', 13.4)).toBe(true);
    expect(verifyCardInput('13.41', 13.4)).toBe(false);
    expect(verifyCardInput('abc', 13.4)).toBe(false);
    expect(settleSale(items, 'card', 0, 0).netCash).toBe(13.4);
  });

  it('bàn phím POS', () => {
    let s = '';
    for (const k of ['1', '3', '.', '4', '0', '5']) s = posInput(s, k);
    expect(s).toBe('13.40');
    expect(posInput(s, 'back')).toBe('13.4');
    expect(posInput('', '.')).toBe('0.');
    expect(posInput('1.2', '.')).toBe('1.2');
    expect(posInput('abc', 'clear')).toBe('');
  });
});
