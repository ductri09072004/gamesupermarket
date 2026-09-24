import Phaser from 'phaser';
import { TILE_H, TILE_W } from '../config/constants';
import { makeTexture, OUTLINE, shade } from './IsoDraw';

export const WALL_H = 76;
export const GLASS_H = 18;
const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export const TILE_COLORS = {
  floorA: 0xfdf3e3,
  floorB: 0xf6dfc6,
  sidewalk: 0xd9d6e0,
  road: 0x6d6a7c,
  grass: 0xa7d98b,
  warehouse: 0xcfd3da,
  door: 0xb98b6e,
  wall: 0xfff1d6,
};

function diamond(g: Phaser.GameObjects.Graphics, fill: number, line: number, lineAlpha = 0.35): void {
  const pts = [V(TILE_W / 2, 0), V(TILE_W, TILE_H / 2), V(TILE_W / 2, TILE_H), V(0, TILE_H / 2)];
  g.fillStyle(fill, 1).fillPoints(pts, true);
  g.lineStyle(1, line, lineAlpha).strokePoints(pts, true);
}

export function generateTileTextures(scene: Phaser.Scene): void {
  const c = TILE_COLORS;
  makeTexture(scene, 'tile_floor_a', TILE_W, TILE_H, (g) => diamond(g, c.floorA, 0xe0c9a6));
  makeTexture(scene, 'tile_floor_b', TILE_W, TILE_H, (g) => diamond(g, c.floorB, 0xe0c9a6));
  makeTexture(scene, 'tile_sidewalk', TILE_W, TILE_H, (g) => {
    diamond(g, c.sidewalk, 0xa8a4b8, 0.8);
    g.lineStyle(1, 0xc2bfcc, 1).lineBetween(TILE_W / 4, TILE_H / 4, (TILE_W * 3) / 4, (TILE_H * 3) / 4);
  });
  makeTexture(scene, 'tile_road', TILE_W, TILE_H, (g) => diamond(g, c.road, 0x5a5768, 0.6));
  makeTexture(scene, 'tile_road_line', TILE_W, TILE_H, (g) => {
    diamond(g, c.road, 0x5a5768, 0.6);
    g.lineStyle(3, 0xf1e3a0, 1).lineBetween(TILE_W * 0.35, TILE_H * 0.35, TILE_W * 0.65, TILE_H * 0.65);
  });
  makeTexture(scene, 'tile_grass', TILE_W, TILE_H, (g) => {
    diamond(g, c.grass, 0x8fc475, 0.6);
    g.fillStyle(0x8fc475, 1);
    g.fillRect(20, 12, 2, 3).fillRect(40, 18, 2, 3).fillRect(30, 8, 2, 2);
  });
  makeTexture(scene, 'tile_warehouse', TILE_W, TILE_H, (g) => diamond(g, c.warehouse, 0xa9aeb8, 0.8));
  makeTexture(scene, 'tile_door', TILE_W, TILE_H, (g) => {
    diamond(g, c.floorA, 0xe0c9a6);
    const pts = [V(TILE_W / 2, 5), V(TILE_W - 10, TILE_H / 2), V(TILE_W / 2, TILE_H - 5), V(10, TILE_H / 2)];
    g.fillStyle(c.door, 1).fillPoints(pts, true);
    g.lineStyle(1, shade(c.door, -0.3), 1).strokePoints(pts, true);
  });
  makeTexture(scene, 'tile_highlight', TILE_W, TILE_H, (g) => {
    const pts = [V(TILE_W / 2, 1), V(TILE_W - 1, TILE_H / 2), V(TILE_W / 2, TILE_H - 1), V(1, TILE_H / 2)];
    g.fillStyle(0xffffff, 0.35).fillPoints(pts, true);
    g.lineStyle(2, 0xffffff, 0.9).strokePoints(pts, true);
  });
  generateWallTextures(scene);
}

