import { describe, expect, it } from 'vitest';
import { getFurniture } from '../src/config/furniture';
import { createNewState } from '../src/core/GameState';
import { counterTiles, footprintCells } from '../src/world/Footprint';
import { NavGrid } from '../src/world/NavGrid';
import { computeQueueTiles } from '../src/world/Queue';

describe('Hàng đợi quầy thu ngân', () => {
  it('bắt đầu ở ô khách, không trùng, đi được, trong cửa hàng, tránh lối cửa', () => {
    const d = createNewState(1);
    const grid = new NavGrid(d.storeW, d.storeH, false);
    for (const f of d.furniture) grid.occupy(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot), f.uid);
    const counter = d.furniture.find((f) => f.type === 'checkout')!;
    const tiles = computeQueueTiles(grid, counter);
    expect(tiles[0]).toEqual(counterTiles(getFurniture('checkout'), counter.gx, counter.gy, counter.rot).customer);
    expect(tiles.length).toBeGreaterThan(3);
    expect(new Set(tiles.map((t) => `${t.gx},${t.gy}`)).size).toBe(tiles.length);
    for (const t of tiles) {
      expect(grid.isWalkable(t.gx, t.gy)).toBe(true);
      expect(grid.isStoreInterior(t.gx, t.gy)).toBe(true);
    }
  });
});
