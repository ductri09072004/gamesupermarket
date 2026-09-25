import { TRANSACTION_HISTORY } from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../core/GameState';
import { round2 } from '../core/Random';

export class EconomySystem {
  constructor(private state: GameState, private bus: EventBus<GameEvents>) {}

  get money(): number {
    return this.state.data.money;
  }

  canAfford(amount: number): boolean {
    return this.state.data.money >= amount - 1e-9;
  }

  private record(amount: number, label: string): void {
    const d = this.state.data;
    d.money = round2(d.money + amount);
    d.transactions.unshift({ day: d.day, minutes: Math.floor(d.minutes), amount: round2(amount), label, balance: d.money });
    if (d.transactions.length > TRANSACTION_HISTORY) d.transactions.length = TRANSACTION_HISTORY;
    this.bus.emit('money:changed', { money: d.money, delta: round2(amount), reason: label });
  }

  addMoney(amount: number, label: string): void {
    if (amount === 0) return;
    this.record(amount, label);
  }

  /** Chi tiền. Không đủ tiền → false (trừ khi allowDebt). */
  spend(amount: number, label: string, allowDebt = false): boolean {
    if (amount < 0) throw new Error('spend amount must be >= 0');
    if (!allowDebt && !this.canAfford(amount)) return false;
    if (amount > 0) this.record(-amount, label);
    return true;
  }

  /** Ghi nhận doanh thu bán hàng vào thống kê trong ngày. */
  recordSale(revenue: number, cogs: number, items: number, countCustomer = true): void {
    const s = this.state.data.stats;
    s.revenue = round2(s.revenue + revenue);
    s.cogs = round2(s.cogs + cogs);
    s.itemsSold += items;
    if (countCustomer) s.customers += 1;
  }
}
