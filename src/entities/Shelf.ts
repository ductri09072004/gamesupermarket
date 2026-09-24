import Phaser from 'phaser';
import { getFurniture, type FurnitureDef } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import { footprintCells, rotatedSize } from '../iso/Footprint';
import { footprintDepth } from '../iso/DepthSort';
import { gridToScreen, type GridPoint } from '../iso/IsoMath';
import { furnitureTexture } from '../render/FurnitureArt';
import { drawMiniCube, hexToInt } from '../render/IsoDraw';

/** Hiển thị một món nội thất (kệ, tủ, quầy...) và hàng hoá trên đó. */
export class FurnitureView {
  readonly def: FurnitureDef;
  readonly sprite: Phaser.GameObjects.Image;
  private items: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private shaking = false;
  cells: GridPoint[] = [];

  constructor(private scene: Phaser.Scene, public data: FurnitureData, private priceOf: (id: string) => number) {
    this.def = getFurniture(data.type);
    this.sprite = scene.add.image(0, 0, '__DEFAULT');
    this.items = scene.add.graphics();
    if (this.def.kind === 'display') {
      for (let i = 0; i < this.def.slots; i++) {
        this.labels.push(scene.add.text(0, 0, '', {
          fontFamily: 'Nunito, sans-serif', fontSize: '9px', color: '#3d3551', backgroundColor: '#fffbe8',
          padding: { x: 2, y: 0 }, fontStyle: 'bold',
        }).setOrigin(0.5).setResolution(2));
      }
    }
    this.refresh();
  }

  get depth(): number {
    return this.sprite.depth;
  }

  refresh(): void {
    const d = this.data;
    const tex = furnitureTexture(this.scene, this.def, d.rot);
    const p = gridToScreen(d.gx, d.gy);
    this.sprite.setTexture(tex.key).setOrigin(tex.anchorX / tex.width, tex.anchorY / tex.height);
    this.sprite.setPosition(p.x, p.y).setFlipX(false);
    this.cells = footprintCells(this.def, d.gx, d.gy, d.rot);
    const depth = footprintDepth(this.cells);
    this.sprite.setDepth(depth);
    this.items.setDepth(depth + 0.5);
    this.labels.forEach((l) => l.setDepth(depth + 0.6));
    this.drawItems();
  }

  /** Vị trí (lưới cục bộ) tâm của slot i. */
  slotCenter(i: number): { a: number; b: number } {
    const { w, h } = rotatedSize(this.def, this.data.rot);
    const n = Math.max(1, this.def.slots);
    if (w >= h) return { a: ((i + 0.5) * w) / n, b: h / 2 };
    return { a: w / 2, b: ((i + 0.5) * h) / n };
  }

  drawItems(): void {
    const g = this.items;
    g.clear();
    if (this.def.kind !== 'display') return;
    const { w, h } = rotatedSize(this.def, this.data.rot);
    const n = this.def.slots;
    const alongX = w >= h;
    const slotLen = (alongX ? w : h) / n;
    const short = alongX ? h : w;
    const H = this.def.height;
    const cubes: Array<{ a: number; b: number; z: number; color: number }> = [];
    this.data.slots.forEach((s, i) => {
      if (!s.productId || s.qty <= 0) return;
      const color = hexToInt(getProduct(s.productId).color);
      for (let k = 0; k < Math.min(s.qty, 12); k++) {
        const layer = Math.floor(k / 6);
        const idx = k % 6;
        const u = (i + (idx % 2 === 0 ? 0.3 : 0.7)) * slotLen;
        const v = [0.22, 0.5, 0.78][Math.floor(idx / 2)] * short;
        cubes.push({ a: alongX ? u : v, b: alongX ? v : u, z: H + layer * 6, color });
      }
    });
    cubes.sort((p, q) => p.z - q.z || p.a + p.b - (q.a + q.b));
    for (const c of cubes) {
      const p = gridToScreen(this.data.gx + c.a, this.data.gy + c.b);
      drawMiniCube(g, p.x, p.y - c.z + 3, 5, 6, c.color);
    }
    this.updateLabels(1);
  }

  updateLabels(zoom: number): void {
    const { w, h } = rotatedSize(this.def, this.data.rot);
    this.data.slots.forEach((s, i) => {
      const label = this.labels[i];
      if (!label) return;
      if (!s.productId || zoom < 1) {
        label.setVisible(false);
        return;
      }
      const c = this.slotCenter(i);
      const front = w >= h ? { a: c.a, b: h } : { a: w, b: c.b };
      const p = gridToScreen(this.data.gx + front.a, this.data.gy + front.b);
      label.setText(`$${this.priceOf(s.productId).toFixed(2)}`).setPosition(p.x, p.y - this.def.height * 0.45).setVisible(true);
      label.setAlpha(s.qty > 0 ? 1 : 0.55);
    });
  }

  shake(): void {
    if (this.shaking) return;
    this.shaking = true;
    const x = this.sprite.x;
    this.scene.tweens.add({
      targets: [this.sprite, this.items],
      x: { from: x - 1.5, to: x + 1.5 },
      duration: 40,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.sprite.x = x;
        this.items.x = 0;
        this.shaking = false;
      },
    });
  }

  setAlpha(a: number): void {
    this.sprite.setAlpha(a);
    this.items.setAlpha(a);
    this.labels.forEach((l) => l.setAlpha(a));
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.items.setVisible(v);
    if (!v) this.labels.forEach((l) => l.setVisible(false));
  }

  destroy(): void {
    this.sprite.destroy();
    this.items.destroy();
    this.labels.forEach((l) => l.destroy());
  }
}
