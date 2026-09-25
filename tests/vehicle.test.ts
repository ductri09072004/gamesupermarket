import { describe, expect, it } from 'vitest';
import { VEHICLES, getVehicle, WHOLESALE_PRICE_FACTOR } from '../src/config/vehicles';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState } from '../src/core/GameState';
import { EconomySystem } from '../src/systems/EconomySystem';
import { InventorySystem } from '../src/systems/InventorySystem';
import { cartTotal, OrderSystem, wholesaleTotal } from '../src/systems/OrderSystem';
import { boxLoadUnits, canLoad, cargoUsed, VehicleSystem } from '../src/systems/VehicleSystem';
import { forward, stepDrive, type DriveState } from '../src/systems/VehicleDrive';

function setup(money = 50000, level = 10) {
  const state = new GameState(createNewState(1));
  state.data.money = money;
  state.data.level = level;
  const bus = new EventBus<GameEvents>();
  const economy = new EconomySystem(state, bus);
  const inventory = new InventorySystem(state, bus);
  const vehicles = new VehicleSystem(state, bus, economy);
  const orders = new OrderSystem(state, bus, economy, inventory, () => 0.5, () => [{ gx: 0, gy: 0 }]);
  return { state, vehicles, inventory, orders };
}
const spot = { x: 40, z: 10, yaw: Math.PI };

describe('Xe: mua & sức chở', () => {
  it('3 loại xe, giá & sức chở tăng dần', () => {
    expect(VEHICLES.map((v) => v.id)).toEqual(['moto', 'car', 'pickup']);
    expect(getVehicle('moto').capacity).toBe(2);
    expect(getVehicle('car').capacity).toBe(8);
    expect(getVehicle('pickup').capacity).toBeGreaterThan(8);
  });

  it('mua xe trừ tiền, cần đủ cấp, không mua trùng', () => {
    const { state, vehicles } = setup(20000, 1);
    expect(vehicles.buy('car', spot).ok).toBe(false);
    expect(vehicles.buy('moto', spot).ok).toBe(true);
    expect(state.data.money).toBe(20000 - getVehicle('moto').price);
    expect(vehicles.buy('moto', spot).ok).toBe(false);
    expect(setup(100, 10).vehicles.buy('moto', spot).reason).toBe('Không đủ tiền');
  });

  it('thùng cồng kềnh tính 2 suất', () => {
    expect(boxLoadUnits('soda')).toBe(1);
    expect(boxLoadUnits('tissue')).toBe(2);
  });

  it('xe máy tối đa 2 thùng bất kể cỡ', () => {
    const { state, vehicles, inventory } = setup();
    const v = vehicles.buy('moto', spot).vehicle!;
    for (const id of ['tissue', 'tissue']) expect(vehicles.load(v.uid, inventory.createBox(id, 10, 0, 0)).ok).toBe(true);
    expect(vehicles.load(v.uid, inventory.createBox('soda', 24, 0, 0)).ok).toBe(false);
    expect(v.cargo.length).toBe(2);
    expect(state.data.boxes.filter((b) => b.location === 'vehicle').length).toBe(2);
  });

  it('ô tô 8 suất: 8 thùng nhỏ hoặc 4 thùng cồng kềnh', () => {
    const { state, vehicles, inventory } = setup();
    const v = vehicles.buy('car', spot).vehicle!;
    for (let i = 0; i < 4; i++) expect(vehicles.load(v.uid, inventory.createBox('tissue', 10, 0, 0)).ok).toBe(true);
    expect(cargoUsed(v, state.data.boxes)).toBe(8);
    expect(canLoad(v, state.data.boxes, 'soda').ok).toBe(false);
    const box = vehicles.unload(v.uid)!;
    expect(box.productId).toBe('tissue');
    expect(canLoad(v, state.data.boxes, 'soda').ok).toBe(true);
  });
});

describe('Mua sỉ tại kho', () => {
  it('rẻ hơn đặt online, thùng có ngay ở bãi lấy hàng', () => {
    const { state, orders } = setup(1000);
    const cart = { soda: 2, noodles: 1 };
    const pad = [{ gx: 80, gy: 5 }, { gx: 80.75, gy: 5 }];
    const r = orders.buyWholesale(cart, pad);
    expect(r.ok).toBe(true);
    expect(wholesaleTotal(cart)).toBeCloseTo(cartTotal(cart) * WHOLESALE_PRICE_FACTOR, 2);
    expect(state.data.money).toBeCloseTo(1000 - wholesaleTotal(cart), 2);
    const boxes = state.data.boxes.filter((b) => r.uids!.includes(b.uid));
    expect(boxes.length).toBe(3);
    for (const b of boxes) expect(b.gx).toBeGreaterThanOrEqual(80);
    expect(state.data.orders.length).toBe(0);
  });

  it('cần giấy phép & đủ tiền', () => {
    expect(setup(1000).orders.buyWholesale({ milk: 1 }, [{ gx: 0, gy: 0 }]).ok).toBe(false);
    expect(setup(1).orders.buyWholesale({ soda: 1 }, [{ gx: 0, gy: 0 }]).ok).toBe(false);
  });
});

describe('Lái xe (mô hình arcade)', () => {
  const car = getVehicle('car');
  const fresh = (): DriveState => ({ x: 0, z: 0, yaw: 0, speed: 0, steer: 0 });

  it('ga → chạy về phía trước (-Z), không vượt tốc độ tối đa', () => {
    const s = fresh();
    for (let i = 0; i < 600; i++) stepDrive(s, { throttle: 1, steer: 0, handbrake: false }, car, 1 / 60);
    expect(s.speed).toBeCloseTo(car.maxSpeed, 5);
    expect(s.z).toBeLessThan(-50);
    expect(Math.abs(s.x)).toBeLessThan(1e-6);
  });

  it('S: phanh rồi lùi chậm hơn; nhả ga: xe trôi rồi dừng', () => {
    const s = fresh();
    for (let i = 0; i < 300; i++) stepDrive(s, { throttle: -1, steer: 0, handbrake: false }, car, 1 / 60);
    expect(s.speed).toBeCloseTo(-car.reverseSpeed, 5);
    for (let i = 0; i < 600; i++) stepDrive(s, { throttle: 0, steer: 0, handbrake: false }, car, 1 / 60);
    expect(s.speed).toBe(0);
  });

  it('A khi chạy tới → rẽ trái; đứng yên thì không xoay', () => {
    const s = fresh();
    for (let i = 0; i < 60; i++) stepDrive(s, { throttle: 0, steer: 1, handbrake: false }, car, 1 / 60);
    expect(s.yaw).toBe(0);
    for (let i = 0; i < 120; i++) stepDrive(s, { throttle: 1, steer: 1, handbrake: false }, car, 1 / 60);
    expect(s.yaw).toBeGreaterThan(0.2);
    expect(s.x).toBeLessThan(0);
    expect(forward(Math.PI / 2).x).toBeCloseTo(-1);
  });
});
