import { LOGIC_HZ } from '../config/constants';

/** Vòng lặp fixed-step cho logic (60Hz) + render theo requestAnimationFrame. */
export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  readonly step = 1 / LOGIC_HZ;

  constructor(
    private update: (dt: number) => void,
    private render: (frameDt: number, alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
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
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
