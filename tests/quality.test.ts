import { describe, expect, it } from 'vitest';
import { activeQuality, nextLighter, QUALITY_PROFILES, setActiveQuality } from '../src/config/quality';

describe('chất lượng đồ hoạ', () => {
  const order = ['lite', 'low', 'medium', 'high'] as const;

  it('mỗi mức nhẹ hơn mức trên: độ phân giải, bóng, hậu kỳ, số xe / người / khách không tăng ngược', () => {
    for (let i = 1; i < order.length; i++) {
      const a = QUALITY_PROFILES[order[i - 1]];
      const b = QUALITY_PROFILES[order[i]];
      expect(a.pixelRatio).toBeLessThanOrEqual(b.pixelRatio);
      expect(a.shadowMap).toBeLessThanOrEqual(b.shadowMap);
      expect(a.traffic).toBeLessThanOrEqual(b.traffic);
      expect(a.crowd).toBeLessThanOrEqual(b.crowd);
      expect(a.maxCustomers).toBeLessThanOrEqual(b.maxCustomers);
      expect(a.farPlane).toBeLessThanOrEqual(b.farPlane);
      expect(a.fogScale).toBeLessThanOrEqual(b.fogScale);
      expect(Number(a.gtao)).toBeLessThanOrEqual(Number(b.gtao));
      expect(Number(a.shadows)).toBeLessThanOrEqual(Number(b.shadows));
      expect(Number(a.pointLights)).toBeLessThanOrEqual(Number(b.pointLights));
    }
  });

  it('siêu nhẹ: không bóng, không đèn điểm, không bloom / AO, nhưng vẫn độ phân giải thật và có khử răng cưa', () => {
    const p = QUALITY_PROFILES.lite;
    expect(p.bloom || p.gtao).toBe(false);
    expect(p.shadows || p.pointLights).toBe(false);
    expect(p.pixelRatio).toBeGreaterThanOrEqual(1);
    expect(p.smaa || p.fxaa).toBe(true);
    expect(p.farPlane).toBeLessThan(QUALITY_PROFILES.low.farPlane);
    // sương mù phải kín trước khi tới mặt phẳng cắt xa (khỏi thấy nhà "biến mất" đột ngột)
    expect(120 * p.fogScale).toBeLessThan(p.farPlane);
  });

  it('mức đang dùng và gợi ý hạ mức', () => {
    setActiveQuality('lite');
    expect(activeQuality()).toBe(QUALITY_PROFILES.lite);
    setActiveQuality('medium');
    expect(nextLighter('high')).toBe('medium');
    expect(nextLighter('low')).toBe('lite');
    expect(nextLighter('lite')).toBeNull();
  });
});
