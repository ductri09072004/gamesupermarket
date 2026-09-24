import { describe, expect, it } from 'vitest';
import { getFurniture } from '../src/config/furniture';
import { createNewState, makeFurniture } from '../src/core/GameState';
import { footprintCells } from '../src/iso/Footprint';
import { IsoGrid } from '../src/iso/IsoGrid';
import { canPlace } from '../src/systems/BuildSystem';
import { expansionPacks } from '../src/systems/ShopSystem';

function setup() {
  const d = createNewState(1);
  const grid = new IsoGrid(d.storeW, d.storeH, false);
  for (const f of d.furniture) grid.occupy(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot), f.uid);
  return { d, grid };
}

describe('BuildSystem', () => {
  it('đặt được ở ô trống trong cửa hàng', () => {
    const { d, grid } = setup();
    expect(canPlace(grid, getFurniture('shelf_small'), 9, 4, 0, d.furniture).ok).toBe(true);
  });

  it('không đặt ngoài cửa hàng / chồng lên đồ khác / chặn cửa', () => {
    const { d, grid } = setup();
    const small = getFurniture('shelf_small');
    expect(canPlace(grid, small, -3, 4, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, small, 3, 2, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, small, grid.doorInside.gx, grid.doorInside.gy, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, getFurniture('shelf_large'), 11, 4, 0, d.furniture).ok).toBe(false);
  });

  it('không được chặn đường tới quầy thu ngân', () => {
    const { d, grid } = setup();
    // quầy ở (6,7)-(7,7): ô khách (6,8), ô thu ngân (6,6)
    const small = getFurniture('shelf_small');
    expect(canPlace(grid, small, 6, 8, 0, d.furniture).ok).toBe(false);
    expect(canPlace(grid, small, 6, 6, 0, d.furniture).ok).toBe(false);
  });

  it('nhấc chính nó lên thì ô cũ không tính là bị chiếm', () => {
    const { d, grid } = setup();
    const shelf = d.furniture[0];
    expect(canPlace(grid, getFurniture('shelf_large'), shelf.gx, shelf.gy, 0, d.furniture, shelf.uid).ok).toBe(true);
  });

  it('kệ kho chỉ đặt trong kho', () => {
    const { d, grid } = setup();
    const rack = getFurniture('rack');
    expect(canPlace(grid, rack, 8, 4, 0, d.furniture).ok).toBe(false);
    grid.rebuild(12, 10, true);
    expect(canPlace(grid, rack, -5, 1, 0, d.furniture).ok).toBe(true);
  });

  it('các gói mở rộng đạt tối đa 24x20', () => {
    const packs = expansionPacks();
    expect(packs[packs.length - 1].sizeAfter).toEqual({ w: 24, h: 20 });
    expect(packs.every((p, i) => i === 0 || p.price >= packs[i - 1].price)).toBe(true);
    expect(makeFurniture('x', 'fridge', 0, 0).slots).toHaveLength(3);
  });
});
