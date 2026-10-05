import type * as THREE from 'three';
import { PERF } from '../config/perf';
import { perf } from '../engine/Perf';
import { verdict } from '../systems/PerfStats';
import { h, uiRoot } from '../ui/dom';

const W = 300;
const H = 70;
const MAX_MS = 50;

/** F3: đồ thị thời gian khung, FPS / 1% thấp / số khung giật, draw calls, vị trí người chơi. F7 đo lại · F8 xuất báo cáo JSON. */
export class DebugPanel {
  on = false;
  private el = h('div', { class: 'debug-panel' });
  private canvas = h('canvas', { class: 'perf-graph' });
  private text = h('pre', { class: 'perf-text' });
  private acc = { t: 0, n: 0, fps: 0 };
  private tick = 0;

  constructor() {
    this.canvas.width = W * 2;
    this.canvas.height = H * 2;
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.el.append(this.canvas, this.text);
    this.el.style.display = 'none';
    uiRoot().append(this.el);
  }

  toggle(): boolean {
    this.on = !this.on;
    this.el.style.display = this.on ? '' : 'none';
    return this.on;
  }

  get fps(): number {
    return this.acc.fps;
  }

  update(dt: number, info: THREE.WebGLInfo, lines: string[]): void {
    this.acc.t += dt;
    this.acc.n++;
    if (this.acc.t >= 0.5) {
      this.acc.fps = Math.round(this.acc.n / this.acc.t);
      this.acc.t = 0;
      this.acc.n = 0;
    }
    if (!this.on || ++this.tick % 3 !== 0) return;
    this.drawGraph();
    const s = perf.recent();
    const v = verdict(s);
    this.text.textContent = [
      `${s.avgFps.toFixed(0)} FPS · TB ${s.avgMs.toFixed(1)}ms · 1% thấp ${s.lowFps.toFixed(0)} FPS`,
      `giật >${PERF.jankMs}ms: ${s.jank} · khựng >${PERF.hitchMs}ms: ${s.hitch} · tệ nhất ${s.worstMs.toFixed(0)}ms`,
      `${v.pass ? '✔ ĐẠT mục tiêu 60 FPS ổn định' : '✘ ' + (v.issues[0] ?? '')}`,
      `Draw calls: ${info.render.calls} · Tris: ${info.render.triangles.toLocaleString()}`,
      `Geometries: ${info.memory.geometries} · Textures: ${info.memory.textures}`,
      ...lines,
      'F7 đo lại · F8 xuất báo cáo',
    ].filter(Boolean).join('\n');
  }

  private drawGraph(): void {
    const g = this.canvas.getContext('2d')!;
    const n = PERF.graphFrames;
    const ms = perf.ms.slice(-n);
    const upd = perf.upd.slice(-n);
    g.clearRect(0, 0, W * 2, H * 2);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, W * 2, H * 2);
    const bw = (W * 2) / n;
    const y = (v: number) => (H * 2) * (1 - Math.min(v, MAX_MS) / MAX_MS);
    for (let i = 0; i < ms.length; i++) {
      const v = ms[i];
      g.fillStyle = v > PERF.hitchMs ? '#ff4d4d' : v > PERF.jankMs ? '#ffb02e' : v > PERF.frameMs * 1.2 ? '#e6e65a' : '#7be26a';
      const x = (n - ms.length + i) * bw;
      g.fillRect(x, y(v), Math.max(1, bw - 1), H * 2 - y(v));
      g.fillStyle = 'rgba(80,160,255,0.85)'; // phần CPU logic
      g.fillRect(x, y(upd[i]), Math.max(1, bw - 1), H * 2 - y(upd[i]));
    }
    for (const [v, c] of [[PERF.frameMs, 'rgba(255,255,255,0.5)'], [PERF.jankMs, 'rgba(255,176,46,0.6)']] as const) {
      g.strokeStyle = c;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y(v));
      g.lineTo(W * 2, y(v));
      g.stroke();
    }
    // vạch sự kiện (mở menu, lên xe...) trong cửa sổ đang vẽ
    const t1 = perf.at[perf.at.length - 1] ?? 0;
    const t0 = perf.at[Math.max(0, perf.at.length - n)] ?? 0;
    g.font = '18px sans-serif';
    for (const m of perf.marks) {
      if (m.t < t0 || m.t > t1) continue;
      const x = ((m.t - t0) / Math.max(1, t1 - t0)) * W * 2;
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H * 2);
      g.stroke();
      g.fillStyle = '#fff';
      g.fillText(m.label, Math.min(x + 4, W * 2 - 150), 18);
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
