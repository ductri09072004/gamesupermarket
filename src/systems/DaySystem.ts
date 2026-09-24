import type { Services } from '../core/Services';
import { emptyStats } from '../core/GameState';
import { buildReport, computeExpenses, isGameOver, nextDebtDays, type DayReport } from './DayReport';

/** Kết thúc ngày: trừ chi phí, cập nhật nợ, báo cáo, auto-save. */
export class DaySystem {
  lastReport: DayReport | null = null;

  constructor(private s: Services) {}

  canEndDay(): boolean {
    return this.s.time.isAfterClose() && this.s.customerCount === 0;
  }

  endDay(): DayReport {
    const { economy, data } = this.s;
    const ex = computeExpenses(data);
    economy.spend(ex.rent, 'Tiền thuê mặt bằng', true);
    economy.spend(ex.electricity, 'Tiền điện', true);
    if (ex.wages > 0) economy.spend(ex.wages, 'Lương nhân viên', true);
    data.debtDays = nextDebtDays(data.money, data.debtDays);
    data.gameOver = isGameOver(data.debtDays, data.settings.gameOverEnabled);
    const report = buildReport(data, ex);
    this.lastReport = report;
    this.s.bus.emit('day:ended', { report });
    if (data.gameOver) {
      this.s.saves.clear();
      this.s.bus.emit('game:over', {});
    }
    return report;
  }

  startNextDay(): void {
    const d = this.s.data;
    d.stats = emptyStats(d.reputation);
    d.storeOpen = false;
    this.s.time.startNewDay();
    this.s.staff.refreshCandidates();
    this.s.bus.emit('store:toggled', { open: false });
    this.s.save();
  }
}
