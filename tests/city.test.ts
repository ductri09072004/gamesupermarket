import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/config/city';
import { MAX_STORE_H, MAX_STORE_W, WAREHOUSE } from '../src/config/constants';
import { cityLayout, curbZ, footprint, rectsOverlap, type Rect } from '../src/world/CityLayout';

describe('Bố cục thành phố', () => {
  for (const [D, W] of [[10, 12], [MAX_STORE_H, MAX_STORE_W], [14, 18]]) {
    const L = cityLayout(D, W);
    const store: Rect = { x0: -0.5, x1: W + 0.5, z0: WAREHOUSE.z0 - 0.5, z1: curbZ(D) };

    it(`D=${D} W=${W}: có dãy cửa hiệu sát hai bên cửa hàng`, () => {
      const shops = L.placements.filter((p) => p.sign);
      expect(shops.some((p) => p.x < 0)).toBe(true);
      if (W < MAX_STORE_W) expect(shops.some((p) => p.x > W)).toBe(true);
      for (const p of shops) expect(Math.abs(p.z + BUILDINGS[p.model][2] / 2 - (D + 0.2))).toBeLessThan(0.01);
    });

    it(`D=${D}: nhà không đè lên đường, cửa hàng, bãi đỗ, kho sỉ, và không đè nhau`, () => {
      const houses = L.placements.filter((p) => p.kind === 'building').map((p) => {
        const [w, , d] = BUILDINGS[p.model];
        return footprint(p.x, p.z, w, d, p.rot);
      });
      expect(houses.length).toBeGreaterThan(120);
      for (const [i, h] of houses.entries()) {
        for (const r of L.roads) expect(rectsOverlap(h, r)).toBe(false);
        expect(rectsOverlap(h, store)).toBe(false);
        expect(rectsOverlap(h, L.lot)).toBe(false);
        expect(rectsOverlap(h, L.depot.shed)).toBe(false);
        expect(rectsOverlap(h, L.depot.pad)).toBe(false);
        for (const o of houses.slice(i + 1)) expect(rectsOverlap(h, o)).toBe(false);
      }
    });

    it(`D=${D}: đường chính chạy ngay trước vỉa hè cửa hàng; bãi đỗ & bãi lấy hàng giáp đường chính`, () => {
      const main = L.roads[1];
      expect(main.z0).toBeCloseTo(curbZ(D));
      expect(L.lot.z1).toBeLessThanOrEqual(main.z0);
      expect(main.z0 - L.lot.z1).toBeLessThan(4);
      expect(main.z0 - L.depot.pad.z1).toBeLessThan(6);
      expect(L.lotSpots.length).toBeGreaterThanOrEqual(3);
      for (const s of L.lotSpots) {
        expect(s.x).toBeGreaterThan(L.lot.x0);
        expect(s.x).toBeLessThan(L.lot.x1);
      }
    });

    it(`D=${D}: chỗ đỗ của người chơi & bãi lấy hàng không bị vật cản`, () => {
      const solid = L.colliders.filter((c) => c.tag !== 'bound');
      const clear = (x: number, z: number, r: number) => solid.every((c) => x + r <= c.minX || x - r >= c.maxX || z + r <= c.minZ || z - r >= c.maxZ);
      for (const s of L.lotSpots.slice(0, 3)) expect(clear(s.x, s.z, 1)).toBe(true);
      const p = L.depot.pad;
      expect(clear((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 2)).toBe(true);
    });
  }

  it('cố định theo hạt giống', () => {
    expect(JSON.stringify(cityLayout(10).placements)).toBe(JSON.stringify(cityLayout(10).placements));
  });
});
