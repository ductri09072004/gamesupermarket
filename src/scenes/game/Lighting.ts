import Phaser from 'phaser';
import { WAREHOUSE } from '../../config/constants';
import type { Services } from '../../core/Services';
import { DEPTH_LIGHT } from '../../iso/DepthSort';
import { IsoGrid } from '../../iso/IsoGrid';
import { gridToScreen } from '../../iso/IsoMath';

interface Light {
  color: number;
  outside: number;
  inside: number;
}

/** Ánh sáng theo giờ: cam nhạt lúc hoàng hôn, xanh tối sau 19h; trong cửa hàng sáng hơn. */
export function lightAt(hour: number): Light {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
  if (hour < 16.5) return { color: 0xff9e5e, outside: 0, inside: 0 };
  if (hour < 18.5) {
    const t = (hour - 16.5) / 2;
    return { color: 0xff9e5e, outside: lerp(0, 0.22, t), inside: lerp(0, 0.06, t) };
  }
  if (hour < 19.5) {
    const t = hour - 18.5;
    return { color: t < 0.5 ? 0xd9776e : 0x3b3f7a, outside: lerp(0.22, 0.42, t), inside: lerp(0.06, 0.1, t) };
  }
  const t = (hour - 19.5) / 2;
  return { color: 0x1d2951, outside: lerp(0.42, 0.55, t), inside: lerp(0.1, 0.14, t) };
}

export class Lighting {
  private outside: Phaser.GameObjects.Graphics;
  private inside: Phaser.GameObjects.Graphics;
  private lastKey = '';

  constructor(scene: Phaser.Scene, private s: Services) {
    this.outside = scene.add.graphics().setDepth(DEPTH_LIGHT);
    this.inside = scene.add.graphics().setDepth(DEPTH_LIGHT);
  }

  private holes(): Phaser.Math.Vector2[][] {
    const g = this.s.grid;
    const quad = (x0: number, y0: number, x1: number, y1: number) =>
      [gridToScreen(x0, y0), gridToScreen(x1, y0), gridToScreen(x1, y1), gridToScreen(x0, y1)].map((p) => new Phaser.Math.Vector2(p.x, p.y));
    const out = [quad(0, 0, g.storeW, g.storeH)];
    if (g.warehouse) out.push(quad(WAREHOUSE.x0, WAREHOUSE.y0, WAREHOUSE.x0 + WAREHOUSE.w, WAREHOUSE.y0 + WAREHOUSE.h));
    return out;
  }

  update(): void {
    const l = lightAt(this.s.time.hour);
    const key = `${l.color}:${l.outside.toFixed(3)}:${l.inside.toFixed(3)}:${this.s.grid.version}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.outside.clear();
    this.inside.clear();
    if (l.outside <= 0) return;
    const a = gridToScreen(IsoGrid.MIN_X - 20, IsoGrid.MIN_Y - 20);
    const b = gridToScreen(IsoGrid.MAX_X + 20, IsoGrid.MIN_Y - 20);
    const c = gridToScreen(IsoGrid.MAX_X + 20, IsoGrid.MAX_Y + 20);
    const d = gridToScreen(IsoGrid.MIN_X - 20, IsoGrid.MAX_Y + 20);
    const holes = this.holes();
    // Đa giác "lỗ khoá": viền ngoài theo chiều kim đồng hồ, các lỗ theo chiều ngược lại.
    const pts: Phaser.Math.Vector2[] = [a, b, c, d, a].map((p) => new Phaser.Math.Vector2(p.x, p.y));
    for (const hole of holes) {
      const rev = [...hole].reverse();
      pts.push(rev[0], ...rev.slice(1), rev[0], new Phaser.Math.Vector2(a.x, a.y));
    }
    this.outside.fillStyle(l.color, l.outside).fillPoints(pts, true);
    for (const hole of holes) this.inside.fillStyle(l.color, l.inside).fillPoints(hole, true);
  }

  destroy(): void {
    this.outside.destroy();
    this.inside.destroy();
  }
}
