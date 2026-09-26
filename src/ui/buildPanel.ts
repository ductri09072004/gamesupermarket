import { getFurniture } from '../config/furniture';
import { clear, h, uiRoot } from './dom';

export interface BuildPanelHandlers {
  onPick(type: string): void;
  onShop(): void;
  onExit(): void;
}

/** Thanh công cụ Build mode. */
export class BuildPanel {
  private root: HTMLElement | null = null;
  private list!: HTMLElement;
  private status!: HTMLElement;

  open(h2: BuildPanelHandlers): void {
    this.list = h('div', { class: 'build-list' });
    this.status = h('div', { class: 'build-status' });
    this.root = h('div', { class: 'build-panel' }, [
      h('div', { class: 'build-head' }, [
        h('b', { text: '🔨 Chế độ xây dựng' }),
        h('button', { class: 'btn small', text: '🛒 Mua nội thất', onClick: () => h2.onShop() }),
        h('button', { class: 'btn small', text: 'Thoát (B)', onClick: () => h2.onExit() }),
      ]),
      h('div', { class: 'build-help', html: 'Click nội thất để <b>nhấc</b> (kệ có hàng: hàng đi theo kệ) · Click trái để <b>đặt</b> · <kbd>Lăn chuột</kbd> xoay 15° · <kbd>R</kbd> xoay 90° · <kbd>Delete</kbd> bán lại 50% (hàng tự vào thùng) · <kbd>Esc</kbd> huỷ' }),
      this.list,
      this.status,
    ]);
    uiRoot().append(this.root);
    this.handlers = h2;
  }

  private handlers: BuildPanelHandlers | null = null;

  setStock(stock: string[]): void {
    if (!this.root) return;
    clear(this.list);
    const counts = new Map<string, number>();
    for (const t of stock) counts.set(t, (counts.get(t) ?? 0) + 1);
    if (counts.size === 0) {
      this.list.append(h('div', { class: 'muted', text: 'Kho nội thất trống — mua thêm trên máy tính.' }));
      return;
    }
    for (const [type, n] of counts) {
      const def = getFurniture(type);
      this.list.append(h('button', { class: 'build-item', onClick: () => this.handlers?.onPick(type) }, [
        h('span', { class: 'big', text: def.icon }), h('span', { text: def.name }), h('b', { text: `×${n}` }),
      ]));
    }
  }

  setStatus(text: string, ok: boolean | null): void {
    if (!this.root) return;
    this.status.textContent = text;
    this.status.className = `build-status ${ok === null ? '' : ok ? 'ok' : 'bad'}`;
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }
}
