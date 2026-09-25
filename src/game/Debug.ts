import type * as THREE from 'three';
import { h, uiRoot } from '../ui/dom';

/** F3: FPS, draw calls, triangles, vị trí người chơi. */
export class DebugPanel {
  on = false;
  private el = h('div', { class: 'debug-panel' });
  private acc = { t: 0, n: 0, fps: 0 };

  constructor() {
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
    if (!this.on) return;
    this.el.textContent = [
      `FPS: ${this.acc.fps}`,
      `Draw calls: ${info.render.calls} · Tris: ${info.render.triangles.toLocaleString()}`,
      `Geometries: ${info.memory.geometries} · Textures: ${info.memory.textures}`,
      ...lines,
    ].join('\n');
  }

  destroy(): void {
    this.el.remove();
  }
}
