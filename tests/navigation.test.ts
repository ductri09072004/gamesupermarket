import { describe, expect, it } from 'vitest';
import { DOOR_X, STORE_FRONT_Z } from '../src/config/constants';
import { cityLayout } from '../src/world/CityLayout';
import { mapPois } from '../src/world/MapPois';
import { buildNavGrid, findRoute, nearestFree } from '../src/world/Navigation';

describe('lưới đi bộ & tìm đường', () => {
  const bounds = { x0: 0, x1: 20, z0: 0, z1: 20 };

  it('đi vòng qua tường chắn, đường được kéo thẳng', () => {
    const g = buildNavGrid(bounds, [{ minX: 9, maxX: 11, minZ: 0, maxZ: 15 }], 1, 0);
    const r = findRoute(g, { x: 2.5, z: 2.5 }, { x: 17.5, z: 2.5 })!;
    expect(r).not.toBeNull();
    expect(r.length).toBeGreaterThan(15);
    // phải đi vòng qua đầu tường (z > 15)
    expect(Math.max(...r.pts.map((p) => p.z))).toBeGreaterThan(15);
    expect(r.pts.length).toBeLessThan(8);
  });

  it('bị vây kín thì không có đường; điểm đích trong vật cản được đưa ra ô trống gần nhất', () => {
    const wall = [{ minX: 8, maxX: 12, minZ: 8, maxZ: 9 }, { minX: 8, maxX: 12, minZ: 11, maxZ: 12 }, { minX: 8, maxX: 9, minZ: 8, maxZ: 12 }, { minX: 11, maxX: 12, minZ: 8, maxZ: 12 }];
    const g = buildNavGrid(bounds, wall, 1, 0);
    expect(findRoute(g, { x: 0.5, z: 0.5 }, { x: 10, z: 10 })).toBeNull();
    const g2 = buildNavGrid(bounds, [{ minX: 9, maxX: 11, minZ: 9, maxZ: 11 }], 1, 0);
    const p = nearestFree(g2, { x: 10, z: 10 })!;
    expect(Math.hypot(p.x - 10, p.z - 10)).toBeLessThan(2.5);
    expect(findRoute(g2, { x: 1, z: 1 }, { x: 10, z: 10 })).not.toBeNull();
  });
});

describe('bản đồ thành phố', () => {
  const L = cityLayout(10, 12);
  const pois = mapPois(L, { vehicles: [] });
  const grid = buildNavGrid(L.bounds, L.colliders);
  const from = { x: DOOR_X, z: STORE_FRONT_Z + 1.6 };

  it('có địa điểm chính, ngã tư và đầu các hẻm', () => {
    for (const id of ['store', 'depot', 'bus', 'park']) expect(pois.some((p) => p.id === id), id).toBe(true);
    expect(pois.filter((p) => p.group === 'cross')).toHaveLength(12);
    expect(pois.filter((p) => p.group === 'alley').length).toBeGreaterThanOrEqual(L.alleys.filter((a) => a.axis === 'z').length);
  });

  it('từ trước cửa hàng tới mọi địa điểm đều có đường đi, không xuyên nhà', () => {
    for (const p of pois) {
      const r = findRoute(grid, from, p);
      expect(r, p.label).not.toBeNull();
      // mẫu dọc đường: không điểm nào nằm trong nhà
      for (let i = 1; i < r!.pts.length; i++) {
        const a = r!.pts[i - 1];
        const b = r!.pts[i];
        for (let t = 0; t <= 1; t += 0.1) {
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          for (const c of L.colliders) if (c.tag === 'building') expect(x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ, `${p.label} xuyên nhà`).toBe(false);
        }
      }
    }
  }, 30000);

  it('đi vào sâu trong hẻm cụt từ đường', () => {
    const dead = L.alleys.find((a) => a.kind === 'dead')!;
    const end = { x: (dead.rect.x0 + dead.rect.x1) / 2, z: dead.deadEnd === 'max' ? dead.rect.z1 - 3.5 : dead.rect.z0 + 3.5 };
    const r = findRoute(grid, from, end);
    expect(r).not.toBeNull();
    expect(Math.hypot(r!.pts[r!.pts.length - 1].x - end.x, r!.pts[r!.pts.length - 1].z - end.z)).toBeLessThan(1.2);
  });
});
