import * as THREE from 'three';
import { prop } from '../engine/Props';
import { DENOMINATIONS } from '../config/constants';
import type { FurnitureDef } from '../config/furniture';
import { textCanvas } from '../products/LabelTexture';
import { block, mat } from './FurnitureModels';
import { plastic, powder, rblock, steel, wood } from './DisplayMaterials';
import { mergedModel } from './MergeStatic';

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

function counterSign(): THREE.Material {
  return mat('counterSign', () => {
    const t = textCanvas(512, 128, (c) => {
      c.fillStyle = '#1f2a30';
      c.fillRect(0, 0, 512, 128);
      c.fillStyle = '#2a9d8f';
      c.fillRect(0, 118, 512, 10);
      c.fillStyle = '#ffffff';
      c.font = '900 64px "Nunito", Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('MINI MART', 256, 60);
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
  });
}

const scanGlass = () => mat('scanGlass', () => new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.6 }));

/** Vỏ quầy tĩnh (gộp geometry, dùng chung giữa các quầy): thân ốp gỗ, mặt đá nhân tạo, viền inox, ray băng chuyền, máy quét. */
function counterShell(def: FurnitureDef): THREE.Group {
  const { w, d, h } = def.size;
  const g = new THREE.Group();
  const body = wood();
  const dark = powder(0x2b3238, 0.55);
  const top = plastic(0xe7e5e4, 0.22);
  const back = d / 2 - 0.25;
  g.add(rblock(dark, -w / 2 + 0.03, w / 2 - 0.03, 0, 0.08, -d / 2 + 0.04, back, 0.006));
  g.add(rblock(body, -w / 2, w / 2, 0.08, h - 0.04, -d / 2, back, 0.012));
  g.add(block(counterSign(), -0.4, 0.4, 0.3, 0.5, -d / 2 - 0.004, -d / 2 - 0.001, false));
  g.add(rblock(plastic(0x2a9d8f, 0.4), -w / 2 + 0.06, w / 2 - 0.06, 0.64, 0.7, -d / 2 - 0.008, -d / 2 + 0.01, 0.004, false));
  // phía thu ngân: 2 vách đầu + kệ dưới ngăn kéo
  for (const [a, b] of [[-w / 2, -w / 2 + 0.05], [w / 2 - 0.05, w / 2]]) g.add(rblock(body, a, b, 0, h - 0.04, back, d / 2, 0.008));
  g.add(rblock(dark, -w / 2 + 0.05, w / 2 - 0.05, 0.08, 0.1, back, d / 2 - 0.03, 0.004));
  // mặt quầy + nẹp inox mép phía khách
  g.add(rblock(top, -w / 2, w / 2, h - 0.04, h, -d / 2 - 0.012, d / 2, 0.01));
  g.add(rblock(steel(), -w / 2, w / 2, h - 0.052, h - 0.034, -d / 2 - 0.02, -d / 2 + 0.004, 0.004, false));
  // băng chuyền: ray 2 bên + nắp đầu
  const railMat = steel();
  g.add(rblock(railMat, -w / 2 + 0.06, 0.05, h, h + 0.05, -d / 2 + 0.02, -d / 2 + 0.05, 0.006, false));
  g.add(rblock(railMat, -w / 2 + 0.06, 0.05, h, h + 0.05, -d / 2 + 0.4, -d / 2 + 0.43, 0.006, false));
  g.add(rblock(dark, -w / 2 + 0.03, -w / 2 + 0.07, h, h + 0.035, -d / 2 + 0.03, -d / 2 + 0.42, 0.008, false));
  // máy quét: mặt kính nằm + tháp quét
  g.add(rblock(dark, 0.08, 0.38, h, h + 0.012, -d / 2 + 0.06, -d / 2 + 0.4, 0.006, false));
  g.add(block(scanGlass(), 0.12, 0.34, h + 0.012, h + 0.014, -d / 2 + 0.1, -d / 2 + 0.36, false));
  g.add(rblock(dark, 0.08, 0.38, h, h + 0.22, -d / 2 + 0.38, -d / 2 + 0.44, 0.02));
  g.add(block(scanGlass(), 0.12, 0.34, h + 0.05, h + 0.19, -d / 2 + 0.377, -d / 2 + 0.38, false));
  // khung treo túi
  for (const x of [0.53, 0.83]) g.add(rblock(railMat, x - 0.008, x + 0.008, h, h + 0.36, -d / 2 + 0.3, -d / 2 + 0.316, 0.004, false));
  g.add(rblock(railMat, 0.52, 0.84, h + 0.345, h + 0.36, -d / 2 + 0.3, -d / 2 + 0.316, 0.004, false));
  // máy quẹt thẻ phía khách + cột màn hình
  g.add(rblock(dark, 0.86, 0.96, h, h + 0.015, -d / 2 + 0.04, -d / 2 + 0.16, 0.005, false));
  g.add(rblock(plastic(0x15191d, 0.4), 0.875, 0.945, h + 0.015, h + 0.13, -d / 2 + 0.09, -d / 2 + 0.12, 0.008, false));
  g.add(rblock(dark, 0.905, 0.935, h, h + 0.3, 0.02, 0.05, 0.006));
  return g;
}

/** Quầy thu ngân: mặt trước (-Z) phía khách, phía sau (+Z) là thu ngân. */
export function buildCounter(def: FurnitureDef): CounterParts {
  const { w, d, h } = def.size;
  const g = new THREE.Group();
  g.add(mergedModel(`counter:${def.id}`, () => counterShell(def)));
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
  const lcdCanvas = document.createElement('canvas');
  lcdCanvas.width = 512;
  lcdCanvas.height = 256;
  const lcdTex = new THREE.CanvasTexture(lcdCanvas);
  lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex });
  const lcdGroup = new THREE.Group();
  lcdGroup.add(rblock(powder(0x111827, 0.4), -0.2, 0.2, -0.11, 0.11, -0.02, 0.02, 0.01));
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
  pos.add(rblock(powder(0x1f2937, 0.5), -0.07, 0.07, 0, 0.03, -0.11, 0.11, 0.008));
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
  // máy tính tiền (model Poly Haven) ở góc trái phía thu ngân, quay mặt về thu ngân
  const register = prop('cash_register');
  if (register) {
    register.scale.setScalar(0.85);
    register.position.set(-0.62, h, d / 2 - 0.2);
    register.rotation.y = Math.PI;
    g.add(register);
  }
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
