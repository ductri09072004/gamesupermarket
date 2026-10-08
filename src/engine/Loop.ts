import { LOGIC_HZ } from '../config/constants';

/** Vòng lặp fixed-step cho logic (60Hz) + render theo requestAnimationFrame. */
export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private renderLast = 0;
  private frameMs = 1000 / 60;
  readonly step = 1 / LOGIC_HZ;

  constructor(
    private update: (dt: number) => void,
    private render: (frameDt: number, alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.renderLast = this.last;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = 0;
      if (typeof document !== 'undefined' && document.hidden) return;
      const elapsed = now - this.renderLast;
      if (elapsed < this.frameMs - 0.5) {
        this.raf = requestAnimationFrame(tick);
        return;
      }
      this.renderLast += Math.max(1, Math.floor((elapsed + 0.5) / this.frameMs)) * this.frameMs;
      const frameDt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      this.acc += frameDt;
      let n = 0;
      while (this.acc >= this.step && n < 8) {
        this.update(this.step);
        this.acc -= this.step;
        n++;
      }
      if (n === 8) this.acc = 0;
      this.render(frameDt, this.acc / this.step);
      if (this.running) this.raf = requestAnimationFrame(tick);
    };
    this.tick = tick;
    if (typeof document === 'undefined' || !document.hidden) this.raf = requestAnimationFrame(tick);
  }

  private tick: FrameRequestCallback = () => {};

  /** Stop all CPU/GPU work while hidden; resume without simulating the hidden interval. */
  private visibility = (): void => {
    if (!this.running) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = this.renderLast = performance.now();
    this.acc = 0;
    if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
  };

  setMaxFps(fps: number): void {
    this.frameMs = 1000 / fps;
    this.renderLast = performance.now();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.acc = 0;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
  }
}
