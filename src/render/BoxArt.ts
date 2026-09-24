import Phaser from 'phaser';
import { getProduct } from '../config/products';
import { drawIsoBox, hexToInt, isoBoxBounds, isoPt, makeTexture, OUTLINE, shade } from './IsoDraw';

export const BOX_SIZE = 0.56; // cạnh thùng (đơn vị ô)
export const BOX_HEIGHT = 18;
const CARDBOARD = { top: 0xe6b981, left: 0xc9965c, right: 0xb07e47 };

export function boxBounds() {
  return isoBoxBounds(BOX_SIZE, BOX_SIZE, BOX_HEIGHT + 10);
}

export function boxTexture(scene: Phaser.Scene, productId: string, open: boolean, empty: boolean): string {
  const key = `box_${productId}_${open ? (empty ? 'e' : 'o') : 'c'}`;
  const b = boxBounds();
  const color = hexToInt(getProduct(productId).color);
  return makeTexture(scene, key, b.width, b.height, (g) => {
    const ax = b.anchorX;
    const ay = b.anchorY;
    const s = BOX_SIZE;
    drawIsoBox(g, ax, ay, { w: s, h: s, height: BOX_HEIGHT, colors: CARDBOARD });
    // nhãn sản phẩm trên mặt trái
    const band = [isoPt(ax, ay, 0.08, s, 12), isoPt(ax, ay, s - 0.08, s, 12), isoPt(ax, ay, s - 0.08, s, 5), isoPt(ax, ay, 0.08, s, 5)];
    g.fillStyle(color, 1).fillPoints(band, true);
    g.lineStyle(1, OUTLINE, 0.7).strokePoints(band, true);
    const H = BOX_HEIGHT;
    if (!open) {
      const t1 = isoPt(ax, ay, s / 2, 0, H);
      const t2 = isoPt(ax, ay, s / 2, s, H);
      g.lineStyle(3, 0xf4e1c1, 1).lineBetween(t1.x, t1.y, t2.x, t2.y);
      return;
    }
    const inner = [isoPt(ax, ay, 0.06, 0.06, H), isoPt(ax, ay, s - 0.06, 0.06, H), isoPt(ax, ay, s - 0.06, s - 0.06, H), isoPt(ax, ay, 0.06, s - 0.06, H)];
    g.fillStyle(0x7a5230, 1).fillPoints(inner, true);
    if (!empty) {
      const mid = isoPt(ax, ay, s / 2, s / 2, H - 2);
      g.fillStyle(color, 1).fillEllipse(mid.x, mid.y, 18, 7);
      g.fillStyle(shade(color, 0.3), 1).fillEllipse(mid.x - 3, mid.y - 1, 6, 2);
    }
    // nắp mở
    const f1 = [isoPt(ax, ay, 0, 0, H), isoPt(ax, ay, 0, s, H), isoPt(ax, ay, -0.2, s, H + 8), isoPt(ax, ay, -0.2, 0, H + 8)];
    const f2 = [isoPt(ax, ay, 0, 0, H), isoPt(ax, ay, s, 0, H), isoPt(ax, ay, s, -0.2, H + 8), isoPt(ax, ay, 0, -0.2, H + 8)];
    g.fillStyle(CARDBOARD.top, 1).fillPoints(f1, true).fillPoints(f2, true);
    g.lineStyle(1.5, OUTLINE, 0.9).strokePoints(f1, true).strokePoints(f2, true);
  });
}
