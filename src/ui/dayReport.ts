import type { DayReport } from '../systems/DayReport';
import { countUp, h, modal, money } from './dom';

/** Báo cáo cuối ngày với hiệu ứng số chạy. */
export function showDayReport(r: DayReport, onNext: () => void): void {
  const rows: Array<[string, number, 'money' | 'int', string?]> = [
    ['Doanh thu', r.revenue, 'money', 'pos'],
    ['Giá vốn hàng bán', -r.cogs, 'money', 'neg'],
    ['Lợi nhuận gộp', r.grossProfit, 'money', 'strong'],
    ['Tiền thuê mặt bằng', -r.expenses.rent, 'money', 'neg'],
    ['Tiền điện', -r.expenses.electricity, 'money', 'neg'],
    ['Lương nhân viên', -r.expenses.wages, 'money', 'neg'],
    ['Thối tiền dư', -r.changeLoss, 'money', 'neg'],
    ['Lợi nhuận ròng', r.netProfit, 'money', 'total'],
  ];
  const table = h('div', { class: 'report-table' });
  rows.forEach(([label, value, kind, cls], i) => {
    const v = h('b', { text: kind === 'money' ? money(0) : '0' });
    table.append(h('div', { class: `report-row ${cls ?? ''} ${value < 0 && cls === 'total' ? 'neg' : ''}`, style: { animationDelay: `${i * 90}ms` } }, [h('span', { text: label }), v]));
    setTimeout(() => countUp(v, 0, value, 700, (n) => (kind === 'money' ? money(n) : String(Math.round(n)))), 200 + i * 90);
  });
  const repDelta = r.repEnd - r.repStart;
  const stats = h('div', { class: 'report-stats' }, [
    h('div', { class: 'stat' }, [h('div', { class: 'stat-n', text: String(r.customers) }), h('div', { class: 'muted', text: 'Khách mua hàng' })]),
    h('div', { class: 'stat' }, [h('div', { class: 'stat-n', text: String(r.walkouts) }), h('div', { class: 'muted', text: 'Khách bỏ về' })]),
    h('div', { class: 'stat' }, [h('div', { class: 'stat-n', text: String(r.itemsSold) }), h('div', { class: 'muted', text: 'Món đã bán' })]),
    h('div', { class: 'stat' }, [h('div', { class: `stat-n ${repDelta >= 0 ? 'pos' : 'neg'}`, text: `${repDelta >= 0 ? '+' : ''}${repDelta.toFixed(2)}★` }), h('div', { class: 'muted', text: 'Danh tiếng' })]),
    h('div', { class: 'stat' }, [h('div', { class: 'stat-n', text: `+${r.xpGained}` }), h('div', { class: 'muted', text: `XP · Cấp ${r.level}` })]),
  ]);
  const body = h('div', { class: 'day-report' }, [
    stats,
    table,
    h('div', { class: `report-balance ${r.moneyEnd < 0 ? 'neg' : ''}` }, ['Số dư cuối ngày: ', h('b', { text: money(r.moneyEnd) })]),
    r.debtDays > 0 && !r.gameOver ? h('div', { class: 'warn', text: `⚠ Bạn đang nợ ${r.debtDays} ngày. Nợ quá 3 ngày sẽ phá sản!` }) : null,
  ]);
  const btn = h('button', { class: 'btn primary block big', text: r.gameOver ? 'Xem kết quả' : '☀️ Bắt đầu ngày mới', onClick: () => { m.close(); } });
  body.append(btn);
  const m = modal(`🌙 Báo cáo cuối ngày ${r.day}`, body, { onClose: onNext, closable: false, wide: true });
}
