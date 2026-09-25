import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { shelfGeom, slotBox, tierHeights } from '../systems/SlotLayout';
import { textCanvas } from '../products/LabelTexture';
import { backShade, block, glassMat, mat, std } from './FurnitureModels';

/** Biển chữ phát sáng (canvas) cho đầu tủ. */
function signMat(key: string, text: string, bg: string, fg: string, glow = 0.7): THREE.Material {
  return mat(`sign:${key}`, () => {
    const t = textCanvas(512, 96, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, 512, 96);
      c.fillStyle = fg;
      c.font = '900 54px "Nunito", Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, 256, 52);
    });
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow });
  });
}

const lampMat = () => mat('caseLamp', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.2 }));

/** Giá treo quần áo kiểu "face-out": mỗi cột là 1 thanh treo chạy từ trước ra sau. */
export function clothingRack(def: FurnitureDef, g: THREE.Group): void {
  const { w, d } = def.size;
  const chrome = std(0xd9dee4, 0.2, 0.9);
  const b0 = slotBox(def, 0);
  const railY = b0.y + b0.height + 0.01;
  const t = 0.025;
  // đế chữ H + 2 trụ hai bên
  for (const x of [-w / 2 + 0.01, w / 2 - 0.01 - t]) {
    g.add(block(chrome, x, x + t, 0, railY + 0.02, -0.02, 0.02));
    g.add(block(chrome, x - 0.01, x + t + 0.01, 0, 0.03, -d / 2, d / 2));
    for (const z of [-d / 2, d / 2 - 0.04]) g.add(block(std(0x222222, 0.8), x - 0.01, x + t + 0.01, 0, 0.012, z, z + 0.04, false));
  }
  g.add(block(chrome, -w / 2 + 0.01, w / 2 - 0.01, railY + 0.02, railY + 0.045, -0.015, 0.015));
  g.add(block(chrome, -w / 2 + 0.01, w / 2 - 0.01, 0.03, 0.05, -0.015, 0.015));
  // thanh treo từng cột (nối lên xà ngang)
  for (let c = 0; c < def.columns; c++) {
    const b = slotBox(def, c);
    const x = b.x0 + b.width / 2;
    g.add(block(chrome, x - 0.009, x + 0.009, railY - 0.009, railY + 0.009, -d / 2 + 0.01, d / 2 - 0.02));
    g.add(block(chrome, x - 0.02, x + 0.02, railY - 0.02, railY + 0.02, -d / 2, -d / 2 + 0.012, false));
    g.add(block(chrome, x - 0.008, x + 0.008, railY, railY + 0.03, -0.01, 0.01, false));
  }
  const sign = block(signMat('fashion', '👕 THỜI TRANG', '#264653', '#e9c46a', 0.5), -w * 0.3, w * 0.3, railY + 0.08, railY + 0.2, -0.006, 0.006, false);
  g.add(sign);
  g.add(block(chrome, -0.01, 0.01, railY + 0.045, railY + 0.08, -0.01, 0.01, false));
}

/** Tủ kính điện tử: tủ dưới tối màu, kệ kính 4 tầng, đèn LED, biển trên nóc. */
export function electronicsCase(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const geo = shelfGeom(def);
  const body = std(0x1f2937, 0.35, 0.4);
  const wood = std(0x8d6e63, 0.55);
  g.add(block(body, -w / 2, w / 2, 0, geo.base, -d / 2, d / 2));
  g.add(block(wood, -w / 2 + 0.03, w / 2 - 0.03, 0.06, geo.base - 0.04, -d / 2 - 0.004, -d / 2, false));
  g.add(block(std(0xc9ced6, 0.3, 0.8), -0.15, 0.15, geo.base - 0.12, geo.base - 0.1, -d / 2 - 0.02, -d / 2 - 0.004, false));
  g.add(block(body, -w / 2, w / 2, h - geo.top, h, -d / 2, d / 2));
  g.add(block(body, -w / 2, w / 2, geo.base, h - geo.top, d / 2 - 0.03, d / 2));
  for (const x of [-w / 2, w / 2 - geo.side]) g.add(block(body, x, x + geo.side, geo.base, h - geo.top, -d / 2, d / 2));
  // vách sau: panel sáng màu để hàng nổi bật
  g.add(block(std(0xe8eef5, 0.5), -w / 2 + geo.side, w / 2 - geo.side, geo.base, h - geo.top, d / 2 - 0.035, d / 2 - 0.03, false));
  backShade(def, g, d / 2 - 0.037, 0.4);
  const glassShelf = mat('glassShelf', () => new THREE.MeshStandardMaterial({
    color: 0xcfefff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2,
  }));
  for (const y of tierHeights(def)) {
    g.add(block(glassShelf, -w / 2 + geo.side, w / 2 - geo.side, y, y + geo.board, -d / 2 + 0.03, d / 2 - 0.03, false));
    g.add(block(lampMat(), -w / 2 + geo.side, w / 2 - geo.side, y - 0.012, y, -d / 2 + 0.035, -d / 2 + 0.05, false));
  }
  const front = block(glassMat(), -w / 2 + geo.side, w / 2 - geo.side, geo.base, h - geo.top, -d / 2 - 0.012, -d / 2, false);
  front.castShadow = false;
  g.add(front);
  g.add(block(signMat('tech', '🎧 ĐIỆN TỬ', '#0b132b', '#5bc0eb'), -w / 2 + 0.05, w / 2 - 0.05, h - geo.top + 0.015, h - 0.015, -d / 2 - 0.006, -d / 2 - 0.001, false));
}

