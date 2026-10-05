import { h, uiRoot } from './dom';

/** Chấm tâm màn hình + gợi ý phím bên dưới. */
export class Crosshair {
  private root: HTMLElement;
  private dot: HTMLElement;
  private hint: HTMLElement;
  private ring: HTMLElement;
  private last = '';

  constructor() {
    this.dot = h('div', { class: 'ch-dot' });
    this.hint = h('div', { class: 'ch-hint' });
    this.ring = h('div', { class: 'ch-ring' });
    this.root = h('div', { class: 'crosshair' }, [this.ring, this.dot, this.hint]);
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

  /** Vòng tiến độ khi giữ chuột để dời nội thất (0..1; null = ẩn). */
  setHold(p: number | null): void {
    this.ring.style.display = p === null ? 'none' : 'block';
    if (p !== null) this.ring.style.background = `conic-gradient(#ffc933 ${Math.round(p * 360)}deg, rgba(255,255,255,0.25) 0)`;
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}

/** Màn "Bấm chuột để chơi" khi chưa có pointer lock. */
export class ClickToPlay {
  private root: HTMLElement;

  constructor(onClick: () => void) {
    this.root = h('div', { class: 'click-to-play' }, [
      h('div', { class: 'ctp-card' }, [
        h('div', { class: 'ctp-title', text: 'Bấm chuột để chơi' }),
        h('div', { class: 'ctp-keys', html: '<kbd>WASD</kbd> đi · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · <kbd>Ctrl</kbd> ngồi · <kbd>Chuột trái</kbd> tương tác / mở thùng / đặt hàng (giữ 2 giây: dời kệ) · <kbd>Chuột phải</kbd> lấy lại · <kbd>C</kbd> đóng thùng · <kbd>G</kbd> đặt thùng · <kbd>R</kbd> quăng thùng · <kbd>F</kbd> lên/xuống xe · <kbd>Tab</kbd> bảng giá · <kbd>M</kbd> bản đồ · <kbd>Enter</kbd> kết thúc ngày · <kbd>Esc</kbd> menu' }),
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
