import type { Services } from '../core/Services';
import { h, uiRoot } from './dom';

const STEPS: Array<[string, string]> = [
  ['pc', 'Mở máy tính (E)'],
  ['order', 'Đặt hàng trong app Market'],
  ['pickup', 'Nhặt thùng ở vỉa hè (E)'],
  ['stock', 'Mở thùng (F) & xếp kệ (giữ E)'],
  ['price', 'Đặt giá (click vào kệ)'],
  ['open', 'Mở cửa (E ở biển cạnh cửa)'],
  ['checkout', 'Tính tiền ở quầy thu ngân'],
];

/** Checklist hướng dẫn ngày đầu ở góc phải. */
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
    const list = h('ol', {}, STEPS.map(([k, label]) => h('li', { class: t[k] ? 'done' : '' }, [label])));
    const next = STEPS.find(([k]) => !t[k]);
    const el = h('div', { class: 'tutorial' }, [
      h('div', { class: 'tut-head' }, [
        h('b', { text: '📋 Hướng dẫn ngày 1' }),
        h('button', { class: 'win-close', text: '✕', title: 'Ẩn hướng dẫn', onClick: () => { t.dismissed = true; this.remove(); } }),
      ]),
      list,
      next ? h('div', { class: 'tut-next', text: `👉 ${next[1]}` }) : null,
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
