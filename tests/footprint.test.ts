import { describe, expect, it } from 'vitest';
import { getFurniture } from '../src/config/furniture';
import { adjacentTiles, counterTiles, footprintCells, rotatedSize } from '../src/iso/Footprint';
import { footprintDepth } from '../src/iso/DepthSort';
import { IsoGrid } from '../src/iso/IsoGrid';

describe('Footprint', () => {
  const large = getFurniture('shelf_large');

  it('xoay footprint 2x1', () => {
    expect(rotatedSize(large, 0)).toEqual({ w: 2, h: 1 });
    expect(rotatedSize(large, 1)).toEqual({ w: 1, h: 2 });
    expect(footprintCells(large, 3, 4, 0)).toEqual([{ gx: 3, gy: 4 }, { gx: 4, gy: 4 }]);
    expect(footprintCells(large, 3, 4, 1)).toEqual([{ gx: 3, gy: 4 }, { gx: 3, gy: 5 }]);
    expect(footprintCells(large, 3, 4, 2)).toHaveLength(2);
  });

  it('ô kề quanh footprint', () => {
    const adj = adjacentTiles(footprintCells(large, 0, 0, 0));
    expect(adj).toHaveLength(6);
  });

  it('ô quầy thu ngân theo hướng', () => {
    expect(counterTiles(5, 5, 0)).toMatchObject({ staff: { gx: 5, gy: 4 }, customer: { gx: 5, gy: 6 } });
    expect(counterTiles(5, 5, 1)).toMatchObject({ staff: { gx: 4, gy: 5 }, customer: { gx: 6, gy: 5 } });
  });

  it('depth vật nhiều ô dùng ô có gx+gy lớn nhất', () => {
    const d = footprintDepth(footprintCells(large, 2, 2, 0));
    expect(d).toBe((3 + 2 + 1) * 10);
  });

  it('nội thất chiếm ô → không walkable, giải phóng lại được', () => {
    const g = new IsoGrid(12, 10, false);
    const cells = footprintCells(large, 2, 2, 0);
    expect(g.isWalkable(2, 2)).toBe(true);
    g.occupy(cells, 'f1');
    expect(g.isWalkable(2, 2)).toBe(false);
    expect(g.isWalkable(3, 2)).toBe(false);
    expect(g.occupant(3, 2)).toBe('f1');
    g.free('f1');
    expect(g.isWalkable(3, 2)).toBe(true);
  });

  it('bản đồ: tường, cửa, vỉa hè', () => {
    const g = new IsoGrid(12, 10, false);
    expect(g.isWalkable(-1, 3)).toBe(false);
    expect(g.isWalkable(5, -1)).toBe(false);
    expect(g.isWalkable(g.doorTile.gx, g.doorTile.gy)).toBe(true);
    expect(g.isWalkable(5, 10)).toBe(false);
    expect(g.isWalkable(5, 11)).toBe(true);
    expect(g.isWalkable(-3, 2)).toBe(false);
    g.rebuild(12, 10, true);
    expect(g.isWalkable(-3, 2)).toBe(true);
    expect(g.isWalkable(-1, 2)).toBe(true);
  });
});
