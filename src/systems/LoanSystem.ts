import { LOAN } from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState, LoanData } from '../core/GameState';
import { formatMoney as money, round2 } from '../core/Random';
import type { EconomySystem } from './EconomySystem';

type R = { ok: boolean; reason?: string };

/** Hạn mức vay theo cấp người chơi. */
export function creditLimit(level: number): number {
  return LOAN.limitPerLevel * Math.max(1, level);
}

/** Tổng dư nợ gốc đang vay. */
export function outstanding(loans: LoanData[]): number {
  return round2(loans.reduce((a, l) => a + l.principal, 0));
}

/** Còn vay thêm được bao nhiêu. */
export function creditAvailable(level: number, loans: LoanData[]): number {
  return Math.max(0, round2(creditLimit(level) - outstanding(loans)));
}

/** Tiền lãi (lãi đơn theo ngày) cho `days` ngày. */
export function interestFor(principal: number, dailyRate: number, days: number): number {
  return round2(principal * dailyRate * days);
}

/** Số tiền phải trả khi đáo hạn (gốc + lãi cả kỳ). */
export function dueAmount(l: LoanData): number {
  return round2(l.principal + interestFor(l.principal, l.dailyRate, l.termDays));
}

/** Trả trước hạn: gốc + lãi các ngày đã vay (tối thiểu 1 ngày). */
export function earlyPayoff(l: LoanData, today: number): number {
  const elapsed = Math.min(l.termDays, Math.max(1, today - l.startDay));
  return round2(l.principal + interestFor(l.principal, l.dailyRate, elapsed));
}

export function daysLeft(l: LoanData, today: number): number {
  return Math.max(0, l.dueDay - today);
}

/** Khoản vay đến hạn vào cuối ngày `day`. */
export function dueLoans(loans: LoanData[], day: number): LoanData[] {
  return loans.filter((l) => l.dueDay <= day);
}

export class LoanSystem {
  constructor(private state: GameState, private bus: EventBus<GameEvents>, private economy: EconomySystem) {}

  get loans(): LoanData[] {
    return this.state.data.loans;
  }

  limit(): number {
    return creditLimit(this.state.data.level);
  }

  available(): number {
    return creditAvailable(this.state.data.level, this.loans);
  }

  /** Vay `amount` theo gói kỳ hạn `termIndex`; tiền vào tài khoản ngay. */
  borrow(amount: number, termIndex: number): R {
    const term = LOAN.terms[termIndex];
    if (!term) return { ok: false, reason: 'Gói vay không hợp lệ' };
    if (this.loans.length >= LOAN.maxActive) return { ok: false, reason: `Chỉ vay tối đa ${LOAN.maxActive} khoản cùng lúc` };
    if (!(amount >= LOAN.minAmount)) return { ok: false, reason: 'Số tiền vay quá nhỏ' };
    if (amount > this.available() + 1e-9) return { ok: false, reason: 'Vượt hạn mức vay của cấp hiện tại' };
    const d = this.state.data;
    const loan: LoanData = {
      id: this.state.newUid('l'), principal: round2(amount), dailyRate: term.dailyRate, termDays: term.days,
      startDay: d.day, dueDay: d.day + term.days,
    };
    d.loans.push(loan);
    this.economy.addMoney(loan.principal, 'Vay ngân hàng');
    this.bus.emit('toast', { message: `🏦 Đã vay, đến hạn ngày ${loan.dueDay}`, kind: 'success' });
    return { ok: true };
  }

  /** Trả nợ trước hạn (không cho âm tiền). */
  repay(id: string): R {
    const l = this.loans.find((x) => x.id === id);
    if (!l) return { ok: false, reason: 'Không tìm thấy khoản vay' };
    const cost = earlyPayoff(l, this.state.data.day);
    if (!this.economy.spend(cost, 'Trả nợ trước hạn')) return { ok: false, reason: 'Không đủ tiền' };
    this.state.data.loans = this.loans.filter((x) => x !== l);
    this.bus.emit('toast', { message: '✅ Đã tất toán khoản vay', kind: 'success' });
    return { ok: true };
  }

  /** Cuối ngày: thu nợ khoản đến hạn (có thể làm tiền âm → tính ngày nợ như chi phí khác). Trả về {gốc, lãi} đã thu. */
  settleDue(): { principal: number; interest: number } {
    const d = this.state.data;
    const due = dueLoans(d.loans, d.day);
    let principal = 0;
    let interest = 0;
    for (const l of due) {
      const pay = dueAmount(l);
      this.economy.spend(pay, 'Trả nợ vay đến hạn', true);
      principal += l.principal;
      interest += pay - l.principal;
    }
    d.loans = d.loans.filter((l) => !due.includes(l));
    for (const l of d.loans) {
      if (l.dueDay === d.day + 1) this.bus.emit('toast', { message: `🏦 Ngày mai đến hạn trả một khoản vay (${money(dueAmount(l))})`, kind: 'info' });
    }
    return { principal: round2(principal), interest: round2(interest) };
  }
}
