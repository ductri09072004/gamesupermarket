import { describe, expect, it } from 'vitest';
import { ROAD_WIDTH } from '../src/config/city';
import { ONE_WAY_BLOCKS } from '../src/config/traffic';
import { cityLayout, rectsOverlap } from '../src/world/CityLayout';
import { carLoops, LANE_OFFSET, poseAt, roundedLoop, walkLoops } from '../src/world/CityRoutes';

describe('tuyến xe & người đi bộ', () => {
  it('poseAt đi hết vòng quay về điểm đầu, hướng là vector đơn vị', () => {
    const r = roundedLoop([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], 2);
    expect(r.total).toBeGreaterThan(30);
    expect(r.total).toBeLessThan(40);
    const a = poseAt(r, 0.5);
    const b = poseAt(r, 0.5 + r.total);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.z).toBeCloseTo(a.z);
    for (let d = 0; d < r.total; d += 1.7) expect(Math.hypot(poseAt(r, d).dx, poseAt(r, d).dz)).toBeCloseTo(1);
  });

  it('hẻm một làn: các khối cho xe chạy không chung cạnh nào → mỗi đoạn đường chỉ một chiều, xe đi giữa lòng hẻm', () => {
    const L = cityLayout(10);
    const blocks = ONE_WAY_BLOCKS.map((i) => L.blocks[i]);
    expect(blocks.every(Boolean)).toBe(true);
    // khối có cửa hàng (chứa x = 0, phía trên đường chính) nằm trong số đó
    expect(blocks.some((b) => b.x0 < 0 && b.x1 > 0 && b.z1 < L.roads[1].z1)).toBe(true);
    const loops = carLoops(blocks);
    expect(LANE_OFFSET).toBe(0);
    // không có hai xe chạy ngược chiều nhau ở cùng một chỗ trên đường
    for (let i = 0; i < loops.length; i++) {
      for (let j = i + 1; j < loops.length; j++) {
        for (let d = 0; d < loops[i].total; d += 2) {
          const a = poseAt(loops[i], d);
          for (let e = 0; e < loops[j].total; e += 2) {
            const b = poseAt(loops[j], e);
            if (Math.hypot(a.x - b.x, a.z - b.z) < 1.2) expect(a.dx * b.dx + a.dz * b.dz).toBeGreaterThan(-0.5);
          }
        }
      }
    }
    // xe đi ngay giữa lòng đường: tim đường cách mép khối ROAD_WIDTH / 2
    const b = blocks[0];
    let best = Infinity;
    for (let d = 0; d < loops[0].total; d += 1) {
      const p = poseAt(loops[0], d);
      if (Math.abs(p.dz) < 0.01 && p.z < (b.z0 + b.z1) / 2) best = Math.min(best, Math.abs(p.z - (b.z0 - ROAD_WIDTH / 2)));
    }
    expect(best).toBeLessThan(0.05);
  });

  it('người đi bộ đi trên vỉa hè, không xuyên nhà', () => {
    const L = cityLayout(10);
    const houses = L.colliders.filter((c) => c.tag === 'building');
    for (const r of walkLoops(L.blocks, 1.6)) {
      for (let d = 0; d < r.total; d += 1) {
        const p = poseAt(r, d);
        const me = { x0: p.x - 0.3, x1: p.x + 0.3, z0: p.z - 0.3, z1: p.z + 0.3 };
        for (const h of houses) expect(rectsOverlap(me, { x0: h.minX, x1: h.maxX, z0: h.minZ, z1: h.maxZ })).toBe(false);
        for (const road of L.roads) expect(rectsOverlap(me, road)).toBe(false);
      }
    }
  });
});
