import { describe, expect, it } from 'vitest';
import { findPath, PathCache } from '../src/iso/Pathfinding';
import type { WalkGrid } from '../src/iso/IsoGrid';
import { IsoGrid } from '../src/iso/IsoGrid';

function gridFrom(rows: string[]): WalkGrid {
  return {
    version: 1,
    isWalkable: (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[0].length && rows[y][x] === '.',
  };
}

describe('Pathfinding', () => {
  it('đường thẳng và chéo', () => {
    const g = gridFrom(['.....', '.....', '.....']);
    const p = findPath(g, { gx: 0, gy: 0 }, { gx: 2, gy: 2 })!;
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ gx: 0, gy: 0 });
    expect(p[2]).toEqual({ gx: 2, gy: 2 });
  });

  it('không cắt góc qua vật cản', () => {
    const g = gridFrom(['.#', '..']);
    const p = findPath(g, { gx: 0, gy: 0 }, { gx: 1, gy: 1 })!;
    expect(p).toHaveLength(3);
  });

  it('vòng qua tường', () => {
    const g = gridFrom(['.....', '.###.', '.....']);
    const p = findPath(g, { gx: 2, gy: 0 }, { gx: 2, gy: 2 })!;
    expect(p[p.length - 1]).toEqual({ gx: 2, gy: 2 });
    for (const q of p) expect(g.isWalkable(q.gx, q.gy)).toBe(true);
  });

  it('không có đường → null', () => {
    const g = gridFrom(['..#..', '..#..']);
    expect(findPath(g, { gx: 0, gy: 0 }, { gx: 4, gy: 0 })).toBeNull();
  });

  it('nhiều đích: chọn đích gần nhất', () => {
    const g = gridFrom(['..........']);
    const p = findPath(g, { gx: 5, gy: 0 }, [{ gx: 0, gy: 0 }, { gx: 7, gy: 0 }])!;
    expect(p[p.length - 1]).toEqual({ gx: 7, gy: 0 });
  });

  it('cache trả kết quả giống và bị xoá khi version đổi', () => {
    const grid = new IsoGrid(12, 10, false);
    const cache = new PathCache(grid);
    const a = cache.find(grid.doorOutside, { gx: 5, gy: 5 });
    const b = cache.find(grid.doorOutside, { gx: 5, gy: 5 });
    expect(a).toEqual(b);
    expect(cache.hits).toBe(1);
    grid.occupy([{ gx: 4, gy: 5 }], 'x');
    cache.find(grid.doorOutside, { gx: 5, gy: 5 });
    expect(cache.hits).toBe(1);
  });

  it('khách đi từ vỉa hè vào cửa tới ô trong cửa hàng', () => {
    const grid = new IsoGrid(12, 10, false);
    const p = findPath(grid, grid.spawnPoints()[0], { gx: 8, gy: 3 })!;
    expect(p).not.toBeNull();
    expect(p.some((q) => q.gx === grid.doorTile.gx && q.gy === grid.doorTile.gy)).toBe(true);
  });
});
