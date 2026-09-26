import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { textCanvas } from '../products/LabelTexture';
import { findWheels, wheel } from './VehicleModels';
import { prop } from '../engine/Props';

/** Xe tải thùng giao hàng: gốc giữa đáy, đầu xe hướng -Z (như xe người chơi). */
export interface TruckModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  wheelRadius: number;
  /** Cửa cuốn sau (kéo lên khi dỡ hàng) */
  door: THREE.Object3D;
  /** Điểm thùng bay ra (local, sau đuôi xe) */
  rear: THREE.Vector3;
  lights: THREE.MeshStandardMaterial;
}

export const TRUCK_LEN = 5.4;

const std = (color: number, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function sideArt(): THREE.Texture {
  return textCanvas(1024, 384, (g) => {
    g.fillStyle = '#f7f7f2';
    g.fillRect(0, 0, 1024, 384);
    g.fillStyle = '#1f7a6d';
    g.fillRect(0, 280, 1024, 104);
    g.fillStyle = '#ffd166';
    g.fillRect(0, 268, 1024, 14);
    g.fillStyle = '#1f7a6d';
    g.font = '900 120px "Nunito", Arial';
    g.textBaseline = 'middle';
    g.fillText('MINI MART', 60, 130);
    g.font = '800 46px "Nunito", Arial';
    g.fillStyle = '#e76f51';
    g.fillText('Giao hàng tận cửa hàng 🚚', 64, 220);
    g.fillStyle = '#fff';
    g.font = '800 40px "Nunito", Arial';
    g.fillText('☎ 1900 24 24   ·   minimart.vn', 64, 332);
  });
}

function box(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Xe tải Quaternius (GLB): không có cửa cuốn → cửa giả để logic dỡ hàng không đổi. */
function glbTruck(): TruckModel | null {
  const m = prop('truck');
  if (!m) return null;
  const g = new THREE.Group();
  g.add(m);
  const wheels = findWheels(m);
  const r = wheels.length ? new THREE.Box3().setFromObject(wheels[0]).getSize(new THREE.Vector3()).y / 2 : 0.45;
  const lights = new THREE.MeshStandardMaterial();
  return { group: g, wheels, wheelRadius: r, door: new THREE.Object3D(), rear: new THREE.Vector3(0, 1.2, TRUCK_LEN / 2 + 0.4), lights };
}

export function buildTruck(): TruckModel {
  const glb = glbTruck();
  if (glb) return glb;
  const g = new THREE.Group();
  const W = 2.25;
  const cabColor = std(0x2a9d8f, 0.35, 0.3);
  const dark = std(0x22262b, 0.6, 0.3);
  const chrome = std(0xcfd4da, 0.2, 0.9);
  const glass = std(0x1c2630, 0.05, 0.6);
  const art = new THREE.MeshStandardMaterial({ map: sideArt(), roughness: 0.55 });
  const white = std(0xf2f2ee, 0.5);
  // khung gầm + cản
  g.add(box(new THREE.BoxGeometry(W - 0.3, 0.25, TRUCK_LEN - 0.3), dark, 0, 0.55, 0));
  g.add(box(new RoundedBoxGeometry(W + 0.05, 0.22, 0.2, 2, 0.05), dark, 0, 0.5, -TRUCK_LEN / 2 + 0.05));
  // cabin phía trước (-Z)
  const cabZ = -TRUCK_LEN / 2 + 0.95;
  g.add(box(new RoundedBoxGeometry(W, 1.55, 1.8, 3, 0.12), cabColor, 0, 1.4, cabZ));
  g.add(box(new THREE.BoxGeometry(W - 0.2, 0.7, 0.05), glass, 0, 1.75, cabZ - 0.9));
  for (const sx of [-1, 1]) {
    g.add(box(new THREE.BoxGeometry(0.05, 0.55, 0.9), glass, sx * (W / 2 + 0.005), 1.75, cabZ - 0.2));
    g.add(box(new THREE.BoxGeometry(0.06, 0.25, 0.14), chrome, sx * (W / 2 + 0.12), 1.8, cabZ - 0.75));
  }
  const lights = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff3c4, emissiveIntensity: 0.2 });
  for (const sx of [-0.8, 0.8]) g.add(box(new THREE.BoxGeometry(0.32, 0.16, 0.04), lights, sx, 0.95, cabZ - 0.91));
  g.add(box(new THREE.BoxGeometry(1.1, 0.3, 0.04), chrome, 0, 0.95, cabZ - 0.91));
  // thùng hàng
  const boxLen = TRUCK_LEN - 2.05;
  const boxZ = TRUCK_LEN / 2 - boxLen / 2;
  const boxH = 2.3;
  const shell = box(new THREE.BoxGeometry(W + 0.1, boxH, boxLen), [art, art, white, white, white, white], 0, 0.7 + boxH / 2, boxZ);
  g.add(shell);
  // mặt sau: khung + cửa cuốn
  const rearZ = TRUCK_LEN / 2 + 0.01;
  const door = new THREE.Group();
  const slats = textCanvas(256, 256, (c) => {
    c.fillStyle = '#d9d9d4';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#b5b5ae';
    for (let y = 0; y < 256; y += 16) c.fillRect(0, y, 256, 3);
  });
  const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, boxH - 0.2), new THREE.MeshStandardMaterial({ map: slats, roughness: 0.6, metalness: 0.3 }));
  doorMesh.position.y = (boxH - 0.2) / 2;
  door.add(doorMesh);
  door.position.set(0, 0.8, rearZ);
  g.add(door);
  g.add(box(new THREE.BoxGeometry(W + 0.12, 0.12, 0.3), dark, 0, 0.62, rearZ - 0.1));
  const tail = new THREE.MeshStandardMaterial({ color: 0xc1121f, emissive: 0xc1121f, emissiveIntensity: 0.6 });
  for (const sx of [-1, 1]) g.add(box(new THREE.BoxGeometry(0.14, 0.24, 0.04), tail, sx * (W / 2 - 0.05), 0.95, rearZ + 0.01));
  // bánh: 1 trục trước, 1 trục sau bánh đôi
  const wheels: THREE.Object3D[] = [];
  const r = 0.48;
  for (const [z, dual] of [[cabZ + 0.1, false], [TRUCK_LEN / 2 - 1.2, true]] as const) {
    for (const sx of [-1, 1]) {
      const wh = wheel(r, dual ? 0.5 : 0.32);
      wh.position.set(sx * (W / 2 - 0.1), r, z);
      g.add(wh);
      wheels.push(wh);
    }
  }
  return { group: g, wheels, wheelRadius: r, door, rear: new THREE.Vector3(0, 1.2, TRUCK_LEN / 2 + 0.4), lights };
}
