import { describe, expect, it } from 'vitest';
import { SELF_HELP_BASE, SELF_HELP_ELDER, SELF_HELP_MAX, SELF_HELP_PER_ITEM } from '../src/config/constants';
import { getFurniture } from '../src/config/furniture';
import { mulberry32 } from '../src/core/Random';
import { makeFurniture } from '../src/core/GameState';
import { chooseCheckout, helpChance, rollHelpIndex } from '../src/systems/SelfCheckoutSystem';
import { requiredTargets } from '../src/systems/BuildSystem';

describe('máy tự tính tiền', () => {
  it('xác suất cần hỗ trợ tăng theo số món, khách lớn tuổi, có trần', () => {
    expect(helpChance(1, false)).toBeCloseTo(SELF_HELP_BASE + SELF_HELP_PER_ITEM);
    expect(helpChance(4, false)).toBeGreaterThan(helpChance(1, false));
    expect(helpChance(2, true)).toBeCloseTo(SELF_HELP_BASE + 2 * SELF_HELP_PER_ITEM + SELF_HELP_ELDER);
    expect(helpChance(50, true)).toBe(SELF_HELP_MAX);
  });

  it('rollHelpIndex trả vị trí món hợp lệ hoặc -1, tỉ lệ khớp xác suất', () => {
    const rng = mulberry32(42);
    let helped = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const k = rollHelpIndex(3, false, rng);
      expect(k).toBeGreaterThanOrEqual(-1);
      expect(k).toBeLessThan(3);
      if (k >= 0) helped++;
    }
    expect(helped / N).toBeCloseTo(helpChance(3, false), 1);
    expect(rollHelpIndex(0, true, rng)).toBe(-1);
  });

  it('khách chọn hàng ngắn nhất, hơi ưu tiên quầy có người', () => {
    expect(chooseCheckout([])).toBeNull();
    expect(chooseCheckout([{ uid: 'k', queueLen: 0, self: true }, { uid: 'c', queueLen: 0, self: false }])).toBe('c');
    expect(chooseCheckout([{ uid: 'k', queueLen: 0, self: true }, { uid: 'c', queueLen: 1, self: false }])).toBe('k');
    expect(chooseCheckout([{ uid: 'k', queueLen: 2, self: true }])).toBe('k');
  });

  it('build: ô khách đứng trước máy phải đi tới được', () => {
    const def = getFurniture('self_checkout');
    expect(def.kind).toBe('selfcheckout');
    expect(def.footprint).toEqual({ w: 2, h: 2 });
    const targets = requiredTargets([makeFurniture('k1', 'self_checkout', 4, 4, 0)], null);
    expect(targets).toEqual([[{ gx: 5, gy: 6 }]]);
  });
});
