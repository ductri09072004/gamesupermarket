import { PERF } from '../config/perf';
import type { EventBus, GameEvents } from '../core/EventBus';
import { summarize, verdict, type PerfSummary } from '../systems/PerfStats';

export interface PerfMark {
  /** ms kể từ lúc bắt đầu đo */
  t: number;
  label: string;
}

interface LongFrame {
  t: number;
  duration: number;
  blocking: number;
  scripts: Array<{ src: string; fn: string; ms: number }>;
}

/**
 * Ghi thời gian từng khung hình khi chơi (luôn bật, rất nhẹ): khoảng cách giữa 2 khung, thời gian CPU của logic và của lệnh vẽ,
 * draw calls, tam giác; cùng các "dấu" sự kiện (lên xe, mở menu, mua đồ...) để biết cú giật xảy ra lúc nào làm gì.
 * Xuất báo cáo JSON (F8) để phân tích, hoặc để so sánh trước / sau khi tối ưu.
 */
export class PerfRecorder {
  private t0 = performance.now();
  private last = 0;
  ms: number[] = [];
  upd: number[] = [];
  rnd: number[] = [];
  calls: number[] = [];
  tris: number[] = [];
  at: number[] = [];
  marks: PerfMark[] = [];
  longFrames: LongFrame[] = [];
  /** Thông tin máy / GPU / chất lượng (Game điền khi có renderer) */
  env: Record<string, unknown> = {};
  private offs: Array<() => void> = [];
  private observer: PerformanceObserver | null = null;

  constructor() {
    try {
      // long-animation-frame cho biết script nào gây khung dài (Chrome 123+); trình duyệt khác bỏ qua
      this.observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ startTime: number; duration: number; blockingDuration?: number; scripts?: Array<{ sourceURL: string; sourceFunctionName: string; duration: number }> }>) {
          if (this.longFrames.length >= 80 || e.duration < PERF.jankMs) continue;
          this.longFrames.push({
            t: Math.round(e.startTime - this.t0),
            duration: Math.round(e.duration),
            blocking: Math.round(e.blockingDuration ?? 0),
            scripts: (e.scripts ?? []).slice(0, 3).map((s) => ({ src: s.sourceURL.split('/').pop() ?? '', fn: s.sourceFunctionName, ms: Math.round(s.duration) })),
          });
        }
      });
      this.observer.observe({ type: 'long-animation-frame', buffered: false } as PerformanceObserverInit);
    } catch {
      this.observer = null;
    }
  }

  /** Đặt mốc thời gian mới (xoá dữ liệu cũ). */
  reset(): void {
    this.t0 = performance.now();
    this.last = 0;
    for (const a of [this.ms, this.upd, this.rnd, this.calls, this.tris, this.at]) a.length = 0;
    this.marks = [];
    this.longFrames = [];
  }

  now(): number {
    return performance.now() - this.t0;
  }

  mark(label: string): void {
    this.marks.push({ t: Math.round(this.now()), label });
    if (this.marks.length > 400) this.marks.shift();
  }

  /** Gọi mỗi khung sau khi vẽ: updMs / rndMs = CPU của logic và của lệnh vẽ trong khung này. */
  frame(updMs: number, rndMs: number, calls: number, tris: number): void {
    const t = this.now();
    if (this.last > 0) {
      this.ms.push(t - this.last);
      this.upd.push(updMs);
      this.rnd.push(rndMs);
      this.calls.push(calls);
      this.tris.push(tris);
      this.at.push(t);
      if (this.ms.length > PERF.sessionFrames) for (const a of [this.ms, this.upd, this.rnd, this.calls, this.tris, this.at]) a.splice(0, 1000);
    }
    this.last = t;
  }

  /** Thống kê N khung gần nhất (mặc định cửa sổ trực tiếp). */
  recent(n = PERF.liveWindow): PerfSummary {
    return summarize(this.ms.slice(-n));
  }

  summary(): PerfSummary {
    return summarize(this.ms);
  }

  /** Theo dõi các sự kiện game đáng chú ý để gắn nhãn lên đồ thị. */
  listen(bus: EventBus<GameEvents>): void {
    for (const off of this.offs) off();
    this.offs = [
      bus.on('store:toggled', ({ open }) => this.mark(open ? 'mở cửa hàng' : 'đóng cửa hàng')),
      bus.on('ui:modal', ({ name, open }) => this.mark(`${open ? 'mở' : 'đóng'} ${name}`)),
      bus.on('checkout:mode', ({ active }) => this.mark(active ? 'vào quầy thu ngân' : 'rời quầy')),
      bus.on('vehicle:buy', ({ type }) => this.mark(`mua xe ${type}`)),
      bus.on('order:arrived', () => this.mark('hàng tới')),
      bus.on('delivery:truck', () => this.mark('xe tải giao hàng')),
      bus.on('day:ended', () => this.mark('hết ngày')),
      bus.on('day:started', () => this.mark('ngày mới')),
    ];
  }

  /** Báo cáo đầy đủ: máy, thống kê, kết luận, các khung chậm nhất kèm sự kiện xung quanh. */
  report(label = 'phiên chơi'): Record<string, unknown> {
    const s = this.summary();
    const order = this.ms.map((_, i) => i).sort((a, b) => this.ms[b] - this.ms[a]).slice(0, PERF.worstFrames);
    const worst = order.map((i) => {
      const t = this.at[i];
      return {
        t: Math.round(t),
        ms: +this.ms[i].toFixed(1),
        updateMs: +this.upd[i].toFixed(1),
        renderMs: +this.rnd[i].toFixed(1),
        drawCalls: this.calls[i],
        near: this.marks.filter((m) => Math.abs(m.t - t) <= PERF.contextMs).map((m) => `${m.t - Math.round(t) >= 0 ? '+' : ''}${m.t - Math.round(t)}ms ${m.label}`),
      };
    }).sort((a, b) => a.t - b.t);
    const round = (n: number) => +n.toFixed(2);
    return {
      label,
      when: new Date().toISOString(),
      env: this.env,
      target: { fps: 60, jankMs: PERF.jankMs, hitchMs: PERF.hitchMs, minAvgFps: PERF.minAvgFps, minLowFps: PERF.minLowFps },
      summary: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round(v)])),
      verdict: verdict(s),
      avgCpu: { updateMs: round(avg(this.upd)), renderMs: round(avg(this.rnd)), drawCalls: Math.round(avg(this.calls)), triangles: Math.round(avg(this.tris)) },
      marks: this.marks,
      worstFrames: worst,
      longAnimationFrames: this.longFrames,
      // cả phiên, làm tròn 0.1ms để file gọn
      frameMs: this.ms.map((v) => Math.round(v * 10) / 10),
    };
  }

  /** Tải báo cáo về dưới dạng file JSON. */
  download(label?: string): void {
    const blob = new Blob([JSON.stringify(this.report(label), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}

function avg(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

export const perf = new PerfRecorder();
