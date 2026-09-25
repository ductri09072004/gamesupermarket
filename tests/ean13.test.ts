import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/config/products';
import { checkDigit, eanBits, eanFromId } from '../src/products/Ean13';

describe('Mã vạch EAN-13', () => {
  it('check digit đúng chuẩn', () => {
    expect(checkDigit('400638133393')).toBe(1); // 4006381333931
    expect(checkDigit('893604000001')).toBe(9);
  });

  it('mã hoá 95 module với vạch bảo vệ', () => {
    const bits = eanBits('4006381333931');
    expect(bits).toHaveLength(95);
    expect(bits.startsWith('101')).toBe(true);
    expect(bits.endsWith('101')).toBe(true);
    expect(bits.slice(45, 50)).toBe('01010');
  });

  it('mỗi sản phẩm có mã riêng, hợp lệ', () => {
    const codes = PRODUCTS.map((p) => eanFromId(p.id));
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) {
      expect(c).toMatch(/^893\d{10}$/);
      expect(Number(c[12])).toBe(checkDigit(c.slice(0, 12)));
    }
  });
});
