import { formatVnd } from '../core/Random';
import * as THREE from 'three';
import { prop } from '../engine/Props';
import { DENOMINATIONS } from '../config/constants';
import type { FurnitureDef } from '../config/furniture';
import { textCanvas } from '../products/LabelTexture';
import { block, mat } from './FurnitureModels';
import { plastic, powder, rblock, steel, wood } from './DisplayMaterials';
import { mergedModel } from './MergeStatic';
import { moneyStack } from './MoneyModels';
import { counterProps } from '../world/InteriorDecor';

export interface CounterParts {
  group: THREE.Group;
  beltTex: THREE.Texture;
  laser: THREE.Mesh;
  /** Tờ hoá đơn viết tay đặt trên quầy (vẽ lại mỗi khi quét món / đổi tiền) */
  receipt: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  drawer: THREE.Group;
  trays: THREE.Mesh[];
  /** Điểm cục bộ quan trọng trên mặt quầy */
  beltStart: THREE.Vector3;
  beltEnd: THREE.Vector3;
  scanPoint: THREE.Vector3;
  bagPoint: THREE.Vector3;
  paidPoint: THREE.Vector3;
  changePoint: THREE.Vector3;
  cashierView: THREE.Vector3;
  cashierLook: THREE.Vector3;
}

const std = (key: string, color: number, r = 0.5, m = 0) => mat(key, () => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m }));

function denomLabel(d: number): string {
  return `${formatVnd(d)}đ`;
}

function counterSign(): THREE.Material {
  return mat('counterSign', () => {
    const t = textCanvas(512, 128, (c) => {
      c.fillStyle = '#1d4a3f';
      c.fillRect(0, 0, 512, 128);
      c.fillStyle = '#b8402d';
      c.fillRect(0, 118, 512, 10);
      c.fillStyle = '#f6d57a';
      c.font = '400 52px "Alfa Slab One", "Nunito", Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TẠP HOÁ ĐẦU HẺM', 256, 60, 488);
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
  const top = plastic(0xd9d2b8, 0.45);
  const back = d / 2 - 0.25;
  g.add(rblock(dark, -w / 2 + 0.03, w / 2 - 0.03, 0, 0.08, -d / 2 + 0.04, back, 0.006));
  g.add(rblock(body, -w / 2, w / 2, 0.08, h - 0.04, -d / 2, back, 0.012));
  g.add(block(counterSign(), -0.4, 0.4, 0.3, 0.5, -d / 2 - 0.004, -d / 2 - 0.001, false));
  g.add(rblock(plastic(0x8a3a2a, 0.5), -w / 2 + 0.06, w / 2 - 0.06, 0.64, 0.7, -d / 2 - 0.008, -d / 2 + 0.01, 0.004, false));
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
  return g;
}

/** Quầy thu ngân: mặt trước (-Z) phía khách, phía sau (+Z) là thu ngân. */
export function buildCounter(def: FurnitureDef): CounterParts {
  const { w, d, h } = def.size;
  const g = new THREE.Group();
  g.add(mergedModel(`counter:${def.id}`, () => counterShell(def)));
  g.add(counterProps(w, d, h));
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
  // hoá đơn viết tay: tờ giấy đặt trên cuốn sổ nhỏ, ngay trước mặt thu ngân
  const receiptCanvas = document.createElement('canvas');
  receiptCanvas.width = 512;
  receiptCanvas.height = 640;
  const receiptTex = new THREE.CanvasTexture(receiptCanvas);
  receiptTex.colorSpace = THREE.SRGBColorSpace;
  receiptTex.anisotropy = 8;
  const pad = new THREE.Group();
  pad.add(rblock(powder(0x6b4a2a, 0.8), -0.15, 0.15, 0, 0.012, -0.18, 0.18, 0.004));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.34), new THREE.MeshStandardMaterial({ map: receiptTex, roughness: 0.95 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 0.0135;
  sheet.receiveShadow = true;
  pad.add(sheet);
  pad.position.set(0.0, h, 0.2);
  pad.rotation.y = 0.07;
  g.add(pad);
  // khay tiền giấy đặt trên mặt quầy, bên phải thu ngân: hàng xa là tờ lớn, hàng gần (sát tay) là tờ nhỏ hay dùng
  const drawer = new THREE.Group();
  const trayMat = std('tray', 0x3a2a1c, 0.7);
  drawer.add(block(trayMat, 0, 0.475, 0, 0.018, 0, 0.39));
  const trays: THREE.Mesh[] = [];
  const rows: number[][] = [DENOMINATIONS.slice(0, 5), DENOMINATIONS.slice(5)];
  rows.forEach((row, r) => {
    row.forEach((den, i) => {
      // nhãn mệnh giá ở mép gần người thu ngân (+Z); phần còn lại của khay là xấp tiền
      const tex = textCanvas(128, 64, (c) => {
        c.fillStyle = '#3a2a1c';
        c.fillRect(0, 0, 128, 64);
        c.fillStyle = '#d9c9a0';
        c.fillRect(0, 44, 128, 20);
        c.fillStyle = '#3b2616';
        c.font = '900 20px "Nunito", Arial';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(denomLabel(den), 64, 55, 120);
      });
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.012, 0.185), [
        trayMat, trayMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), trayMat, trayMat, trayMat,
      ]);
      const x = 0.044 + i * 0.0875 + (r === 1 ? 0.0875 / 2 : 0);
      const z = r === 0 ? 0.1 : 0.292;
      t.position.set(x, 0.024, z);
      t.userData = { kind: 'tray', denom: den };
      drawer.add(t);
      const stack = moneyStack(den);
      stack.position.set(x, 0.03, z - 0.02);
      drawer.add(stack);
      trays.push(t);
    });
  });
  drawer.position.set(0.51, h, 0.005);
  g.add(drawer);
  // máy tính tiền (model Poly Haven) ở góc trái phía thu ngân, quay mặt về thu ngân
  const register = prop('cash_register');
  if (register) {
    register.scale.setScalar(0.85);
    register.position.set(-0.62, h, d / 2 - 0.2);
    register.rotation.y = Math.PI;
    g.add(register);
  }
  return {
    group: g, beltTex, laser, receipt: { canvas: receiptCanvas, tex: receiptTex }, drawer, trays,
    beltStart: new THREE.Vector3(-w / 2 + 0.15, h + 0.02, -d / 2 + 0.22),
    beltEnd: new THREE.Vector3(-0.05, h + 0.02, -d / 2 + 0.22),
    scanPoint: new THREE.Vector3(0.23, h + 0.08, -d / 2 + 0.23),
    bagPoint: new THREE.Vector3(0.68, h + 0.05, -d / 2 + 0.22),
    paidPoint: new THREE.Vector3(0.45, h + 0.005, -d / 2 + 0.1),
    changePoint: new THREE.Vector3(0.3, h + 0.005, 0.1),
    // góc nhìn từ trên cao, lùi ra sau: thấy cả băng chuyền, hoá đơn lẫn khay tiền ở nửa dưới màn hình
    cashierView: new THREE.Vector3(0.1, h + 1.05, d / 2 + 0.75),
    cashierLook: new THREE.Vector3(0.1, h - 0.1, -d / 2 + 0.4),
  };
}
