import { describe, expect, it } from 'vitest';
import { DELIVERY_MAX_MS } from '../src/config/constants';
import { getFurniture } from '../src/config/furniture';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState, type OrderData } from '../src/core/GameState';
import { EconomySystem } from '../src/systems/EconomySystem';
import { InventorySystem } from '../src/systems/InventorySystem';
import { OrderSystem, pickCrateTile } from '../src/systems/OrderSystem';
import { ShopSystem } from '../src/systems/ShopSystem';

function setup() {
  const state = new GameState(createNewState(1));
  state.data.money = 10000;
  const bus = new EventBus<GameEvents>();
  const economy = new EconomySystem(state, bus);
  const inventory = new InventorySystem(state, bus);
  const crateTiles = [{ gx: 8, gy: 11 }, { gx: 9.6, gy: 11 }];
  const orders = new OrderSystem(state, bus, economy, inventory, () => 0.5, () => [{ gx: 5, gy: 11 }], () => crateTiles);
  const shop = new ShopSystem(state, bus, economy, orders);
  return { state, bus, orders, shop };
}

describe('giao hàng bằng xe tải', () => {
  it('mua nội thất → đơn giao hàng (không vào kho nội thất ngay), tới nơi thành thùng lắp đặt', () => {
    const { state, orders, shop } = setup();
    const before = state.data.money;
    expect(shop.buyFurniture('shelf_small').ok).toBe(true);
    expect(state.data.money).toBeCloseTo(before - getFurniture('shelf_small').price);
    expect(state.data.furnitureStock).toHaveLength(0);
    expect(state.data.orders[0].furniture).toEqual(['shelf_small']);
    orders.update(DELIVERY_MAX_MS + 1);
    expect(state.data.orders).toHaveLength(0);
    expect(state.data.crates).toHaveLength(1);
    expect(state.data.crates[0]).toMatchObject({ type: 'shelf_small', x: 8, z: 11 });
  });

  it('có xe tải: đơn tới hạn chỉ gọi xe (1 lần), hàng xuất hiện khi xe dỡ hàng', () => {
    const { state, bus, orders } = setup();
    const due: OrderData[] = [];
    orders.onDue = (o) => due.push(o);
    let from: unknown = null;
    bus.on('order:arrived', (e) => { from = e.from; });
    expect(orders.placeOrder({ water: 2 }).ok).toBe(true);
    orders.update(DELIVERY_MAX_MS + 1);
    orders.update(1000);
    expect(due).toHaveLength(1);
    expect(state.data.boxes).toHaveLength(0);
    orders.deliver(due[0], { x: 9, y: 1.2, z: 14 });
    expect(state.data.boxes).toHaveLength(2);
    expect(state.data.orders).toHaveLength(0);
    expect(from).toEqual({ x: 9, y: 1.2, z: 14 });
  });

  it('thùng nội thất không chồng lên nhau', () => {
    const tiles = [{ gx: 8, gy: 11 }, { gx: 9.6, gy: 11 }];
    expect(pickCrateTile(tiles, [{ x: 8, z: 11 }])).toEqual(tiles[1]);
    expect(pickCrateTile(tiles, [{ x: 8, z: 11, held: true }])).toEqual(tiles[0]);
  });
});
