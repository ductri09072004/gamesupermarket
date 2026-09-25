import { describe, expect, it } from 'vitest';
import { getFurniture } from '../src/config/furniture';
import { createNewState, makeFurniture } from '../src/core/GameState';
import { counterTiles, footprintCells } from '../src/world/Footprint';
import { NavGrid } from '../src/world/NavGrid';
import { canPlace } from '../src/systems/BuildSystem';
import { expansionPacks } from '../src/systems/ShopSystem';

function setup() {
  const d = createNewState(1);
  const grid = new NavGrid(d.storeW, d.storeH, false);
  for (const f of d.furniture) grid.occupy(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot), f.uid);
  return { d, grid };
}

describe('BuildSystem', () => {
  it('bố cục khởi đầu hợp lệ (không chồng nhau, nằm trong cửa hàng)', () => {
    const d = createNewState(1);
    const grid = new NavGrid(d.storeW, d.storeH, false);
    for (const f of d.furniture) {
      const def = getFurniture(f.type);
      expect(canPlace(grid, def, f.gx, f.gy, f.rot, d.furniture, f.uid).ok, f.type).toBe(true);
      grid.occupy(footprintCells(def, f.gx, f.gy, f.rot), f.uid);
    }
  });

  it('đặt được ở ô trống', () => {
    const { d, grid } = setup();
    expect(canPlace(grid, getFurniture('shelf_small'), 14, 8, 0, d.furniture).ok).toBe(true);
  });

  it('không đặt ngoài cửa hàng / chồng lên đồ / chặn cửa', () => {
    const { d, grid } = setup();
    const small = getFurniture('shelf_small');
    expect(canPlace(grid, small, -4, 4, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, small, 4, 1, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, small, grid.doorInside.gx, grid.doorInside.gy - 1, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, getFurniture('shelf_large'), 22, 12, 0, d.furniture).ok).toBe(false);
  });

  it('không được chặn đường tới quầy thu ngân', () => {
    const { d, grid } = setup();
    const counter = d.furniture.find((f) => f.type === 'checkout')!;
    const t = counterTiles(getFurniture('checkout'), counter.gx, counter.gy, counter.rot);
    const tiny = getFurniture('trash');
    expect(canPlace(grid, tiny, t.customer.gx, t.customer.gy, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, tiny, t.staff.gx, t.staff.gy, 0, d.furniture).ok).toBe(false);
  });

  it('nhấc chính nó lên thì ô cũ không tính là bị chiếm', () => {
    const { d, grid } = setup();
    const shelf = d.furniture[0];
    expect(canPlace(grid, getFurniture('shelf_large'), shelf.gx, shelf.gy, 0, d.furniture, shelf.uid).ok).toBe(true);
  });

  it('kệ kho chỉ đặt trong kho', () => {
    const { d, grid } = setup();
    const rack = getFurniture('rack');
    expect(canPlace(grid, rack, 14, 8, 0, d.furniture).ok).toBe(false);
    grid.rebuild(12, 10, true);
    expect(canPlace(grid, rack, 2, -10, 0, d.furniture).ok).toBe(true);
  });

  it('các gói mở rộng đạt tối đa 24x20m', () => {
    const packs = expansionPacks();
    expect(packs[packs.length - 1].sizeAfter).toEqual({ w: 24, h: 20 });
    expect(makeFurniture('x', 'fridge', 0, 0).slots).toHaveLength(8);
  });
});
