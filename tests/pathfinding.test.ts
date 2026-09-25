import { describe, expect, it } from 'vitest';
import { findPath, PathCache } from '../src/world/Pathfinding';
import type { WalkGrid } from '../src/world/NavGrid';
import { NavGrid } from '../src/world/NavGrid';

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
    const grid = new NavGrid(12, 10, false);
    const cache = new PathCache(grid);
    const a = cache.find(grid.doorOutside, { gx: 10, gy: 10 });
    const b = cache.find(grid.doorOutside, { gx: 10, gy: 10 });
    expect(a).toEqual(b);
    expect(cache.hits).toBe(1);
    grid.occupy([{ gx: 8, gy: 10 }], 'x');
    cache.find(grid.doorOutside, { gx: 10, gy: 10 });
    expect(cache.hits).toBe(1);
  });

  it('khách đi từ vỉa hè vào cửa tới ô trong cửa hàng', () => {
    const grid = new NavGrid(12, 10, false);
    const p = findPath(grid, grid.spawnPoints()[0], { gx: 16, gy: 6 })!;
    expect(p).not.toBeNull();
    expect(p.some((q) => q.gy === grid.sd)).toBe(true);
  });
});

describe('Làm mượt đường', () => {
  it('bỏ điểm trung gian khi nhìn thẳng được', async () => {
    const { smoothPath, findPath } = await import('../src/world/Pathfinding');
    const g: WalkGrid = { version: 1, isWalkable: (x, y) => x >= 0 && y >= 0 && x < 20 && y < 20 };
    const p = findPath(g, { gx: 1, gy: 1 }, { gx: 15, gy: 6 })!;
    const s = smoothPath(g, p);
    expect(s.length).toBeLessThan(p.length);
    expect(s[0]).toEqual(p[0]);
    expect(s[s.length - 1]).toEqual(p[p.length - 1]);
  });
});
