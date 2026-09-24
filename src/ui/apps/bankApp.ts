import { formatClock } from '../../systems/TimeSystem';
import { computeExpenses } from '../../systems/DayReport';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

export function renderBank(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const d = s.data;
  const ex = computeExpenses(d);
  body.append(
    h('div', { class: 'bank-balance' }, [h('span', { text: 'Số dư' }), h('b', { class: d.money < 0 ? 'neg' : '', text: money(d.money) })]),
    h('div', { class: 'bank-stats' }, [
      h('div', {}, ['Doanh thu hôm nay: ', h('b', { text: money(d.stats.revenue) })]),
      h('div', {}, ['Khách hôm nay: ', h('b', { text: String(d.stats.customers) })]),
      h('div', {}, ['Chi phí dự kiến cuối ngày: ', h('b', { text: money(ex.rent + ex.electricity + ex.wages) })]),
      d.debtDays > 0 ? h('div', { class: 'warn' }, [`⚠ Đang nợ ${d.debtDays} ngày (quá 3 ngày → phá sản)`]) : null,
    ]),
    h('h3', { text: 'Lịch sử giao dịch' }),
    h('div', { class: 'tx-list' }, d.transactions.length === 0
      ? [h('div', { class: 'muted', text: 'Chưa có giao dịch.' })]
      : d.transactions.slice(0, 60).map((t) => h('div', { class: 'tx' }, [
        h('span', { class: 'muted small', text: `N${t.day} ${formatClock(t.minutes)}` }),
        h('span', { text: t.label }),
        h('b', { class: t.amount >= 0 ? 'pos' : 'neg', text: `${t.amount >= 0 ? '+' : ''}${money(t.amount)}` }),
      ]))),
  );
}
