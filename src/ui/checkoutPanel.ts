import { DENOMINATIONS } from '../config/constants';
import { getProduct } from '../config/products';
import { changeDueCents, fromCents, posInput, type CheckoutItem } from '../systems/CheckoutSystem';
import { clear, h, money, uiRoot } from './dom';

export interface CheckoutHandlers {
  onScan(index: number): void;
  onCashConfirm(givenCents: number): void;
  onCardSubmit(input: string): boolean;
  onExit(): void;
}

/** Bảng thu ngân (DOM) ở nửa dưới màn hình. */
export class CheckoutPanel {
  private root: HTMLElement | null = null;
  private belt!: HTMLElement;
  private bag!: HTMLElement;
  private screen!: HTMLElement;
  private pay!: HTMLElement;
  private handlers: CheckoutHandlers | null = null;
  private items: CheckoutItem[] = [];
  private change: number[] = [];
  private pos = '';
  private stage: 'wait' | 'scan' | 'cash' | 'card' | 'done' = 'wait';
  private dueCents = 0;

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(handlers: CheckoutHandlers): void {
    this.handlers = handlers;
    this.belt = h('div', { class: 'co-belt' });
    this.bag = h('div', { class: 'co-bag' }, [h('div', { class: 'co-bag-icon', text: '🛍️' })]);
    this.screen = h('div', { class: 'co-screen' });
    this.pay = h('div', { class: 'co-pay' });
    this.root = h('div', { class: 'checkout-panel' }, [
      h('div', { class: 'co-header' }, [
        h('b', { text: '🧾 Quầy thu ngân' }),
        h('span', { class: 'co-hint', text: 'Click món hoặc Space để quét · Esc rời quầy' }),
        h('button', { class: 'btn small', text: 'Rời quầy (Esc)', onClick: () => this.handlers?.onExit() }),
      ]),
      h('div', { class: 'co-main' }, [
        h('div', { class: 'co-left' }, [h('div', { class: 'co-label', text: 'Băng chuyền' }), this.belt, this.bag]),
        this.screen,
        this.pay,
      ]),
    ]);
    uiRoot().append(this.root);
    requestAnimationFrame(() => this.root?.classList.add('show'));
    this.showWaiting();
  }

  close(): void {
    const r = this.root;
    this.root = null;
    this.handlers = null;
    if (r) {
      r.classList.remove('show');
      setTimeout(() => r.remove(), 200);
    }
  }

  showWaiting(): void {
    if (!this.root) return;
    this.stage = 'wait';
    clear(this.belt);
    clear(this.pay);
    this.belt.append(h('div', { class: 'co-empty', text: 'Đang chờ khách...' }));
    this.renderScreen('Chờ khách', 0, 'Khách sẽ tới quầy khi mua xong');
  }

  private renderScreen(title: string, total: number, sub: string): void {
    clear(this.screen);
    this.screen.append(
      h('div', { class: 'co-screen-title', text: title }),
      h('div', { class: 'co-total', text: money(total) }),
      h('div', { class: 'co-sub', text: sub }),
    );
  }

  showItems(items: CheckoutItem[]): void {
    if (!this.root) return;
    this.stage = 'scan';
    this.items = items;
    clear(this.belt);
    clear(this.pay);
    items.forEach((it, i) => {
      const p = getProduct(it.productId);
      const el = h('button', {
        class: 'co-item', title: `${p.name} — ${money(it.price)}`,
        style: { background: p.color, animationDelay: `${i * 60}ms` },
        onClick: () => this.handlers?.onScan(i),
      }, [h('span', { class: 'co-item-icon', text: p.icon }), h('span', { class: 'co-item-price', text: money(it.price) })]);
      el.dataset.index = String(i);
      this.belt.append(el);
    });
    this.pay.append(h('div', { class: 'co-wait', text: '🔎 Quét hết các món để thanh toán' }));
    this.renderScreen(`Khách: ${items.length} món`, 0, 'Quét từng món trên băng chuyền');
  }

  markScanned(i: number, total: number, scannedCount: number): void {
    const el = this.belt.querySelector<HTMLButtonElement>(`[data-index="${i}"]`);
    if (el) {
      el.classList.add('scanned');
      el.disabled = true;
      const r1 = el.getBoundingClientRect();
      const r2 = this.bag.getBoundingClientRect();
      el.style.setProperty('--dx', `${r2.left - r1.left}px`);
      el.style.setProperty('--dy', `${r2.top - r1.top}px`);
      setTimeout(() => el.remove(), 380);
    }
    this.bag.classList.remove('pulse');
    void this.bag.offsetWidth;
    this.bag.classList.add('pulse');
    this.renderScreen(`Đã quét ${scannedCount}/${this.items.length}`, total, 'Tổng tiền');
  }

