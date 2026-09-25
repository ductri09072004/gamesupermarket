import { h, money, uiRoot } from './dom';

export interface CheckoutStripHandlers {
  onConfirm(): void;
  onExit(): void;
  onUndo(): void;
}

/** Thanh thông tin gọn ở đáy màn hình khi đứng quầy (phần chính diễn ra trong cảnh 3D). */
export class CheckoutStrip {
  private root: HTMLElement | null = null;
  private title!: HTMLElement;
  private info!: HTMLElement;
  private confirm!: HTMLButtonElement;
  private undo!: HTMLButtonElement;

  open(handlers: CheckoutStripHandlers): void {
    this.title = h('b', { text: 'Chờ khách...' });
    this.info = h('div', { class: 'cs-info' });
    this.confirm = h('button', { class: 'btn primary', text: '✔ Xác nhận (Enter)', onClick: () => handlers.onConfirm() });
    this.undo = h('button', { class: 'btn small', text: '↩ Bỏ tờ cuối (Backspace)', onClick: () => handlers.onUndo() });
    this.root = h('div', { class: 'checkout-strip' }, [
      h('div', { class: 'cs-left' }, [this.title, this.info]),
      h('div', { class: 'cs-actions' }, [
        this.undo,
        this.confirm,
        h('button', { class: 'btn small', text: 'Rời quầy (Esc)', onClick: () => handlers.onExit() }),
      ]),
    ]);
    uiRoot().append(this.root);
    requestAnimationFrame(() => this.root?.classList.add('show'));
    this.waiting();
  }

  private set(title: string, info: string, confirm: boolean, undo = false): void {
    if (!this.root) return;
    this.title.textContent = title;
    this.info.innerHTML = info;
    this.confirm.style.display = confirm ? '' : 'none';
    this.undo.style.display = undo ? '' : 'none';
  }

  waiting(): void {
    this.set('🧾 Đang chờ khách', 'Khách sẽ tới quầy khi mua xong.', false);
  }

  scanning(done: number, total: number, sum: number): void {
    this.set(`🛒 Quét hàng ${done}/${total}`, `Click từng món trên băng chuyền (hoặc <kbd>Space</kbd>) · Tổng <b>${money(sum)}</b>`, false);
  }

  cash(total: number, paid: number, due: number, given: number): void {
    const cls = given === due ? 'ok' : given > due ? 'over' : 'short';
    this.set('💵 Tiền mặt', `Tổng <b>${money(total)}</b> · Khách đưa <b>${money(paid)}</b> · Cần thối <b>${money(due)}</b> · Đã thối <b class="${cls}">${money(given)}</b><br><span class="muted">Click khay tiền trong ngăn kéo để lấy tiền thối, click tiền trên quầy để bỏ bớt</span>`, true, true);
  }

  card(total: number, typed: string, error = false): void {
    this.set('💳 Thẻ', `Tổng <b>${money(total)}</b> · Máy POS: <b class="${error ? 'short' : ''}">$${typed || '_'}</b><br><span class="muted">Bấm phím trên máy POS hoặc gõ số trên bàn phím, rồi OK / Enter</span>`, false);
  }

  done(amount: number, note: string): void {
    this.set(`✅ +${money(amount)}`, note, false);
  }

  close(): void {
    const r = this.root;
    this.root = null;
    if (!r) return;
    r.classList.remove('show');
    setTimeout(() => r.remove(), 200);
  }
}
