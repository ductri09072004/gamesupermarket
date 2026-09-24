import type { EventBus, GameEvents } from '../core/EventBus';
import { h, uiRoot } from './dom';

/** Thông báo ngắn góc trên giữa màn hình. */
export function mountToasts(bus: EventBus<GameEvents>): () => void {
  const box = h('div', { class: 'toasts' });
  uiRoot().append(box);
  let last = '';
  let lastAt = 0;
  const off = bus.on('toast', ({ message, kind }) => {
    const now = performance.now();
    if (message === last && now - lastAt < 800) return;
    last = message;
    lastAt = now;
    const t = h('div', { class: `toast ${kind ?? 'info'}`, text: message });
    box.append(t);
    while (box.children.length > 4) box.firstChild?.remove();
    setTimeout(() => {
      t.classList.add('hide');
      setTimeout(() => t.remove(), 300);
    }, 2600);
  });
  return () => {
    off();
    box.remove();
  };
}
