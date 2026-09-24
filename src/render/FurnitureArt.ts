import Phaser from 'phaser';
import type { FurnitureDef } from '../config/furniture';
import { rotatedSize } from '../iso/Footprint';
import { drawIsoBox, faceLineLeft, faceLineRight, isoBoxBounds, isoPt, makeTexture, OUTLINE, shade } from './IsoDraw';

export interface TexInfo {
  key: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const infos = new Map<string, TexInfo>();
const EXTRA_TOP = 30; // chỗ cho màn hình máy tính / máy tính tiền

export function furnitureTexture(scene: Phaser.Scene, def: FurnitureDef, rot: number): TexInfo {
  const { w, h } = rotatedSize(def, rot);
  const key = `furn_${def.id}_${rot % 2}`;
  const cached = infos.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  const b = isoBoxBounds(w, h, def.height + EXTRA_TOP);
  const info: TexInfo = { key, width: b.width, height: b.height, anchorX: b.anchorX, anchorY: b.anchorY };
  makeTexture(scene, key, b.width, b.height, (g) => drawFurniture(g, def, w, h, b.anchorX, b.anchorY));
  infos.set(key, info);
  return info;
}

function drawFurniture(g: Phaser.GameObjects.Graphics, def: FurnitureDef, w: number, h: number, ax: number, ay: number): void {
  const H = def.height;
  const c = def.colors;
  switch (def.kind) {
    case 'display': {
      if (def.storage === 'fridge') {
        drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.04 });
        g.lineStyle(2, 0xffffff, 0.9);
        faceLineLeft(g, ax, ay, w, h, H * 0.5, 0.04);
        faceLineRight(g, ax, ay, w, h, H * 0.5, 0.04);
        g.lineStyle(1, 0xffffff, 0.6);
        faceLineLeft(g, ax, ay, w, h, H * 0.25, 0.04);
        faceLineLeft(g, ax, ay, w, h, H * 0.75, 0.04);
      } else if (def.storage === 'freezer') {
        drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.04 });
        const glass = [isoPt(ax, ay, 0.15, 0.15, H), isoPt(ax, ay, w - 0.15, 0.15, H), isoPt(ax, ay, w - 0.15, h - 0.15, H), isoPt(ax, ay, 0.15, h - 0.15, H)];
        g.fillStyle(0xeaf6ff, 0.8).fillPoints(glass, true);
        g.lineStyle(1, 0x6f9cc8, 1).strokePoints(glass, true);
      } else {
        drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.05 });
        g.lineStyle(2, shade(c.left, -0.3), 1);
        faceLineLeft(g, ax, ay, w, h, H * 0.35, 0.05);
        faceLineLeft(g, ax, ay, w, h, H * 0.7, 0.05);
        g.lineStyle(2, shade(c.right, -0.3), 1);
        faceLineRight(g, ax, ay, w, h, H * 0.35, 0.05);
        faceLineRight(g, ax, ay, w, h, H * 0.7, 0.05);
      }
      break;
    }
    case 'checkout': {
      drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.06 });
      // băng chuyền
      const along = w >= h;
      const belt = along
        ? [isoPt(ax, ay, 0.15, 0.3, H), isoPt(ax, ay, w * 0.62, 0.3, H), isoPt(ax, ay, w * 0.62, h - 0.3, H), isoPt(ax, ay, 0.15, h - 0.3, H)]
        : [isoPt(ax, ay, 0.3, 0.15, H), isoPt(ax, ay, w - 0.3, 0.15, H), isoPt(ax, ay, w - 0.3, h * 0.62, H), isoPt(ax, ay, 0.3, h * 0.62, H)];
      g.fillStyle(0x3d3551, 1).fillPoints(belt, true);
      // máy tính tiền
      const rx = along ? w * 0.72 : 0.2;
      const ry = along ? 0.2 : h * 0.72;
      drawRegister(g, ax, ay, rx, ry, H);
      break;
    }
    case 'trash': {
      drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.22 });
      const lid = [isoPt(ax, ay, 0.18, 0.18, H + 3), isoPt(ax, ay, w - 0.18, 0.18, H + 3), isoPt(ax, ay, w - 0.18, h - 0.18, H + 3), isoPt(ax, ay, 0.18, h - 0.18, H + 3)];
      g.fillStyle(shade(c.top, -0.2), 1).fillPoints(lid, true);
      g.lineStyle(2, OUTLINE, 1).strokePoints(lid, true);
      break;
    }
    case 'rack': {
      g.lineStyle(3, shade(c.left, -0.2), 1);
      for (const [a, b2] of [[0.08, 0.08], [w - 0.08, 0.08], [w - 0.08, h - 0.08], [0.08, h - 0.08]]) {
        const p0 = isoPt(ax, ay, a, b2, 0);
        const p1 = isoPt(ax, ay, a, b2, H);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      for (const z of [2, H / 2, H]) {
        const pts = [isoPt(ax, ay, 0.08, 0.08, z), isoPt(ax, ay, w - 0.08, 0.08, z), isoPt(ax, ay, w - 0.08, h - 0.08, z), isoPt(ax, ay, 0.08, h - 0.08, z)];
        g.fillStyle(c.top, 0.9).fillPoints(pts, true);
        g.lineStyle(1.5, OUTLINE, 0.8).strokePoints(pts, true);
      }
      break;
    }
    case 'computer': {
      drawIsoBox(g, ax, ay, { w, h, height: H, colors: c, inset: 0.08 });
      // màn hình
      const base = isoPt(ax, ay, w * 0.4, h * 0.4, H);
      g.fillStyle(0x3d3551, 1).fillRect(base.x - 2, base.y - 8, 4, 8);
      g.fillStyle(0x3d3551, 1).fillRoundedRect(base.x - 14, base.y - 28, 28, 20, 3);
      g.fillStyle(0x7ae0ff, 1).fillRoundedRect(base.x - 12, base.y - 26, 24, 16, 2);
      g.fillStyle(0xffffff, 0.6).fillRect(base.x - 9, base.y - 23, 8, 2).fillRect(base.x - 9, base.y - 19, 12, 2);
      // bàn phím
      const kb = isoPt(ax, ay, w * 0.7, h * 0.65, H);
      g.fillStyle(0xf8f9fa, 1).fillRoundedRect(kb.x - 8, kb.y - 3, 16, 5, 1);
      break;
    }
  }
}

function drawRegister(g: Phaser.GameObjects.Graphics, ax: number, ay: number, a: number, b: number, H: number): void {
  const p = isoPt(ax, ay, a + 0.15, b + 0.15, H);
  g.fillStyle(0x6c757d, 1).fillRoundedRect(p.x - 9, p.y - 10, 18, 10, 2);
  g.fillStyle(0x3d3551, 1).fillRoundedRect(p.x - 7, p.y - 22, 14, 11, 2);
  g.fillStyle(0x9ef01a, 1).fillRect(p.x - 5, p.y - 20, 10, 5);
  g.lineStyle(1.5, OUTLINE, 1).strokeRoundedRect(p.x - 9, p.y - 10, 18, 10, 2);
}
