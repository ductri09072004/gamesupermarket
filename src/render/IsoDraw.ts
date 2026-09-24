import Phaser from 'phaser';
import { TILE_H, TILE_W } from '../config/constants';

export const OUTLINE = 0x3d3551;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export interface BoxColors {
  top: number;
  left: number;
  right: number;
}

export interface IsoBoxSpec {
  w: number; // số ô theo gx
  h: number; // số ô theo gy
  height: number; // px
  colors: BoxColors;
  inset?: number; // thu nhỏ footprint (đơn vị ô)
  outline?: boolean;
}

/** Kích thước texture & điểm neo (góc trên của footprint ở mặt đất). */
export function isoBoxBounds(w: number, h: number, height: number, pad = 2) {
  return {
    width: Math.ceil((w + h) * HW + pad * 2),
    height: Math.ceil((w + h) * HH + height + pad * 2),
    anchorX: h * HW + pad,
    anchorY: height + pad,
  };
}

/** Toạ độ điểm lưới cục bộ (a, b) ở độ cao z so với điểm neo. */
export function isoPt(ax: number, ay: number, a: number, b: number, z = 0): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2(ax + (a - b) * HW, ay + (a + b) * HH - z);
}

/** Vẽ hộp isometric 3 mặt với 3 sắc độ + viền 2px. */
export function drawIsoBox(g: Phaser.GameObjects.Graphics, ax: number, ay: number, spec: IsoBoxSpec): void {
  const i = spec.inset ?? 0;
  const { w, h, height, colors } = spec;
  const a0 = i;
  const b0 = i;
  const a1 = w - i;
  const b1 = h - i;
  const topPts = [isoPt(ax, ay, a0, b0, height), isoPt(ax, ay, a1, b0, height), isoPt(ax, ay, a1, b1, height), isoPt(ax, ay, a0, b1, height)];
  const left = [isoPt(ax, ay, a0, b1, height), isoPt(ax, ay, a1, b1, height), isoPt(ax, ay, a1, b1, 0), isoPt(ax, ay, a0, b1, 0)];
  const right = [isoPt(ax, ay, a1, b0, height), isoPt(ax, ay, a1, b1, height), isoPt(ax, ay, a1, b1, 0), isoPt(ax, ay, a1, b0, 0)];
  g.fillStyle(colors.left, 1).fillPoints(left, true);
  g.fillStyle(colors.right, 1).fillPoints(right, true);
  g.fillStyle(colors.top, 1).fillPoints(topPts, true);
  if (spec.outline !== false) {
    g.lineStyle(2, OUTLINE, 1);
    g.strokePoints(topPts, true);
    g.strokePoints(left, true);
    g.strokePoints(right, true);
  }
}

/** Đường thẳng trên mặt trái (dọc cạnh gy = h) ở độ cao z. */
export function faceLineLeft(g: Phaser.GameObjects.Graphics, ax: number, ay: number, w: number, h: number, z: number, inset = 0): void {
  const p1 = isoPt(ax, ay, inset, h - inset, z);
  const p2 = isoPt(ax, ay, w - inset, h - inset, z);
  g.lineBetween(p1.x, p1.y, p2.x, p2.y);
}

export function faceLineRight(g: Phaser.GameObjects.Graphics, ax: number, ay: number, w: number, h: number, z: number, inset = 0): void {
  const p1 = isoPt(ax, ay, w - inset, inset, z);
  const p2 = isoPt(ax, ay, w - inset, h - inset, z);
  g.lineBetween(p1.x, p1.y, p2.x, p2.y);
}

export function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Tạo texture từ hàm vẽ (bỏ qua nếu đã có). */
export function makeTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
  return key;
}

/** Vẽ một khối lập phương nhỏ (sản phẩm) có tâm đáy tại (x, y). */
export function drawMiniCube(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, hgt: number, color: number): void {
  const hw = size;
  const hh = size / 2;
  const top = [
    new Phaser.Math.Vector2(x, y - hh - hgt), new Phaser.Math.Vector2(x + hw, y - hgt),
    new Phaser.Math.Vector2(x, y + hh - hgt), new Phaser.Math.Vector2(x - hw, y - hgt),
  ];
  const left = [
    new Phaser.Math.Vector2(x - hw, y - hgt), new Phaser.Math.Vector2(x, y + hh - hgt),
    new Phaser.Math.Vector2(x, y + hh), new Phaser.Math.Vector2(x - hw, y),
  ];
  const right = [
    new Phaser.Math.Vector2(x + hw, y - hgt), new Phaser.Math.Vector2(x, y + hh - hgt),
    new Phaser.Math.Vector2(x, y + hh), new Phaser.Math.Vector2(x + hw, y),
  ];
  g.fillStyle(shade(color, -0.15), 1).fillPoints(left, true);
  g.fillStyle(shade(color, -0.3), 1).fillPoints(right, true);
  g.fillStyle(color, 1).fillPoints(top, true);
  g.lineStyle(1, OUTLINE, 0.8);
  g.strokePoints([top[0], top[1], right[3], right[2], left[3], top[3]], true);
}
