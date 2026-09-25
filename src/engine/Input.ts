import { Keyboard } from '../core/Input';

type MouseHandler = (e: MouseEvent) => void;

/**
 * Bàn phím + chuột + pointer lock. Nếu trình duyệt từ chối pointer lock, chuyển sang chế độ
 * "kéo để nhìn" (giữ chuột và kéo).
 */
export class Input {
  readonly keys = new Keyboard();
  locked = false;
  /** Đang mở UI (máy tính, bảng giá...) → không nhìn/đi. */
  uiMode = false;
  /** Cho phép nhìn bằng chuột (tắt khi ở quầy thu ngân dùng chuột tự do...). */
  lookEnabled = true;
  dragLook = false;
  private lookX = 0;
  private lookY = 0;
  private buttons = new Set<number>();
  private downAt = { x: 0, y: 0, moved: 0 };
  private mouseDown: MouseHandler[] = [];
  private mouseUp: MouseHandler[] = [];
  private lockListeners: Array<(locked: boolean) => void> = [];
  mouseX = 0;
  mouseY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('mousemove', this.onMove);
    canvas.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    for (const l of this.lockListeners) l(this.locked);
  };

  onLock(fn: (locked: boolean) => void): void {
    this.lockListeners.push(fn);
  }

  async requestLock(): Promise<boolean> {
    if (this.locked) return true;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.then === 'function') await r;
      await new Promise((res) => setTimeout(res, 60));
      if (!this.locked) this.dragLook = true;
      return this.locked;
    } catch {
      this.dragLook = true;
      return false;
    }
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (!this.lookEnabled || this.uiMode) return;
    if (this.locked) {
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    } else if (this.dragLook && this.buttons.size > 0) {
      this.lookX += e.movementX;
      this.lookY += e.movementY;
      this.downAt.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    }
  };

  private onDown = (e: MouseEvent) => {
    this.buttons.add(e.button);
    this.downAt = { x: e.clientX, y: e.clientY, moved: 0 };
    for (const h of this.mouseDown) h(e);
  };

  private onUp = (e: MouseEvent) => {
    this.buttons.delete(e.button);
    for (const h of this.mouseUp) h(e);
  };

  /** Trong chế độ kéo-để-nhìn: lần nhấn hiện tại đã kéo đủ xa để coi là nhìn chứ không phải click. */
  get dragged(): boolean {
    return this.dragLook && this.downAt.moved > 6;
  }

  isMouseDown(button: number): boolean {
    return this.buttons.has(button);
  }

  onMouseDown(h: MouseHandler): void {
    this.mouseDown.push(h);
  }

  onMouseUp(h: MouseHandler): void {
    this.mouseUp.push(h);
  }

  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookX, dy: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }

  /** Mô phỏng nhìn (dùng cho test / tutorial). */
  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  destroy(): void {
    this.keys.destroy();
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.exitLock();
  }
}
