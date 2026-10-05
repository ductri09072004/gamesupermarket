import { h, money, uiRoot } from './dom';

export interface CheckoutStripHandlers {
  onConfirm(): void;
  onExit(): void;
  onUndo(): void;
}

/**
 * Thanh thông tin nhỏ ở đỉnh màn hình khi đứng quầy (phần chính diễn ra trong cảnh 3D: băng chuyền, hoá đơn viết tay, khay tiền).
 * Nằm trên cùng, một dòng gọn, để không che tiền / ngăn kéo ở nửa dưới màn hình.
 */
export class CheckoutStrip {
  private root: HTMLElement | null = null;
  /** Bản phóng to của tờ hoá đơn viết tay trên quầy (tờ trên bàn 3D quá nhỏ để đọc) */
  private card: HTMLElement | null = null;
  private cardCanvas: HTMLCanvasElement | null = null;
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
    this.cardCanvas = h('canvas', { class: 'cs-receipt-canvas' }) as HTMLCanvasElement;
    this.cardCanvas.width = 512;
    this.cardCanvas.height = 640;
    this.card = h('div', { class: 'cs-receipt' }, [this.cardCanvas]);
    uiRoot().append(this.root, this.card);
    requestAnimationFrame(() => {
      this.root?.classList.add('show');
      this.card?.classList.add('show');
    });
    this.waiting();
  }

  /** Chép tờ hoá đơn vẽ trên quầy 3D sang bản đọc được ở góc màn hình. */
  mirrorReceipt(src: HTMLCanvasElement): void {
    this.cardCanvas?.getContext('2d')?.drawImage(src, 0, 0);
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
    // còn thiếu bao nhiêu (lẻ dưới 200đ không cần thối)
    const rem = Math.round((due - given) * 100);
    const left = rem >= 20 ? `Còn thiếu <b class="short">${money(rem / 100)}</b>` : rem < 0 ? `Thối dư <b class="over">${money(-rem / 100)}</b>` : '<b class="ok">Đủ rồi ✓</b>';
    this.set('Tiền mặt', `Tổng <b>${money(total)}</b> · Đưa <b>${money(paid)}</b> · Thối <b>${money(due)}</b> · Đã thối <b>${money(given)}</b> · ${left}`, 'Bấm khay để lấy tiền · lẻ dưới 200đ không cần thối', true, true);
  }

  done(amount: number, note: string): void {
    this.set(`+${money(amount)}`, note, '', false);
  }

  close(): void {
    const r = this.root;
    const card = this.card;
    this.root = null;
    this.card = null;
    this.cardCanvas = null;
    if (!r) return;
    r.classList.remove('show');
    card?.classList.remove('show');
    setTimeout(() => {
      r.remove();
      card?.remove();
    }, 200);
  }
}
