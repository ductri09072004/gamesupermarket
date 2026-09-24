type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  title?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  attrs?: Record<string, string>;
}

/** Tạo phần tử DOM nhỏ gọn. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.title) el.title = props.title;
  if (typeof props.style === 'string') el.setAttribute('style', props.style);
  else if (props.style) Object.assign(el.style, props.style);
  if (props.disabled) (el as HTMLButtonElement).disabled = true;
  if (props.onClick) el.addEventListener('click', props.onClick as EventListener);
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function uiRoot(): HTMLElement {
  return document.getElementById('ui-root')!;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** Số chạy từ from → to. */
export function countUp(el: HTMLElement, from: number, to: number, ms: number, fmt: (n: number) => string): void {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Cửa sổ modal chung. */
export function modal(title: string, body: HTMLElement, opts: { onClose?: () => void; wide?: boolean; closable?: boolean } = {}): { el: HTMLElement; close: () => void } {
  const backdrop = h('div', { class: 'modal-backdrop' });
  const close = () => {
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 150);
    opts.onClose?.();
  };
  const header = h('div', { class: 'win-title' }, [
    h('span', { text: title }),
    opts.closable === false ? null : h('button', { class: 'win-close', text: '✕', onClick: close }),
  ]);
  const win = h('div', { class: `window modal ${opts.wide ? 'wide' : ''}` }, [header, h('div', { class: 'win-body' }, [body])]);
  backdrop.append(win);
  uiRoot().append(backdrop);
  return { el: backdrop, close };
}
