import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { textCanvas } from '../products/LabelTexture';
import { cyl, plastic, powder, rblock, steel } from './DisplayMaterials';
import { block, mat } from './FurnitureModels';
import { mergedModel } from './MergeStatic';

/** Máy tự tính tiền: mặt trước (-Z) phía khách. Trái: kệ để giỏ; giữa: máy quét; phải: khu đóng túi. */
export interface KioskParts {
  group: THREE.Group;
  screen: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  /** Đèn gọi nhân viên trên cột (màu/nhấp nháy theo trạng thái) */
  light: THREE.MeshStandardMaterial;
  scanPoint: THREE.Vector3;
  bagPoint: THREE.Vector3;
}

const BODY = 0x2f3e46;

function brandSign(): THREE.Material {
  return mat('kioskSign', () => {
    const t = textCanvas(256, 128, (c) => {
      c.fillStyle = '#2a9d8f';
      c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 30px "Nunito", Arial';
      c.fillText('TỰ THANH TOÁN', 128, 48);
      c.font = '700 20px "Nunito", Arial';
      c.fillText('Self checkout', 128, 88);
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
  });
}

const scanGlass = () => mat('kioskScanGlass', () => new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.04, metalness: 0.5 }));

/** Phần tĩnh (gộp 1 lần, dùng chung giữa các máy). */
function shell(): THREE.Group {
  const g = new THREE.Group();
  const body = powder(BODY, 0.45);
  const dark = powder(0x1f272c, 0.55);
  const top = plastic(0xd9dde2, 0.3);
  // đế + tủ máy quét giữa
  g.add(rblock(dark, -0.46, 0.48, 0, 0.06, -0.3, 0.36, 0.01));
  g.add(rblock(body, -0.2, 0.22, 0.06, 0.88, -0.32, 0.38, 0.02));
  g.add(block(brandSign(), -0.17, 0.19, 0.46, 0.62, -0.327, -0.321, false));
  // khe nhận tiền mặt + khay trả tiền thừa
  g.add(rblock(dark, -0.12, 0.14, 0.68, 0.8, -0.335, -0.32, 0.006, false));
  g.add(block(steel(), -0.06, 0.08, 0.755, 0.762, -0.337, -0.334, false));
  g.add(rblock(steel(), -0.06, 0.08, 0.3, 0.36, -0.34, -0.3, 0.01, false));
  // mặt máy quét + kính quét + tháp quét dọc
  g.add(rblock(top, -0.2, 0.22, 0.88, 0.9, -0.32, 0.38, 0.008));
  g.add(block(scanGlass(), -0.1, 0.12, 0.9, 0.903, -0.2, 0.04, false));
  g.add(rblock(body, -0.12, 0.14, 0.9, 1.1, 0.06, 0.15, 0.015));
  g.add(block(scanGlass(), -0.09, 0.11, 0.93, 1.07, 0.057, 0.06, false));
  // kệ để giỏ bên trái
  g.add(rblock(steel(), -0.5, -0.2, 0.7, 0.72, -0.28, 0.3, 0.006));
  g.add(rblock(dark, -0.36, -0.3, 0.06, 0.7, -0.05, 0.05, 0.01));
  // khu đóng túi bên phải + khung treo túi
  g.add(rblock(body, 0.22, 0.5, 0.06, 0.78, -0.26, 0.32, 0.015));
  g.add(rblock(top, 0.22, 0.5, 0.78, 0.8, -0.3, 0.34, 0.008));
  for (const z of [-0.27, 0.25]) {
    for (const x of [0.25, 0.47]) g.add(rblock(steel(), x - 0.008, x + 0.008, 0.8, 1.14, z - 0.008, z + 0.008, 0.004, false));
    g.add(rblock(steel(), 0.242, 0.478, 1.13, 1.146, z - 0.008, z + 0.008, 0.004, false));
  }
  // cột màn hình + máy quẹt thẻ
  g.add(rblock(dark, -0.03, 0.05, 0.9, 1.22, 0.24, 0.3, 0.01));
  g.add(rblock(dark, 0.16, 0.22, 0.9, 1.0, 0.16, 0.24, 0.01));
  g.add(rblock(plastic(0x111418, 0.4), 0.15, 0.23, 1.0, 1.12, 0.17, 0.2, 0.008, false));
  // cột đèn gọi nhân viên
  g.add(cyl(steel(), 0.012, 0.9, 1.72, -0.16, 0.3));
  return g;
}

export function buildSelfCheckout(def: FurnitureDef): KioskParts {
  const g = new THREE.Group();
  g.add(mergedModel(`kiosk:${def.id}`, shell));
  // màn hình cảm ứng nghiêng về phía khách (mỗi máy 1 canvas riêng)
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Group();
  head.add(rblock(powder(0x1f272c, 0.55), -0.2, 0.2, -0.145, 0.145, -0.02, 0.02, 0.012));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.25), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = -0.021;
  screen.rotation.y = Math.PI;
  head.add(screen);
  head.position.set(0.01, 1.3, 0.24);
  head.rotation.x = 0.3;
  g.add(head);
  // đèn gọi nhân viên
  const light = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.6, roughness: 0.3 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 16), light);
  lamp.position.set(-0.16, 1.755, 0.3);
  g.add(lamp);
  g.add(cyl(powder(0x1f272c, 0.55), 0.038, 1.79, 1.8, -0.16, 0.3, 16));
  return {
    group: g, screen: { canvas, tex }, light,
    scanPoint: new THREE.Vector3(0.01, 0.97, -0.08),
    bagPoint: new THREE.Vector3(0.36, 0.86, 0.02),
  };
}
