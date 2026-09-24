import { describe, expect, it } from 'vitest';
import { getFurniture } from '../src/config/furniture';
import { createNewState, makeFurniture } from '../src/core/GameState';
import { computeQueueTiles } from '../src/entities/Checkout';
import { footprintCells } from '../src/iso/Footprint';
import { IsoGrid } from '../src/iso/IsoGrid';

describe('Hàng đợi quầy thu ngân', () => {
  it('bắt đầu ở ô khách, không trùng, luôn đi được và nằm trong cửa hàng', () => {
    const d = createNewState(1);
    const grid = new IsoGrid(d.storeW, d.storeH, false);
    for (const f of d.furniture) grid.occupy(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot), f.uid);
    const counter = d.furniture.find((f) => f.type === 'checkout')!;
    const tiles = computeQueueTiles(grid, counter);
    expect(tiles[0]).toEqual({ gx: counter.gx, gy: counter.gy + 1 });
    expect(tiles.length).toBeGreaterThan(3);
    expect(new Set(tiles.map((t) => `${t.gx},${t.gy}`)).size).toBe(tiles.length);
    for (const t of tiles) {
      expect(grid.isWalkable(t.gx, t.gy)).toBe(true);
      expect(grid.isStoreInterior(t.gx, t.gy)).toBe(true);
    }
  });

  it('rẽ ngang khi gặp tường', () => {
    const grid = new IsoGrid(12, 10, false);
    const counter = makeFurniture('c', 'checkout', 4, 7, 0);
    grid.occupy(footprintCells(getFurniture('checkout'), 4, 7, 0), 'c');
    const tiles = computeQueueTiles(grid, counter);
    expect(tiles.slice(0, 2)).toEqual([{ gx: 4, gy: 8 }, { gx: 4, gy: 9 }]);
    expect(tiles[2].gy).toBe(9);
  });
});
