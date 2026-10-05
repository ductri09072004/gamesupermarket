import { describe, expect, it } from 'vitest';
import { STREET_NAMES } from '../src/config/city';
import { cityLayout, rectsOverlap } from '../src/world/CityLayout';

describe('biển tên đường & số hẻm', () => {
  const L = cityLayout(10, 12);
  const { plates, posts } = L.signs;
  const streetNames = new Set(plates.filter((p) => p.style === 'street').map((p) => p.line2));

  it('có cột biển ở ngã tư và đầu đường, ghi đủ tên các con đường', () => {
    for (const n of [...STREET_NAMES.horizontal, ...STREET_NAMES.vertical]) expect(streetNames.has(n), n).toBe(true);
    expect(posts.length).toBeGreaterThanOrEqual(12);
    // mỗi cột có biển và không đè vật cản khác
    for (const p of posts) {
      expect(plates.some((q) => q.double && q.x === p.x && q.z === p.z)).toBe(true);
      const r = { x0: p.x - 0.1, x1: p.x + 0.1, z0: p.z - 0.1, z1: p.z + 0.1 };
      for (const c of L.colliders) {
        if (c.tag === 'sign') continue;
        expect(rectsOverlap({ x0: c.minX, x1: c.maxX, z0: c.minZ, z1: c.maxZ }, r), `cột biển đè ${c.tag}`).toBe(false);
      }
    }
  });

  it('mỗi hẻm có biển "HẺM n" ở đầu hẻm (kèm tên đường), ngõ nhánh có "HẺM n/k"', () => {
    const alleyPlates = plates.filter((p) => p.style === 'alley');
    const mouths = L.alleys.filter((a) => a.axis === 'z').length;
    expect(alleyPlates.filter((p) => /^HẺM \d+$/.test(p.line1) && p.line2).length).toBeGreaterThanOrEqual(mouths);
    expect(alleyPlates.some((p) => /^HẺM \d+\/\d+$/.test(p.line1))).toBe(true);
    for (const p of alleyPlates) expect(p.w).toBeLessThan(0.8);
  });
});
