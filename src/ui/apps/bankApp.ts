import { LOAN } from '../../config/constants';
import { creditAvailable, creditLimit, daysLeft, dueAmount, earlyPayoff, interestFor, outstanding } from '../../systems/LoanSystem';
import { formatClock } from '../../systems/TimeSystem';
import { computeExpenses } from '../../systems/DayReport';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

/** Số tiền & gói vay đang chọn (giữ khi vẽ lại giao diện) */
const pick = { amount: 0, term: 1 };

function renderLoans(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const d = s.data;
  const limit = creditLimit(d.level);
  const debt = outstanding(d.loans);
  const avail = creditAvailable(d.level, d.loans);
  const full = d.loans.length >= LOAN.maxActive;
  const canBorrow = avail >= LOAN.minAmount && !full;
  if (pick.amount <= 0 || pick.amount > avail) pick.amount = Math.max(LOAN.minAmount, Math.min(avail, Math.round(limit / 2 / 50) * 50));
  pick.amount = Math.max(0, Math.min(pick.amount, avail));
  const term = LOAN.terms[pick.term];
  const interest = interestFor(pick.amount, term.dailyRate, term.days);
  const amountLabel = h('b', { text: money(pick.amount) });
  const slider = h('input', { class: 'loan-range', attrs: { type: 'range', min: String(LOAN.minAmount), max: String(Math.max(LOAN.minAmount, avail)), step: '50', value: String(pick.amount) } }) as HTMLInputElement;
  slider.disabled = !canBorrow;
  slider.addEventListener('input', () => {
    pick.amount = Number(slider.value);
    amountLabel.textContent = money(pick.amount);
  });
  slider.addEventListener('change', () => ctx.rerender());
  const cards = LOAN.terms.map((t, i) => h('button', {
    class: `loan-term ${i === pick.term ? 'on' : ''}`,
    onClick: () => { pick.term = i; ctx.rerender(); },
  }, [
    h('b', { text: `${t.name} · ${t.days} ngày` }),
    h('span', { class: 'muted small', text: `Lãi ${(t.dailyRate * 100).toFixed(1)}%/ngày` }),
    h('span', { class: 'small', text: `Lãi cả kỳ ${money(interestFor(pick.amount, t.dailyRate, t.days))}` }),
  ]));
  const active = d.loans.map((l) => h('div', { class: 'cart-line loan-line' }, [
    h('span', {}, [`Vay ${money(l.principal)} · lãi ${(l.dailyRate * 100).toFixed(1)}%/ngày · đến hạn ngày ${l.dueDay} (còn ${daysLeft(l, d.day)} ngày) · phải trả `, h('b', { text: money(dueAmount(l)) })]),
    h('button', {
      class: 'btn tiny', text: `Tất toán ${money(earlyPayoff(l, d.day))}`, disabled: !s.economy.canAfford(earlyPayoff(l, d.day)),
      onClick: () => {
        const r = s.loans.repay(l.id);
        if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
        else s.bus.emit('sound', { name: 'coin' });
        ctx.rerender();
      },
    }),
  ]));
  body.append(
    h('h3', { text: '🏦 Vay vốn' }),
    h('div', { class: 'bank-stats' }, [
      h('div', {}, [`Hạn mức theo cấp ${d.level}: `, h('b', { text: money(limit) }), h('span', { class: 'muted small', text: ` (+${money(LOAN.limitPerLevel)} mỗi cấp)` })]),
      h('div', {}, ['Dư nợ gốc: ', h('b', { class: debt > 0 ? 'neg' : '', text: money(debt) }), ' · Còn vay được: ', h('b', { text: money(avail) })]),
    ]),
    h('div', { class: 'loan-box' }, [
      h('div', { class: 'loan-amount' }, [h('span', { text: 'Số tiền vay ' }), amountLabel]),
      slider,
      h('div', { class: 'loan-terms' }, cards),
      h('div', { class: 'muted small', text: `Trả cả gốc + lãi ${money(pick.amount + interest)} vào cuối ngày đến hạn (tự trừ vào tài khoản; thiếu tiền sẽ bị ghi nợ). Trả trước hạn chỉ tính lãi số ngày đã vay.` }),
      h('button', {
        class: 'btn primary block', disabled: !canBorrow,
        text: full ? `Đã vay ${LOAN.maxActive} khoản — hãy trả bớt` : avail < LOAN.minAmount ? 'Đã hết hạn mức — lên cấp để vay thêm' : `Vay ${money(pick.amount)}`,
        onClick: () => {
          const r = s.loans.borrow(pick.amount, pick.term);
          if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          else s.bus.emit('sound', { name: 'coin' });
          ctx.rerender();
        },
      }),
    ]),
    ...(active.length ? [h('h4', { text: 'Các khoản đang vay' }), ...active] : []),
  );
}

export function renderBank(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const d = s.data;
  const ex = computeExpenses(d);
  body.append(
    h('div', { class: 'bank-balance' }, [h('span', { text: 'Số dư' }), h('b', { class: d.money < 0 ? 'neg' : '', text: money(d.money) })]),
    h('div', { class: 'bank-stats' }, [
      h('div', {}, ['Doanh thu hôm nay: ', h('b', { text: money(d.stats.revenue) })]),
      h('div', {}, ['Khách hôm nay: ', h('b', { text: String(d.stats.customers) })]),
      h('div', {}, ['Chi phí dự kiến cuối ngày: ', h('b', { text: money(ex.rent + ex.electricity + ex.wages + ex.interest + ex.loanPrincipal) })]),
      d.debtDays > 0 ? h('div', { class: 'warn' }, [`⚠ Đang nợ ${d.debtDays} ngày (quá 3 ngày → phá sản)`]) : null,
    ]),
  );
  renderLoans(body, ctx);
  body.append(
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
