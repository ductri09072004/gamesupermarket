import { describe, expect, it } from 'vitest';
import { FURNITURE, getFurniture } from '../src/config/furniture';
import { adjacentTiles, counterTiles, footprintCells, frontTiles, rotatedSize, rotationY } from '../src/world/Footprint';
import { cellCenter, NavGrid, worldToCell } from '../src/world/NavGrid';

describe('Footprint (ô 0.5m)', () => {
  const large = getFurniture('shelf_large');

  it('footprint suy ra từ kích thước thật', () => {
    expect(large.footprint).toEqual({ w: 4, h: 1 });
    expect(getFurniture('fridge').footprint).toEqual({ w: 4, h: 2 });
    expect(getFurniture('trash').footprint).toEqual({ w: 1, h: 1 });
    for (const f of FURNITURE) expect(f.slots).toBe(f.tiers * f.columns);
  });

  it('xoay footprint', () => {
    expect(rotatedSize(large, 1)).toEqual({ w: 1, h: 4 });
    expect(footprintCells(large, 3, 4, 0)).toHaveLength(4);
    expect(footprintCells(large, 3, 4, 1).every((c) => c.gx === 3)).toBe(true);
  });

  it('mặt trước model (-Z) quay đúng hướng', () => {
    for (let r = 0; r < 4; r++) {
      const a = rotationY(r);
      const fx = -Math.sin(a);
      const fz = -Math.cos(a);
      const expected = [[0, 1], [1, 0], [0, -1], [-1, 0]][r];
      expect(fx).toBeCloseTo(expected[0]);
      expect(fz).toBeCloseTo(expected[1]);
    }
  });

  it('ô phía trước & ô kề', () => {
    expect(frontTiles(large, 2, 2, 0)).toEqual([{ gx: 2, gy: 3 }, { gx: 3, gy: 3 }, { gx: 4, gy: 3 }, { gx: 5, gy: 3 }]);
    expect(frontTiles(large, 2, 2, 3).every((t) => t.gx === 1)).toBe(true);
    expect(adjacentTiles(footprintCells(large, 0, 0, 0))).toHaveLength(10);
  });

  it('ô quầy thu ngân nằm ngoài footprint, hai phía đối diện', () => {
    const c = getFurniture('checkout');
    for (let r = 0; r < 4; r++) {
      const cells = footprintCells(c, 5, 5, r);
      const t = counterTiles(c, 5, 5, r);
      for (const p of [t.staff, t.customer]) expect(cells.some((q) => q.gx === p.gx && q.gy === p.gy)).toBe(false);
      expect(Math.sign(t.customer.gx - t.staff.gx)).toBe(Math.sign(t.dir.gx));
      expect(Math.sign(t.customer.gy - t.staff.gy)).toBe(Math.sign(t.dir.gy));
    }
  });
});

describe('NavGrid', () => {
  it('cửa hàng 12×10m = 24×20 ô, tường bao quanh, cửa phía trước', () => {
    const g = new NavGrid(12, 10, false);
    expect(g.sw).toBe(24);
    expect(g.sd).toBe(20);
    expect(g.isWalkable(-1, 5)).toBe(false);
    expect(g.isWalkable(24, 5)).toBe(false);
    expect(g.isWalkable(10, -1)).toBe(false);
    expect(g.isWalkable(10, 20)).toBe(false);
    for (const d of g.doorCells) expect(g.isWalkable(d.gx, d.gy)).toBe(true);
    expect(g.isWalkable(10, 21)).toBe(true);
    expect(g.isWalkable(5, -5)).toBe(false);
    g.rebuild(12, 10, true);
    expect(g.isWalkable(5, -5)).toBe(true);
    expect(g.isWalkable(g.warehouseDoor.gx, g.warehouseDoor.gy)).toBe(true);
  });

  it('chiếm ô & giải phóng', () => {
    const g = new NavGrid(12, 10, false);
    g.occupy(footprintCells(getFurniture('shelf_large'), 2, 2, 0), 'f1');
    expect(g.isWalkable(3, 2)).toBe(false);
    expect(g.occupant(5, 2)).toBe('f1');
    g.free('f1');
    expect(g.isWalkable(3, 2)).toBe(true);
  });

  it('chuyển đổi ô ↔ mét', () => {
    expect(cellCenter(0, 0)).toEqual({ x: 0.25, z: 0.25 });
    expect(worldToCell(3.1, 9.99)).toEqual({ gx: 6, gy: 19 });
    expect(worldToCell(-0.1, 0)).toEqual({ gx: -1, gy: 0 });
  });
});
