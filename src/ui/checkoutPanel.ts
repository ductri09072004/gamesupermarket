import { h, money, uiRoot } from './dom';

export interface CheckoutStripHandlers {
  onConfirm(): void;
  onExit(): void;
  onUndo(): void;
}

/**
 * Thanh thông tin nhỏ ở đỉnh màn hình khi đứng quầy (phần chính diễn ra trong cảnh 3D: băng chuyền, ngăn kéo tiền, máy POS).
 * Nằm trên cùng, một dòng gọn, để không che tiền / ngăn kéo ở nửa dưới màn hình.
 */
export class CheckoutStrip {
  private root: HTMLElement | null = null;
  private title!: HTMLElement;
  private info!: HTMLElement;
  private hint!: HTMLElement;
  private confirm!: HTMLButtonElement;
  private undo!: HTMLButtonElement;

  open(handlers: CheckoutStripHandlers): void {
    this.title = h('b', { class: 'cs-title', text: 'Chờ khách' });
    this.info = h('span', { class: 'cs-info' });
    this.hint = h('span', { class: 'cs-hint' });
    this.confirm = h('button', { class: 'cs-btn primary', html: 'Xác nhận <kbd>↵</kbd>', onClick: () => handlers.onConfirm() });
    this.undo = h('button', { class: 'cs-btn', html: 'Bỏ tờ <kbd>⌫</kbd>', onClick: () => handlers.onUndo() });
    this.root = h('div', { class: 'checkout-strip' }, [
      h('div', { class: 'cs-main' }, [this.title, this.info, this.hint]),
      h('div', { class: 'cs-actions' }, [
        this.undo,
        this.confirm,
        h('button', { class: 'cs-btn', html: 'Rời quầy <kbd>Esc</kbd>', onClick: () => handlers.onExit() }),
      ]),
    ]);
    uiRoot().append(this.root);
    requestAnimationFrame(() => this.root?.classList.add('show'));
    this.waiting();
  }

  private set(title: string, info: string, hint: string, confirm: boolean, undo = false): void {
    if (!this.root) return;
    this.title.textContent = title;
    this.info.innerHTML = info;
    this.hint.textContent = hint;
    this.confirm.style.display = confirm ? '' : 'none';
    this.undo.style.display = undo ? '' : 'none';
  }

  waiting(): void {
    this.set('Chờ khách', '', '', false);
  }

  scanning(done: number, total: number, sum: number): void {
    this.set(`Quét ${done}/${total}`, `Tổng <b>${money(sum)}</b>`, 'Bấm món (hoặc Space)', false);
  }

  cash(total: number, paid: number, due: number, given: number): void {
    const cls = given === due ? 'ok' : given > due ? 'over' : 'short';
    this.set('Tiền mặt', `Tổng <b>${money(total)}</b> · Đưa <b>${money(paid)}</b> · Thối <b>${money(due)}</b> · Đã thối <b class="${cls}">${money(given)}</b>`, 'Bấm khay để lấy tiền', true, true);
  }

  card(total: number, typed: string, error = false): void {
    this.set('Thẻ', `Tổng <b>${money(total)}</b> · POS <b class="${error ? 'short' : ''}">${typed || '_'}đ</b>`, 'Bấm phím POS hoặc gõ số + Enter', false);
  }

  done(amount: number, note: string): void {
    this.set(`+${money(amount)}`, note, '', false);
  }

  close(): void {
    const r = this.root;
    this.root = null;
    if (!r) return;
    r.classList.remove('show');
    setTimeout(() => r.remove(), 200);
  }
}
