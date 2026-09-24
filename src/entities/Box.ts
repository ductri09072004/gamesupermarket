import Phaser from 'phaser';
import { getFurniture } from '../config/furniture';
import type { BoxData, FurnitureData } from '../core/GameState';
import { depthAt, footprintDepth, LAYER } from '../iso/DepthSort';
import { footprintCells, rotatedSize } from '../iso/Footprint';
import { gridToScreen } from '../iso/IsoMath';
import { BOX_HEIGHT, BOX_SIZE, boxBounds, boxTexture } from '../render/BoxArt';

export function boxTextureFor(scene: Phaser.Scene, b: BoxData): string {
  return boxTexture(scene, b.productId, b.open, b.qty <= 0);
}

/** Thùng hàng nằm trên sàn / trên kệ kho. */
export class BoxView {
  readonly image: Phaser.GameObjects.Image;
  private baseY = 0;
  private dropping = false;

  constructor(private scene: Phaser.Scene, public data: BoxData) {
    const b = boxBounds();
    this.image = scene.add.image(0, 0, boxTextureFor(scene, data)).setOrigin(b.anchorX / b.width, b.anchorY / b.height);
  }

  /** stack: vị trí trong chồng; rack: kệ kho đang chứa (nếu có). */
  sync(stack: number, rack: FurnitureData | null): void {
    const d = this.data;
    this.image.setTexture(boxTextureFor(this.scene, d));
    let gx = d.gx;
    let gy = d.gy;
    let z = stack * BOX_HEIGHT;
    let depth = depthAt(gx, gy, LAYER.box) + stack * 0.01;
    if (rack) {
      const def = getFurniture(rack.type);
      const { w, h } = rotatedSize(def, rack.rot);
      const i = Math.max(0, rack.boxes.indexOf(d.uid));
      const along = (i % 2) + 0.5;
      const level = Math.floor(i / 2);
      gx = rack.gx + (w >= h ? (along * w) / 2 : w / 2);
      gy = rack.gy + (w >= h ? h / 2 : (along * h) / 2);
      z = 3 + level * (def.height / 2);
      depth = footprintDepth(footprintCells(def, rack.gx, rack.gy, rack.rot)) + 0.2 + i * 0.01;
    }
    const p = gridToScreen(gx - BOX_SIZE / 2, gy - BOX_SIZE / 2);
    this.baseY = p.y - z;
    this.image.setPosition(p.x, this.dropping ? this.image.y : this.baseY).setDepth(depth);
  }

  /** Rơi từ trên xuống (giao hàng) hoặc nảy nhẹ khi đặt. */
  drop(height = 120, delay = 0): void {
    this.dropping = true;
    this.image.y = this.baseY - height;
    this.image.setAlpha(0);
    this.scene.tweens.add({
      targets: this.image, y: this.baseY, alpha: 1, duration: 420, delay, ease: 'Bounce.Out',
      onComplete: () => { this.dropping = false; },
    });
  }

  bounce(): void {
    this.scene.tweens.add({ targets: this.image, scaleY: { from: 0.8, to: 1 }, scaleX: { from: 1.15, to: 1 }, duration: 260, ease: 'Back.Out' });
  }

  containsWorld(x: number, y: number): boolean {
    return this.image.visible && this.image.getBounds().contains(x, y);
  }

  destroy(): void {
    this.image.destroy();
  }
}
