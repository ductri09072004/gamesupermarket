import { h, uiRoot } from './dom';

/** Chấm tâm màn hình + gợi ý phím bên dưới. */
export class Crosshair {
  private root: HTMLElement;
  private dot: HTMLElement;
  private hint: HTMLElement;
  private last = '';

  constructor() {
    this.dot = h('div', { class: 'ch-dot' });
    this.hint = h('div', { class: 'ch-hint' });
    this.root = h('div', { class: 'crosshair' }, [this.dot, this.hint]);
    uiRoot().append(this.root);
  }

  set(lines: string[], active: boolean): void {
    const key = `${active}|${lines.join('|')}`;
    if (key === this.last) return;
    this.last = key;
    this.dot.classList.toggle('active', active);
    this.hint.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    this.hint.style.display = lines.length ? '' : 'none';
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}

/** Màn "Click để chơi" khi chưa có pointer lock. */
export class ClickToPlay {
  private root: HTMLElement;

  constructor(onClick: () => void) {
    this.root = h('div', { class: 'click-to-play' }, [
      h('div', { class: 'ctp-card' }, [
        h('div', { class: 'ctp-title', text: 'Click để chơi' }),
        h('div', { class: 'ctp-keys', html: '<kbd>WASD</kbd> đi · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · <kbd>Ctrl</kbd> ngồi · <kbd>E</kbd> tương tác · <kbd>Chuột trái</kbd> đặt hàng · <kbd>Chuột phải</kbd> lấy lại · <kbd>F</kbd> mở thùng · <kbd>Q</kbd> thả thùng · <kbd>Tab</kbd> bảng giá · <kbd>M</kbd> dời kệ · <kbd>B</kbd> xây dựng · <kbd>Esc</kbd> menu' }),
      ]),
    ]);
    this.root.addEventListener('click', onClick);
    uiRoot().append(this.root);
    this.hide();
  }

  show(): void {
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
