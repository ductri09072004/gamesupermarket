import * as THREE from 'three';
import { DENOMINATIONS } from '../config/constants';
import type { FurnitureDef } from '../config/furniture';
import { textCanvas } from '../products/LabelTexture';
import { block, mat } from './FurnitureModels';

export interface CounterParts {
  group: THREE.Group;
  beltTex: THREE.Texture;
  laser: THREE.Mesh;
  lcd: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  drawer: THREE.Group;
  trays: THREE.Mesh[];
  posKeys: THREE.Mesh[];
  /** Điểm cục bộ quan trọng trên mặt quầy */
  beltStart: THREE.Vector3;
  beltEnd: THREE.Vector3;
  scanPoint: THREE.Vector3;
  bagPoint: THREE.Vector3;
  paidPoint: THREE.Vector3;
  changePoint: THREE.Vector3;
  cardPoint: THREE.Vector3;
  cashierView: THREE.Vector3;
  cashierLook: THREE.Vector3;
}

const std = (key: string, color: number, r = 0.5, m = 0) => mat(key, () => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m }));

function denomLabel(d: number): string {
  return d >= 1 ? `$${d}` : `${Math.round(d * 100)}¢`;
}

/** Quầy thu ngân: mặt trước (-Z) phía khách, phía sau (+Z) là thu ngân. */
export function buildCounter(def: FurnitureDef): CounterParts {
  const { w, d, h } = def.size;
  const g = new THREE.Group();
  const wood = std('ctrWood', 0x6c8ea4, 0.55);
  const top = std('ctrTop', 0xe5e7eb, 0.3, 0.2);
  g.add(block(wood, -w / 2, w / 2, 0, h - 0.04, -d / 2, d / 2 - 0.25));
  g.add(block(wood, -w / 2, -w / 2 + 0.05, 0, h - 0.04, d / 2 - 0.25, d / 2));
  g.add(block(wood, w / 2 - 0.05, w / 2, 0, h - 0.04, d / 2 - 0.25, d / 2));
  g.add(block(top, -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2));
  // băng chuyền
  const beltTex = textCanvas(64, 64, (c) => {
    c.fillStyle = '#23262b';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#34383f';
    c.fillRect(0, 0, 8, 64);
  });
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.repeat.set(14, 1);
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.8 });
  g.add(block(beltMat, -w / 2 + 0.06, 0.05, h, h + 0.02, -d / 2 + 0.05, -d / 2 + 0.4, false));
  g.add(block(std('ctrRail', 0x9ca3af, 0.3, 0.8), -w / 2 + 0.06, 0.05, h, h + 0.05, -d / 2 + 0.02, -d / 2 + 0.05, false));
  // máy quét
  g.add(block(std('scanBody', 0x374151, 0.4, 0.3), 0.08, 0.38, h, h + 0.01, -d / 2 + 0.06, -d / 2 + 0.4, false));
  g.add(block(mat('scanGlass', () => new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.6 })), 0.12, 0.34, h + 0.01, h + 0.013, -d / 2 + 0.1, -d / 2 + 0.36, false));
  g.add(block(std('scanBody', 0x374151, 0.4, 0.3), 0.08, 0.38, h, h + 0.22, -d / 2 + 0.38, -d / 2 + 0.42));
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.004), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25 }));
  laser.rotation.x = -Math.PI / 2;
  laser.position.set(0.23, h + 0.016, -d / 2 + 0.23);
  g.add(laser);
  // khu đóng túi
  const bag = new THREE.Group();
  const paper = std('bagPaper', 0xc8a27a, 0.9);
  bag.add(block(paper, -0.14, 0.14, 0, 0.3, -0.09, -0.085, false), block(paper, -0.14, 0.14, 0, 0.3, 0.085, 0.09, false));
  bag.add(block(paper, -0.14, -0.135, 0, 0.3, -0.09, 0.09, false), block(paper, 0.135, 0.14, 0, 0.3, -0.09, 0.09, false));
  bag.position.set(0.68, h, -d / 2 + 0.22);
  g.add(bag);
  // cột màn hình LCD
  const LX = 0.92;
  g.add(block(std('pole', 0x1f2937, 0.4, 0.5), LX - 0.015, LX + 0.015, h, h + 0.3, 0.02, 0.05));
  const lcdCanvas = document.createElement('canvas');
  lcdCanvas.width = 512;
  lcdCanvas.height = 256;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas);
  lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex });
  const lcdGroup = new THREE.Group();
  lcdGroup.add(block(std('lcdCase', 0x111827, 0.4), -0.2, 0.2, -0.11, 0.11, -0.02, 0.02));
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.19), lcdMat);
  lcd.position.z = 0.021;
  const lcdFront = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.19), lcdMat);
  lcdFront.position.z = -0.021;
  lcdFront.rotation.y = Math.PI;
  lcdGroup.add(lcd, lcdFront);
  lcdGroup.position.set(LX - 0.12, h + 0.4, 0.035);
  lcdGroup.rotation.y = -0.5;
  g.add(lcdGroup);
  // ngăn kéo tiền (phía thu ngân)
  const drawer = new THREE.Group();
  const trayMat = std('tray', 0x2b2d42, 0.6);
  drawer.add(block(trayMat, -0.3, 0.3, 0, 0.1, -0.2, 0.2));
  const trays: THREE.Mesh[] = [];
  DENOMINATIONS.forEach((den, i) => {
    const bill = den >= 1;
    const col = bill ? i : i - 5;
    const tex = textCanvas(128, 64, (c) => {
      c.fillStyle = bill ? '#b7e4c7' : '#ffe8a3';
      c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#1b4332';
      c.font = '900 34px "Nunito", Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(denomLabel(den), 64, 34);
    });
    const t = new THREE.Mesh(new THREE.BoxGeometry(bill ? 0.1 : 0.12, 0.012, bill ? 0.16 : 0.1), [
      trayMat, trayMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), trayMat, trayMat, trayMat,
    ]);
    const x = bill ? -0.24 + col * 0.12 : -0.21 + col * 0.14;
    t.position.set(x, 0.105, bill ? 0.08 : -0.11);
    t.userData = { kind: 'tray', denom: den };
    drawer.add(t);
    trays.push(t);
  });
  drawer.position.set(0.1, h - 0.16, d / 2 - 0.2);
  g.add(drawer);
  // máy POS
  const pos = new THREE.Group();
  pos.add(block(std('posBody', 0x1f2937, 0.5), -0.07, 0.07, 0, 0.03, -0.11, 0.11));
  const posScreen = block(mat('posScreen', () => new THREE.MeshStandardMaterial({ color: 0x9ef01a, emissive: 0x4a7a10, emissiveIntensity: 0.6 })), -0.055, 0.055, 0.03, 0.033, -0.1, -0.05, false);
  pos.add(posScreen);
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back', 'clear', 'enter'];
  const posKeys: THREE.Mesh[] = [];
  keys.forEach((k, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const color = k === 'enter' ? 0x2a9d8f : k === 'clear' ? 0xe63946 : k === 'back' ? 0xf4a261 : 0xe5e7eb;
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.026), mat(`key${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5 })));
    key.position.set(-0.042 + c * 0.042, 0.036, -0.03 + r * 0.03);
    key.userData = { kind: 'poskey', key: k };
    pos.add(key);
    posKeys.push(key);
  });
  pos.position.set(0.72, h, d / 2 - 0.2);
  g.add(pos);
  return {
    group: g, beltTex, laser, lcd: { canvas: lcdCanvas, tex: lcdTex }, drawer, trays, posKeys,
    beltStart: new THREE.Vector3(-w / 2 + 0.15, h + 0.02, -d / 2 + 0.22),
    beltEnd: new THREE.Vector3(-0.05, h + 0.02, -d / 2 + 0.22),
    scanPoint: new THREE.Vector3(0.23, h + 0.08, -d / 2 + 0.23),
    bagPoint: new THREE.Vector3(0.68, h + 0.05, -d / 2 + 0.22),
    paidPoint: new THREE.Vector3(0.45, h + 0.005, -d / 2 + 0.1),
    changePoint: new THREE.Vector3(0.45, h + 0.005, d / 2 - 0.35),
    cardPoint: new THREE.Vector3(0.6, h + 0.005, d / 2 - 0.3),
    cashierView: new THREE.Vector3(0.1, h + 0.8, d / 2 + 0.6),
    cashierLook: new THREE.Vector3(0.1, h - 0.1, -d / 2 + 0.05),
  };
}
