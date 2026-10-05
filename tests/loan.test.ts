import { describe, expect, it } from 'vitest';
import { LOAN } from '../src/config/constants';
import { getFurniture } from '../src/config/furniture';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState } from '../src/core/GameState';
import { migrate } from '../src/core/SaveSystem';
import { computeExpenses } from '../src/systems/DayReport';
import { EconomySystem } from '../src/systems/EconomySystem';
import { InventorySystem } from '../src/systems/InventorySystem';
import { creditAvailable, creditLimit, dueAmount, earlyPayoff, interestFor, LoanSystem } from '../src/systems/LoanSystem';
import { OrderSystem } from '../src/systems/OrderSystem';
import { ShopSystem } from '../src/systems/ShopSystem';

function setup(level = 1, money = 1000) {
  const state = new GameState(createNewState(1));
  state.data.level = level;
  state.data.money = money;
  const bus = new EventBus<GameEvents>();
  const economy = new EconomySystem(state, bus);
  const loans = new LoanSystem(state, bus, economy);
  const orders = new OrderSystem(state, bus, economy, new InventorySystem(state, bus), () => 0.5, () => [{ gx: 5, gy: 11 }], () => [{ gx: 8, gy: 11 }]);
  const shop = new ShopSystem(state, bus, economy, orders);
  return { state, economy, loans, shop };
}

describe('vay vốn ngân hàng', () => {
  it('hạn mức tăng theo cấp', () => {
    expect(creditLimit(1)).toBe(LOAN.limitPerLevel);
    expect(creditLimit(5)).toBe(5 * LOAN.limitPerLevel);
    expect(creditLimit(5)).toBeGreaterThan(creditLimit(2));
  });

  it('lãi đơn theo ngày, kỳ hạn dài lãi suất cao hơn', () => {
    expect(interestFor(1000, 0.01, 3)).toBe(30);
    const [a, b, c] = LOAN.terms;
    expect(b.dailyRate).toBeGreaterThan(a.dailyRate);
    expect(c.dailyRate).toBeGreaterThan(b.dailyRate);
  });

  it('vay: tiền vào ngay, ghi kỳ hạn; không vượt hạn mức và số khoản', () => {
    const { state, loans } = setup(2);
    expect(loans.borrow(1500, 1).ok).toBe(true);
    expect(state.data.money).toBe(2500);
    expect(state.data.loans[0]).toMatchObject({ principal: 1500, termDays: 7, dueDay: state.data.day + 7, dailyRate: 0.012 });
    expect(loans.available()).toBe(500);
    expect(loans.borrow(600, 0).ok).toBe(false); // vượt hạn mức cấp 2
    expect(loans.borrow(50, 0).ok).toBe(false); // quá nhỏ
    expect(loans.borrow(100, 9).ok).toBe(false); // gói không có
    expect(loans.borrow(100, 0).ok).toBe(true);
    expect(loans.borrow(100, 0).ok).toBe(true);
    expect(loans.borrow(100, 0).ok).toBe(false); // tối đa 3 khoản
  });

  it('hạn mức cao hơn khi lên cấp', () => {
    expect(creditAvailable(1, [])).toBeLessThan(creditAvailable(4, []));
  });

  it('tất toán sớm chỉ tính lãi số ngày đã vay; không đủ tiền thì từ chối', () => {
    const { state, loans } = setup(3);
    loans.borrow(1000, 2);
    const l = state.data.loans[0];
    state.data.day += 4;
    expect(earlyPayoff(l, state.data.day)).toBe(1000 + interestFor(1000, 0.015, 4));
    expect(earlyPayoff(l, state.data.day)).toBeLessThan(dueAmount(l));
    state.data.money = 10;
    expect(loans.repay(l.id).ok).toBe(false);
    state.data.money = 5000;
    expect(loans.repay(l.id).ok).toBe(true);
    expect(state.data.loans).toHaveLength(0);
  });

  it('đáo hạn: cuối ngày tự trừ gốc + lãi (được âm tiền), lãi tính vào chi phí', () => {
    const { state, loans } = setup(1);
    loans.borrow(1000, 0);
    state.data.money = 100;
    state.data.day += 3;
    const ex = computeExpenses(state.data);
    expect(ex.interest).toBe(30);
    expect(ex.loanPrincipal).toBe(1000);
    expect(loans.settleDue()).toEqual({ principal: 1000, interest: 30 });
    expect(state.data.money).toBe(100 - 1030);
    expect(state.data.loans).toHaveLength(0);
  });

  it('bản lưu cũ không có khoản vay vẫn nạp được', () => {
    const raw = JSON.parse(JSON.stringify(createNewState(1))) as Record<string, unknown>;
    delete raw.loans;
    expect(migrate(raw).loans).toEqual([]);
  });
});

describe('giỏ nội thất', () => {
  it('mua cả giỏ: trả tiền một lần, một đơn giao nhiều thùng', () => {
    const { state, shop } = setup(1, 5000);
    const total = getFurniture('shelf_small').price * 2 + getFurniture('trash').price;
    expect(shop.furnitureCartTotal({ shelf_small: 2, trash: 1 })).toBe(total);
    expect(shop.buyFurnitureCart({ shelf_small: 2, trash: 1 }).ok).toBe(true);
    expect(state.data.money).toBeCloseTo(5000 - total);
    expect(state.data.orders).toHaveLength(1);
    expect(state.data.orders[0].furniture).toEqual(['shelf_small', 'shelf_small', 'trash']);
  });

  it('giỏ trống / không đủ tiền thì không trừ tiền', () => {
    const { state, shop } = setup(1, 50);
    expect(shop.buyFurnitureCart({}).ok).toBe(false);
    expect(shop.buyFurnitureCart({ shelf_small: 1 }).ok).toBe(false);
    expect(state.data.money).toBe(50);
    expect(state.data.orders).toHaveLength(0);
  });
});
