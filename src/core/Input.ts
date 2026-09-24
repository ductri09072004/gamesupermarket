/** Bàn phím dựa trên DOM: bỏ qua khi đang gõ vào ô input của UI. */
type KeyHandler = (e: KeyboardEvent) => void;

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class Keyboard {
  private down = new Set<string>();
  private handlers: KeyHandler[] = [];
  private onDown = (e: KeyboardEvent) => {
    if (isTyping()) return;
    if (!e.repeat) this.down.add(e.code);
    for (const h of [...this.handlers]) h(e);
  };
  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private onBlur = () => this.down.clear();

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  isDown(code: string): boolean {
    return !isTyping() && this.down.has(code);
  }

  onKey(handler: KeyHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    this.handlers = [];
    this.down.clear();
  }
}
