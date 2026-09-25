import { describe, expect, it, vi } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState } from '../src/core/GameState';
import { EconomySystem } from '../src/systems/EconomySystem';
import { ShopSystem } from '../src/systems/ShopSystem';
import { applyXp, ProgressionSystem, xpNeeded } from '../src/systems/ProgressionSystem';
import { buildReport, computeExpenses, isGameOver, nextDebtDays } from '../src/systems/DayReport';

function setup() {
  const bus = new EventBus<GameEvents>();
  const state = new GameState(createNewState(1));
  return { bus, state, eco: new EconomySystem(state, bus), prog: new ProgressionSystem(state, bus) };
}

describe('EconomySystem', () => {
  it('cộng tiền, ghi lịch sử và emit money:changed', () => {
    const { bus, state, eco } = setup();
    const fn = vi.fn();
    bus.on('money:changed', fn);
    eco.addMoney(12.345, 'Bán hàng');
    expect(state.data.money).toBe(1512.35);
    expect(fn).toHaveBeenCalledWith({ money: 1512.35, delta: 12.35, reason: 'Bán hàng' });
    expect(state.data.transactions[0]).toMatchObject({ label: 'Bán hàng', amount: 12.35, balance: 1512.35 });
  });

  it('spend từ chối khi thiếu tiền, trừ khi cho phép nợ', () => {
    const { state, eco } = setup();
    expect(eco.spend(2000, 'x')).toBe(false);
    expect(state.data.money).toBe(1500);
    expect(eco.spend(1500, 'y')).toBe(true);
    expect(state.data.money).toBe(0);
    expect(eco.spend(10, 'rent', true)).toBe(true);
    expect(state.data.money).toBe(-10);
  });

  it('thống kê doanh thu', () => {
    const { state, eco } = setup();
    eco.recordSale(10, 6, 3);
    eco.recordSale(5.5, 3, 1);
    expect(state.data.stats).toMatchObject({ revenue: 15.5, cogs: 9, itemsSold: 4, customers: 2 });
  });

  it('lịch sử giới hạn độ dài', () => {
    const { state, eco } = setup();
    for (let i = 0; i < 150; i++) eco.addMoney(1, 'a');
    expect(state.data.transactions.length).toBe(100);
  });
});

describe('Progression', () => {
  it('XP lên cấp', () => {
    expect(applyXp(1, 0, xpNeeded(1) - 1).level).toBe(1);
    const r = applyXp(1, 0, xpNeeded(1) + xpNeeded(2) + 5);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(5);
  });

  it('danh tiếng bị giới hạn 0..5', () => {
    const { state, prog } = setup();
    prog.changeReputation(10);
    expect(state.data.reputation).toBe(5);
    prog.changeReputation(-20);
    expect(state.data.reputation).toBe(0);
  });
});

describe('Cuối ngày', () => {
  it('chi phí theo diện tích, tủ lạnh và lương', () => {
    const d = createNewState(1);
    const base = computeExpenses(d);
    expect(base.rent).toBeCloseTo(12 * 10 * 0.4);
    d.furniture.push({ uid: 'x', type: 'fridge', gx: 0, gy: 0, rot: 0, slots: [], boxes: [] });
    d.staff.push({ uid: 's', name: 'A', role: 'cashier', wage: 60, speed: 1, shirt: 0 });
    const e = computeExpenses(d);
    expect(e.electricity).toBe(base.electricity + 12);
    expect(e.wages).toBe(60);
    const r = buildReport(d, e);
    expect(r.totalExpenses).toBeCloseTo(e.rent + e.electricity + 60);
  });

  it('game over khi nợ quá 3 ngày', () => {
    let debt = 0;
    for (let i = 0; i < 4; i++) debt = nextDebtDays(-5, debt);
    expect(debt).toBe(4);
    expect(isGameOver(debt, true)).toBe(true);
    expect(isGameOver(debt, false)).toBe(false);
    expect(isGameOver(3, true)).toBe(false);
    expect(nextDebtDays(10, 3)).toBe(0);
  });
});

describe('Giấy phép Thời trang / Điện tử', () => {
  it('Thời trang cần Sữa & Lạnh, Điện tử cần Thời trang', () => {
    const state = new GameState(createNewState(1));
    const bus = new EventBus<GameEvents>();
    const shop = new ShopSystem(state, bus, new EconomySystem(state, bus));
    state.data.level = 10;
    state.data.money = 100000;
    expect(shop.licenseStatus(5)).toBe('locked-prev');
    expect(shop.buyLicense(1).ok).toBe(true);
    expect(shop.licenseStatus(5)).toBe('available');
    expect(shop.licenseStatus(6)).toBe('locked-prev');
    expect(shop.buyLicense(5).ok).toBe(true);
    expect(shop.buyLicense(6).ok).toBe(true);
  });
});