/** Tấm tường: 'dr' chạy xuống-phải từ điểm neo, 'dl' chạy xuống-trái. */
function wallPanel(scene: Phaser.Scene, key: string, dir: 'dr' | 'dl', hgt: number, glass: boolean): void {
  const pad = 2;
  makeTexture(scene, key, TILE_W / 2 + pad * 2, TILE_H / 2 + hgt + pad * 2, (g) => {
    const x0 = dir === 'dr' ? pad : TILE_W / 2 + pad;
    const x1 = dir === 'dr' ? TILE_W / 2 + pad : pad;
    const yb0 = hgt + pad;
    const yb1 = hgt + pad + TILE_H / 2;
    const pts = [V(x0, yb0 - hgt), V(x1, yb1 - hgt), V(x1, yb1), V(x0, yb0)];
    if (glass) {
      g.fillStyle(0xbfe6f5, 0.55).fillPoints(pts, true);
      g.lineStyle(3, 0x8fa6b8, 1).lineBetween(x0, yb0 - hgt, x1, yb1 - hgt);
      g.lineStyle(2, 0x8fa6b8, 1).lineBetween(x0, yb0, x1, yb1);
      return;
    }
    const base = dir === 'dr' ? TILE_COLORS.wall : shade(TILE_COLORS.wall, -0.06);
    g.fillStyle(base, 1).fillPoints(pts, true);
    // chân tường
    const bb = [V(x0, yb0 - 8), V(x1, yb1 - 8), V(x1, yb1), V(x0, yb0)];
    g.fillStyle(0xd9b99b, 1).fillPoints(bb, true);
    // mép trên
    g.lineStyle(4, 0xe8cfa8, 1).lineBetween(x0, yb0 - hgt + 1, x1, yb1 - hgt + 1);
    g.lineStyle(1, OUTLINE, 0.25).strokePoints(pts, true);
  });
}

function generateWallTextures(scene: Phaser.Scene): void {
  wallPanel(scene, 'wall_dr', 'dr', WALL_H, false);
  wallPanel(scene, 'wall_dl', 'dl', WALL_H, false);
  wallPanel(scene, 'glass_dr', 'dr', GLASS_H, true);
  wallPanel(scene, 'glass_dl', 'dl', GLASS_H, true);
  makeTexture(scene, 'post', 8, WALL_H + 6, (g) => {
    g.fillStyle(0xe8cfa8, 1).fillRect(1, 2, 6, WALL_H + 2);
    g.lineStyle(1, OUTLINE, 0.4).strokeRect(1, 2, 6, WALL_H + 2);
  });
  makeTexture(scene, 'post_low', 8, GLASS_H + 8, (g) => {
    g.fillStyle(0x8fa6b8, 1).fillRect(2, 2, 4, GLASS_H + 4);
  });
  makeTexture(scene, 'shadow', 28, 12, (g) => {
    g.fillStyle(0x000000, 0.18).fillEllipse(14, 6, 26, 10);
  });
  makeTexture(scene, 'particle', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  });
  makeTexture(scene, 'sparkle', 10, 10, (g) => {
    g.fillStyle(0xffe066, 1).fillPoints([V(5, 0), V(6.5, 3.5), V(10, 5), V(6.5, 6.5), V(5, 10), V(3.5, 6.5), V(0, 5), V(3.5, 3.5)], true);
  });
  makeTexture(scene, 'tree', 48, 72, (g) => {
    g.fillStyle(0x8d6e63, 1).fillRect(21, 44, 6, 24);
    g.fillStyle(0x6a994e, 1).fillCircle(24, 30, 20);
    g.fillStyle(0x81b862, 1).fillCircle(18, 24, 12).fillCircle(30, 20, 10);
    g.lineStyle(2, OUTLINE, 0.6).strokeCircle(24, 30, 20);
  });
  makeTexture(scene, 'bush', 36, 26, (g) => {
    g.fillStyle(0x6a994e, 1).fillEllipse(18, 16, 34, 18);
    g.fillStyle(0x88c070, 1).fillEllipse(13, 12, 14, 9);
    g.fillStyle(0xff8fab, 1).fillCircle(24, 10, 2.5).fillCircle(10, 16, 2.5);
  });
}