  nextUnscanned(): number {
    return this.items.findIndex((it) => !it.scanned);
  }

  showCash(total: number, paid: number): void {
    if (!this.root) return;
    this.stage = 'cash';
    this.change = [];
    this.dueCents = changeDueCents(total, paid);
    this.renderScreen('💵 Tiền mặt', total, `Khách đưa ${money(paid)}`);
    this.renderCash(paid);
  }

  private renderCash(paid: number): void {
    clear(this.pay);
    const given = this.change.reduce((a, d) => a + Math.round(d * 100), 0);
    const ok = given === this.dueCents;
    const drawer = h('div', { class: 'co-drawer' }, DENOMINATIONS.map((d) => h('button', {
      class: `denom ${d >= 1 ? 'bill' : 'coin'}`, text: d >= 1 ? `$${d}` : `${Math.round(d * 100)}¢`,
      onClick: () => { this.change.push(d); this.renderCash(paid); },
    })));
    const chips = h('div', { class: 'co-change' }, this.change.length === 0
      ? [h('span', { class: 'muted', text: 'Click mệnh giá để thêm tiền thối, click lại để bỏ' })]
      : this.change.map((d, i) => h('button', {
        class: `chip ${d >= 1 ? 'bill' : 'coin'}`, text: d >= 1 ? `$${d}` : `${Math.round(d * 100)}¢`,
        onClick: () => { this.change.splice(i, 1); this.renderCash(paid); },
      })));
    this.pay.append(
      h('div', { class: 'co-change-info' }, [
        h('div', {}, ['Cần thối: ', h('b', { text: money(fromCents(this.dueCents)) })]),
        h('div', { class: ok ? 'ok' : given > this.dueCents ? 'over' : 'short' }, ['Đã thối: ', h('b', { text: money(fromCents(given)) })]),
      ]),
      chips,
      drawer,
      h('button', { class: `btn primary ${ok ? 'glow' : ''}`, text: '✔ Xác nhận (Enter)', onClick: () => this.confirmCash() }),
    );
  }

  private confirmCash(): void {
    if (this.stage !== 'cash') return;
    const given = this.change.reduce((a, d) => a + Math.round(d * 100), 0);
    this.handlers?.onCashConfirm(given);
  }

  showCard(total: number): void {
    if (!this.root) return;
    this.stage = 'card';
    this.pos = '';
    this.renderScreen('💳 Thẻ', total, 'Nhập đúng số tiền vào máy POS');
    this.renderCard(false);
  }

  private renderCard(error: boolean): void {
    clear(this.pay);
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];
    this.pay.append(
      h('div', { class: `pos-display ${error ? 'error' : ''}`, text: this.pos ? `$${this.pos}` : '$_' }),
      h('div', { class: 'pos-keys' }, [
        ...keys.map((k) => h('button', { class: 'pos-key', text: k === 'back' ? '⌫' : k, onClick: () => this.pressKey(k) })),
        h('button', { class: 'pos-key clear', text: 'C', onClick: () => this.pressKey('clear') }),
        h('button', { class: 'pos-key enter', text: 'Enter ⏎', onClick: () => this.pressKey('enter') }),
      ]),
    );
  }

  /** Phím từ bàn phím thật hoặc keypad. */
  pressKey(key: string): void {
    if (this.stage === 'scan' && key === 'space') {
      const i = this.nextUnscanned();
      if (i >= 0) this.handlers?.onScan(i);
      return;
    }
    if (this.stage === 'cash' && key === 'enter') {
      this.confirmCash();
      return;
    }
    if (this.stage !== 'card') return;
    if (key === 'enter') {
      const ok = this.handlers?.onCardSubmit(this.pos) ?? false;
      if (!ok) {
        this.pos = '';
        this.renderCard(true);
      }
      return;
    }
    this.pos = posInput(this.pos, key);
    this.renderCard(false);
  }

  showDone(amount: number, note: string): void {
    if (!this.root) return;
    this.stage = 'done';
    clear(this.pay);
    clear(this.belt);
    this.pay.append(h('div', { class: 'co-done', text: `✅ +${money(amount)}` }), h('div', { class: 'muted', text: note }));
    this.renderScreen('Hoàn tất', amount, note);
  }
}