/** Máy bán hàng tự động: cửa kính bên trái, bàn phím + khe tiền bên phải, ngăn lấy hàng dưới. */
export function vendingMachine(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const geo = shelfGeom(def);
  const panel = geo.panel ?? 0.28;
  const red = std(0xd62828, 0.35, 0.3);
  const dark = std(0x1b1b1f, 0.5, 0.2);
  const f = -d / 2;
  const xIn0 = -w / 2 + geo.side;
  const xIn1 = w / 2 - geo.side - panel;
  g.add(block(red, -w / 2, w / 2, 0, h, d / 2 - 0.04, d / 2));
  for (const x of [-w / 2, w / 2 - geo.side]) g.add(block(red, x, x + geo.side, 0, h, f, d / 2));
  g.add(block(red, -w / 2, w / 2, h - geo.top, h, f, d / 2));
  g.add(block(red, -w / 2, w / 2, 0, geo.base, f, d / 2));
  g.add(block(red, xIn1, w / 2 - geo.side, geo.base, h - geo.top, f, d / 2 - 0.04));
  g.add(block(std(0x2b2d42, 0.6), xIn0, xIn1, geo.base, h - geo.top, d / 2 - 0.05, d / 2 - 0.04, false));
  // ngăn lấy hàng
  g.add(block(dark, xIn0 + 0.05, xIn1 - 0.05, 0.1, 0.28, f - 0.004, f + 0.1, false));
  g.add(block(std(0x6c757d, 0.4, 0.6), xIn0 + 0.05, xIn1 - 0.05, 0.25, 0.28, f - 0.012, f, false));
  // tầng + lò xo đẩy hàng (vẽ bằng texture trên mặt tầng)
  const coil = mat(`vendCoil${def.columns}`, () => {
    const t = textCanvas(256, 256, (c) => {
      c.fillStyle = '#3d4451';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#d0d6de';
      c.lineWidth = 5;
      const cw = 256 / def.columns;
      for (let i = 0; i < def.columns; i++) for (let y = 10; y < 256; y += 22) {
        c.beginPath();
        c.ellipse(i * cw + cw / 2, y, cw * 0.36, 6, 0, 0, Math.PI * 2);
        c.stroke();
      }
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.5 });
  });
  for (const y of tierHeights(def)) {
    g.add(block(coil, xIn0, xIn1, y, y + geo.board, f + 0.06, d / 2 - 0.05, false));
    g.add(block(std(0x111111, 0.5), xIn0, xIn1, y - 0.03, y + geo.board, f + 0.05, f + 0.06, false));
  }
  g.add(block(lampMat(), xIn0, xIn1, h - geo.top - 0.02, h - geo.top, f + 0.06, f + 0.09, false));
  const glass = block(glassMat(), xIn0, xIn1, geo.base, h - geo.top, f - 0.012, f, false);
  glass.castShadow = false;
  g.add(glass);
  // bảng điều khiển bên phải
  const keypad = mat('vendKeypad', () => {
    const t = textCanvas(128, 256, (c) => {
      c.fillStyle = '#1b1b1f';
      c.fillRect(0, 0, 128, 256);
      c.fillStyle = '#06d6a0';
      c.fillRect(14, 16, 100, 34);
      c.fillStyle = '#073b4c';
      c.font = '800 20px monospace';
      c.fillText('READY', 34, 40);
      c.font = '800 18px Arial';
      for (let i = 0; i < 12; i++) {
        const x = 16 + (i % 3) * 34;
        const y = 66 + Math.floor(i / 3) * 34;
        c.fillStyle = '#e5e7eb';
        c.fillRect(x, y, 28, 26);
        c.fillStyle = '#111';
        c.fillText(['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'][i], x + 8, y + 19);
      }
      c.fillStyle = '#6c757d';
      c.fillRect(30, 210, 68, 10);
      c.fillRect(56, 230, 16, 18);
    });
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.4 });
  });
  g.add(block(keypad, xIn1 + 0.04, w / 2 - geo.side - 0.04, 0.95, 1.45, f - 0.008, f, false));
  g.add(block(std(0xffd166, 0.4, 0.5), xIn1 + 0.08, w / 2 - geo.side - 0.08, 0.5, 0.58, f - 0.01, f, false));
  g.add(block(signMat('vend', 'SNACK & DRINK', '#d62828', '#ffffff', 0.8), -w / 2 + 0.04, w / 2 - 0.04, h - geo.top + 0.03, h - 0.03, f - 0.006, f - 0.001, false));
}
