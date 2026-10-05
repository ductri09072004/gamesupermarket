import type { Services } from '../core/Services';
import { h, uiRoot } from './dom';

const STEPS: Array<[string, string]> = [
  ['pc', 'Bấm vào máy tính'],
  ['order', 'Đặt hàng trên máy tính (mục Đặt hàng)'],
  ['pickup', 'Bấm nhặt thùng ở vỉa hè'],
  ['stock', 'Bấm chuột trái để mở thùng, nhìn ngăn kệ & bấm chuột trái'],
  ['price', 'Đặt giá (nhìn nhãn giá + E)'],
  ['open', 'Bấm lật biển Mở cửa cạnh cửa ra vào'],
  ['checkout', 'Bấm vào quầy & tính tiền cho khách'],
];

/** Hướng dẫn ngày đầu ở góc phải: chỉ hiện nhiệm vụ hiện tại, xong mới tới nhiệm vụ kế. */
export class Tutorial {
  private root: HTMLElement | null = null;
  private off: () => void;

  constructor(private s: Services) {
    this.off = s.bus.on('tutorial:done', ({ step }) => this.complete(step));
    if (!this.finished) this.render();
  }

  private get finished(): boolean {
    const t = this.s.data.tutorial;
    return !!t.dismissed || STEPS.every(([k]) => t[k]);
  }

  private complete(step: string): void {
    const t = this.s.data.tutorial;
    if (t[step] || !STEPS.some(([k]) => k === step)) return;
    t[step] = true;
    this.s.bus.emit('sound', { name: 'coin' });
    if (this.finished) {
      this.s.bus.emit('toast', { message: '🎓 Hoàn thành hướng dẫn! Chúc bạn kinh doanh phát đạt!', kind: 'success' });
      setTimeout(() => this.remove(), 1500);
    }
    this.render();
  }

  private render(): void {
    const t = this.s.data.tutorial;
    const idx = STEPS.findIndex(([k]) => !t[k]);
    const cur = STEPS[idx];
    const el = h('div', { class: 'tutorial' }, [
      h('div', { class: 'tut-head' }, [
        h('b', { text: idx < 0 ? 'Hoàn thành!' : `Nhiệm vụ ${idx + 1}/${STEPS.length}` }),
        h('button', { class: 'win-close', text: '✕', title: 'Ẩn hướng dẫn', onClick: () => { t.dismissed = true; this.remove(); } }),
      ]),
      cur ? h('div', { class: 'tut-step', text: cur[1] }) : null,
    ]);
    if (this.root) this.root.replaceWith(el);
    else uiRoot().append(el);
    this.root = el;
  }

  private remove(): void {
    this.root?.remove();
    this.root = null;
  }

  destroy(): void {
    this.off();
    this.remove();
  }
}
