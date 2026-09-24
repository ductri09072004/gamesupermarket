import { h, uiRoot } from './dom';

let el: HTMLElement | null = null;

export function showTooltip(text: string, x: number, y: number): void {
  if (!el || !el.isConnected) {
    el = h('div', { class: 'tooltip' });
    uiRoot().append(el);
  }
  el.textContent = text;
  el.style.display = 'block';
  el.style.left = `${x + 14}px`;
  el.style.top = `${y + 14}px`;
}

export function hideTooltip(): void {
  if (el) el.style.display = 'none';
}
