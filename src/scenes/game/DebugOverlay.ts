import type Phaser from 'phaser';
import type { Services } from '../../core/Services';
import { DEPTH_UI } from '../../iso/DepthSort';
import { gridToScreen, screenToGrid } from '../../iso/IsoMath';
import { h, uiRoot } from '../../ui/dom';
import type { CustomerManager } from './CustomerManager';
import type { FurnitureManager } from './FurnitureManager';

/** F3: toạ độ lưới, ô dưới chuột, đường đi của khách, depth của sprite. */
export class DebugOverlay {
  on = false;
  private el: HTMLElement;
  private highlight: Phaser.GameObjects.Image;
  private paths: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private fpsAcc = { t: 0, n: 0, fps: 0 };

  constructor(
    private scene: Phaser.Scene,
    private s: Services,
    private player: () => { gx: number; gy: number; depth: number },
    private customers: CustomerManager,
    private furniture: FurnitureManager,
  ) {
    this.el = h('div', { class: 'debug-panel' });
    this.el.style.display = 'none';
    uiRoot().append(this.el);
    this.highlight = scene.add.image(0, 0, 'tile_highlight').setOrigin(0.5, 0).setDepth(DEPTH_UI - 200).setVisible(false);
    this.paths = scene.add.graphics().setDepth(DEPTH_UI - 150);
  }

  toggle(): void {
    this.on = !this.on;
    this.el.style.display = this.on ? 'block' : 'none';
    this.highlight.setVisible(this.on);
    this.paths.clear();
    this.labels.forEach((l) => l.setVisible(false));
    this.s.bus.emit('debug:toggle', { on: this.on });
  }

  private label(i: number, text: string, x: number, y: number): void {
    let l = this.labels[i];
    if (!l) {
      l = this.scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ff006e', backgroundColor: '#ffffffcc' })
        .setOrigin(0.5).setDepth(DEPTH_UI - 1);
      this.labels[i] = l;
    }
    l.setText(text).setPosition(x, y).setVisible(true);
  }

  update(dtMs: number, pointerWorld: { x: number; y: number }): void {
    this.fpsAcc.t += dtMs;
    this.fpsAcc.n++;
    if (this.fpsAcc.t >= 500) {
      this.fpsAcc.fps = Math.round((this.fpsAcc.n * 1000) / this.fpsAcc.t);
      this.fpsAcc = { t: 0, n: 0, fps: this.fpsAcc.fps };
    }
    if (!this.on) return;
    const m = screenToGrid(pointerWorld.x, pointerWorld.y);
    const tile = this.s.grid.get(m.gx, m.gy);
    const p = this.player();
    const hp = gridToScreen(m.gx, m.gy);
    this.highlight.setPosition(hp.x, hp.y);
    this.el.textContent = [
      `FPS: ${this.fpsAcc.fps}`,
      `Chuột: (${m.gx}, ${m.gy}) ${tile?.type ?? '-'}${tile?.occupiedBy ? ` [${tile.occupiedBy}]` : ''}`,
      `Player: (${p.gx.toFixed(2)}, ${p.gy.toFixed(2)}) depth ${p.depth.toFixed(1)}`,
      `Khách: ${this.customers.customers.length} · grid v${this.s.grid.version}`,
    ].join('\n');
    this.paths.clear();
    this.customers.debugDraw(this.paths);
    let i = 0;
    for (const v of this.furniture.all()) this.label(i++, v.depth.toFixed(0), v.sprite.x, v.sprite.y + 6);
    for (const c of this.customers.customers) {
      const q = gridToScreen(c.gx, c.gy);
      this.label(i++, c.view.depth.toFixed(1), q.x, q.y + 8);
    }
    const pp = gridToScreen(p.gx, p.gy);
    this.label(i++, p.depth.toFixed(1), pp.x, pp.y + 8);
    for (; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }

  get fps(): number {
    return this.fpsAcc.fps;
  }

  destroy(): void {
    this.el.remove();
    this.highlight.destroy();
    this.paths.destroy();
    this.labels.forEach((l) => l.destroy());
  }
}
