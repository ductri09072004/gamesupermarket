import { describe, expect, it } from 'vitest';
import { DIRT } from '../src/config/hygiene';
import { getFurniture, isPassable } from '../src/config/furniture';
import { bus } from '../src/core/EventBus';
import { createNewState, GameState, makeFurniture } from '../src/core/GameState';
import { mulberry32 } from '../src/core/Random';
import { canPlace } from '../src/systems/BuildSystem';
import { CleanlinessSystem, dirtRatePerHour, pickDirtKind } from '../src/systems/CleanlinessSystem';
import { findReturnShelf } from '../src/systems/InventorySystem';
import { NavGrid } from '../src/world/NavGrid';

describe('vệ sinh cửa hàng', () => {
  it('bẩn nhanh hơn khi đông khách và cửa hàng rộng', () => {
    expect(dirtRatePerHour(10, 120)).toBeGreaterThan(dirtRatePerHour(0, 120));
    expect(dirtRatePerHour(0, 480)).toBeGreaterThan(dirtRatePerHour(0, 120));
    const rng = mulberry32(3);
    const kinds = new Set(Array.from({ length: 200 }, () => pickDirtKind(rng)));
    expect(kinds).toEqual(new Set(['litter', 'spill', 'smudge']));
  });

  it('sinh chất bẩn theo thời gian, trừ uy tín mỗi giờ, dọn được', () => {
    const state = new GameState(createNewState(1));
    const rep: number[] = [];
    const sys = new CleanlinessSystem(state, bus, mulberry32(1), { changeReputation: (d) => rep.push(d) });
    for (let i = 0; i < 12; i++) sys.update(10, 8, () => ({ x: 2, z: 2 }));
    expect(state.data.dirt.length).toBeGreaterThan(3);
    expect(state.data.dirt.length).toBeLessThanOrEqual(DIRT.max);
    expect(rep.length).toBe(2);
    expect(rep[0]).toBeLessThan(0);
    const uid = state.data.dirt[0].uid;
    expect(sys.clean(uid)).toBe(true);
    expect(sys.clean(uid)).toBe(false);
  });

  it('không có chỗ hợp lệ thì không sinh', () => {
    const state = new GameState(createNewState(1));
    const sys = new CleanlinessSystem(state, bus, mulberry32(1), { changeReputation: () => {} });
    sys.update(600, 20, () => null);
    expect(state.data.dirt).toHaveLength(0);
  });
});

describe('an ninh', () => {
  it('cổng an ninh đi xuyên qua được, đặt sát cửa được, không đè lên kệ', () => {
    const gate = getFurniture('security_gate');
    expect(isPassable(gate)).toBe(true);
    const grid = new NavGrid(12, 10, false);
    const door = grid.doorInside;
    const gx = door.gx - Math.floor(gate.footprint.w / 2);
    expect(canPlace(grid, gate, gx, door.gy, 0, []).ok).toBe(true);
    const shelf = makeFurniture('s1', 'shelf_large', 2, 2, 0);
    grid.occupy([{ gx: 2, gy: 2 }, { gx: 3, gy: 2 }], 's1');
    expect(canPlace(grid, gate, 2, 2, 0, [shelf]).ok).toBe(false);
  });

  it('hàng văng ra được trả về kệ đang bày đúng món trước, rồi mới tới ngăn trống', () => {
    const a = makeFurniture('a', 'shelf_large', 0, 0, 0);
    const b = makeFurniture('b', 'shelf_large', 5, 0, 0);
    b.slots[3] = { productId: 'soda', qty: 5 };
    expect(findReturnShelf([a, b], 'soda')).toEqual({ furn: b, slot: 3 });
    expect(findReturnShelf([a], 'soda')?.furn).toBe(a);
    expect(findReturnShelf([makeFurniture('f', 'freezer', 0, 0, 0)], 'soda')).toBeNull();
  });
});
