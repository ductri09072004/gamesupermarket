import { describe, expect, it } from 'vitest';
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

  it('xe chạy làn bên phải: 2 khối cạnh nhau đi ngược chiều trên đường chung, cách nhau 2 làn', () => {
    const L = cityLayout(10);
    const loops = carLoops(L.blocks);
    // điểm giữa cạnh phải của khối 0 và cạnh trái của khối kề phải
    const a = L.blocks.findIndex((b) => b.x0 < 0 && b.x1 > 0);
    const right = L.blocks.findIndex((b) => Math.abs(b.x0 - L.blocks[a].x1 - 8) < 0.01 && b.z0 === L.blocks[a].z0);
    expect(right).toBeGreaterThanOrEqual(0);
    const midZ = (L.blocks[a].z0 + L.blocks[a].z1) / 2;
    const near = (r: (typeof loops)[number]) => {
      let best = { x: 0, z: 0, dx: 0, dz: 0 };
      let bd = Infinity;
      for (let d = 0; d < r.total; d += 0.5) {
        const p = poseAt(r, d);
        const dd = Math.abs(p.z - midZ) + (Math.abs(p.x - (L.blocks[a].x1 + 4)) < 5 ? 0 : 1e3);
        if (dd < bd) { bd = dd; best = p; }
      }
      return best;
    };
    const pa = near(loops[a]);
    const pb = near(loops[right]);
    expect(Math.sign(pa.dz)).toBe(-Math.sign(pb.dz));
    expect(Math.abs(pa.x - pb.x)).toBeCloseTo(2 * LANE_OFFSET);
    // bên phải hướng đi (-dz, dx) chỉ ra tim đường → đi làn phải
    const road = L.blocks[a].x1 + 4;
    expect(Math.sign(road - pa.x)).toBe(-Math.sign(-pa.dz));
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
