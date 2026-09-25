import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/config/products';
import { buyProbability, clampPrice, decidePurchase, isLoss, marketPriceOn, profitMargin } from '../src/systems/PricingSystem';

describe('PricingSystem', () => {
  it('xác suất mua theo ratio', () => {
    expect(buyProbability(0.5)).toBe(1);
    expect(buyProbability(1)).toBe(1);
    expect(buyProbability(1.25)).toBeCloseTo(0.6);
    expect(buyProbability(1.5)).toBeCloseTo(0.2);
    expect(buyProbability(1.51)).toBe(0);
    expect(buyProbability(3)).toBe(0);
    for (let r = 1; r < 1.5; r += 0.05) expect(buyProbability(r + 0.05)).toBeLessThan(buyProbability(r) + 1e-9);
  });

  it('quyết định mua', () => {
    expect(decidePurchase(1, 1, 0.99)).toBe('buy');
    expect(decidePurchase(1.6, 1, 0)).toBe('expensive');
    expect(decidePurchase(1.4, 1, 0.9)).toBe('skip');
    expect(decidePurchase(1.4, 1, 0.1)).toBe('buy');
  });

  it('giá thị trường dao động ±5%, xác định theo seed + ngày', () => {
    for (const p of PRODUCTS) {
      for (let day = 1; day < 20; day++) {
        const m = marketPriceOn(p, day, 42);
        expect(m).toBeGreaterThanOrEqual(p.marketPrice * 0.95 - 0.01);
        expect(m).toBeLessThanOrEqual(p.marketPrice * 1.05 + 0.01);
        expect(marketPriceOn(p, day, 42)).toBe(m);
      }
    }
  });

  it('dữ liệu sản phẩm hợp lệ', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(42);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const p of PRODUCTS) {
      expect(p.costPerUnit).toBeGreaterThanOrEqual(0.5);
      expect(p.costPerUnit).toBeLessThanOrEqual(8);
      expect(p.marketPrice / p.costPerUnit).toBeGreaterThanOrEqual(1.3);
      expect(p.marketPrice / p.costPerUnit).toBeLessThanOrEqual(1.6);
      expect(p.unitsPerBox).toBeGreaterThanOrEqual(6);
      expect(p.unitsPerBox).toBeLessThanOrEqual(24);
    }
  });

  it('lợi nhuận và cảnh báo lỗ', () => {
    expect(profitMargin(1.5, 1)).toBeCloseTo(0.5);
    expect(isLoss(0.9, 1)).toBe(true);
    expect(clampPrice(-3)).toBe(0.01);
    expect(clampPrice(1.234)).toBe(1.23);
  });
});
