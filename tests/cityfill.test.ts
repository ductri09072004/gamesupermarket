import { describe, expect, it } from 'vitest';
import { WALK_WIDTH } from '../src/config/city';
import { WAREHOUSE_LOT } from '../src/config/constants';
import { cityLayout, curbZ, houseRect, type Rect } from '../src/world/CityLayout';

const inside = (r: Rect, x: number, z: number) => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6;

describe('lấp kín khối phố bằng nhà Việt', () => {
  for (const [D, W] of [[10, 12], [14, 18], [16, 20]]) {
    it(`D=${D} W=${W}: không còn đất trống trong lõi khối phố`, () => {
      const L = cityLayout(D, W);
      const F = curbZ(D);
      const houses = L.placements.filter((p) => p.kind === 'building').map(houseRect);
      // chỗ không phải nhà nhưng được phép trống: cửa hàng + kho, bãi đỗ, bãi lấy hàng, vỉa hè trước cửa hàng
      const open: Rect[] = [
        { x0: WAREHOUSE_LOT.x0 - 0.6, x1: W + 0.6, z0: -4, z1: F }, L.lot, { ...L.depot.shed, z1: F },
        { x0: L.depot.shed.x0 - 2, x1: L.depot.shed.x1 + 2, z0: L.depot.shed.z0, z1: F }, L.depot.pad,
      ];
      let total = 0;
      let empty = 0;
      const holes: string[] = [];
      for (const b of L.blocks) {
        for (let x = b.x0 + WALK_WIDTH + 0.5; x < b.x1 - WALK_WIDTH; x += 1) {
          for (let z = b.z0 + WALK_WIDTH + 0.5; z < b.z1 - WALK_WIDTH; z += 1) {
            if (open.some((r) => inside(r, x, z))) continue;
            total++;
            if (!houses.some((h) => inside(h, x, z))) { empty++; if (holes.length < 6) holes.push(`${x},${z}`); }
          }
        }
      }
      expect(total).toBeGreaterThan(5000);
      expect(`${empty}/${total} ${holes.join(' ')}`).toMatch(/^0\//);
    });
  }
});
