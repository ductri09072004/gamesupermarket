import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/config/products';
import { mulberry32 } from '../src/core/Random';
import { generateWishlist, peakFactor, spawnRatePerHour, SpawnAccumulator } from '../src/systems/CustomerSystem';

describe('CustomerSystem', () => {
  it('giờ cao điểm đông khách hơn', () => {
    expect(peakFactor(12)).toBeGreaterThan(peakFactor(15));
    expect(peakFactor(18)).toBeGreaterThan(peakFactor(15));
    expect(spawnRatePerHour(12, 5, 12, 10)).toBeGreaterThan(spawnRatePerHour(12, 1, 12, 10));
    expect(spawnRatePerHour(15, 3, 24, 20)).toBeGreaterThan(spawnRatePerHour(15, 3, 12, 10));
  });

  it('wishlist 1–6 món, chỉ sản phẩm đã mở khoá, không trùng', () => {
    const rng = mulberry32(7);
    const basic = PRODUCTS.filter((p) => p.licenseId === 0);
    for (let i = 0; i < 200; i++) {
      const w = generateWishlist(basic, ['noodles'], rng);
      expect(w.length).toBeGreaterThanOrEqual(1);
      expect(w.length).toBeLessThanOrEqual(6);
      expect(new Set(w.map((x) => x.productId)).size).toBe(w.length);
      for (const x of w) expect(basic.some((p) => p.id === x.productId)).toBe(true);
    }
  });

  it('bộ tích luỹ sinh khách xấp xỉ tốc độ', () => {
    const acc = new SpawnAccumulator(mulberry32(1));
    let n = 0;
    for (let i = 0; i < 600; i++) n += acc.tick(1, 6);
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(80);
  });
});
