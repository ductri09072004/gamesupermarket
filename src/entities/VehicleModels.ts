import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { VehicleType } from '../config/vehicles';
import { BOX_D, BOX_H, BOX_W } from './Box';
import { cityModel } from '../world/CityModels';

/** Model xe: gốc giữa đáy, mặt trước -Z. wheels quay theo quãng đường; slots: vị trí đặt thùng hàng (local). */
export interface VehicleModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  wheelRadius: number;
  slots: THREE.Vector3[];
  /** Phần thân nghiêng khi vào cua (xe máy) */
  lean: THREE.Object3D | null;
  headlights: THREE.MeshStandardMaterial[];
}

const std = (color: number, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.05, metalness: 0.6 });

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/** Bánh xe: lốp (xuyến) + mâm nan hoa; trục quay X. */
export function wheel(r: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const tire = mesh(new THREE.CylinderGeometry(r, r, w, 22).rotateZ(Math.PI / 2), std(0x151515, 0.85));
  const rim = mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.04, 16).rotateZ(Math.PI / 2), std(0xc8ccd2, 0.25, 0.9));
  const hub = mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, w * 1.1, 8).rotateZ(Math.PI / 2), std(0x55585e, 0.3, 0.8));
  g.add(tire, rim, hub);
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.BoxGeometry(w * 1.06, r * 0.1, r * 1.1), std(0x9aa0a8, 0.3, 0.9));
    s.rotation.x = (i / 5) * Math.PI;
    g.add(s);
  }
  return g;
}

function slotGrid(cols: number, rows: number, layers: number, x0: number, y0: number, z0: number, gapX = 0.02, gapZ = 0.02): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) out.push(new THREE.Vector3(x0 + c * (BOX_W + gapX), y0 + l * BOX_H, z0 + r * (BOX_D + gapZ)));
    }
  }
  return out;
}

function moto(): VehicleModel {
  const g = new THREE.Group();
  const lean = new THREE.Group();
  g.add(lean);
  const body = std(0xc0392b, 0.35, 0.3);
  const dark = std(0x1f2327, 0.5, 0.4);
  const chrome = std(0xd0d4da, 0.2, 0.95);
  const r = 0.3;
  const front = wheel(r, 0.1);
  front.position.set(0, r, -0.66);
  const rear = wheel(r, 0.12);
  rear.position.set(0, r, 0.64);
  lean.add(front, rear);
  // thân xe tay ga: sàn để chân, yếm trước, cốp dưới yên
  lean.add(mesh(new RoundedBoxGeometry(0.34, 0.12, 0.62, 2, 0.04), dark, 0, 0.36, -0.02));
  lean.add(mesh(new RoundedBoxGeometry(0.38, 0.62, 0.22, 3, 0.08), body, 0, 0.66, -0.46));
  lean.add(mesh(new RoundedBoxGeometry(0.4, 0.34, 0.66, 3, 0.1), body, 0, 0.58, 0.36));
  lean.add(mesh(new RoundedBoxGeometry(0.3, 0.1, 0.56, 2, 0.04), std(0x222222, 0.8), 0, 0.8, 0.3));
  lean.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8).rotateX(0.35), chrome, 0, 0.72, -0.6));
  lean.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8).rotateZ(Math.PI / 2), dark, 0, 1.02, -0.5));
  lean.add(mesh(new RoundedBoxGeometry(0.26, 0.14, 0.12, 2, 0.04), body, 0, 1.0, -0.58));
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0.2 });
  lean.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14).rotateX(Math.PI / 2), lampMat, 0, 0.98, -0.65));
  lean.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8).rotateX(Math.PI / 2), chrome, 0.16, 0.3, 0.55));
  // baga sau chở thùng
  lean.add(mesh(new THREE.BoxGeometry(0.44, 0.03, 0.42), chrome, 0, 0.86, 0.74));
  const slots = slotGrid(1, 1, 2, 0, 0.875, 0.74);
  return { group: g, wheels: [front, rear], wheelRadius: r, slots, lean, headlights: [lampMat] };
}

function pickup(): VehicleModel {
  const g = new THREE.Group();
  const paint = std(0x2f5d8a, 0.35, 0.45);
  const dark = std(0x1d2024, 0.6, 0.2);
  const chrome = std(0xcfd3d8, 0.2, 0.95);
  const r = 0.42;
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.86, -1.62], [0.86, -1.62], [-0.86, 1.62], [0.86, 1.62]]) {
    const w = wheel(r, 0.28);
    w.position.set(x, r, z);
    wheels.push(w);
    g.add(w);
  }
  // khung gầm + cabin + nắp capo + thùng sau
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.25, 5.0), dark, 0, 0.55, 0));
  g.add(mesh(new RoundedBoxGeometry(1.95, 0.55, 1.6, 3, 0.1), paint, 0, 0.95, -1.75));
  g.add(mesh(new RoundedBoxGeometry(1.92, 0.95, 1.9, 3, 0.14), paint, 0, 1.3, -0.25));
  g.add(mesh(new RoundedBoxGeometry(1.8, 0.5, 1.4, 2, 0.08), glass(), 0, 1.55, -0.3));
  g.add(mesh(new THREE.BoxGeometry(1.95, 0.12, 2.25), paint, 0, 0.74, 1.4));
  for (const x of [-0.93, 0.93]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 2.25), paint, x, 1.0, 1.4));
  g.add(mesh(new THREE.BoxGeometry(1.95, 0.5, 0.1), paint, 0, 1.0, 2.48));
  g.add(mesh(new THREE.BoxGeometry(1.95, 0.5, 0.08), paint, 0, 1.0, 0.32));
  for (const z of [-2.55, 2.58]) g.add(mesh(new RoundedBoxGeometry(2.0, 0.22, 0.14, 2, 0.05), chrome, 0, 0.62, z));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 0.05), dark, 0, 0.98, -2.56));
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff1c4, emissiveIntensity: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xb3261e, emissive: 0x7a0f0a, emissiveIntensity: 0.4 });
  for (const x of [-0.72, 0.72]) {
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.14, 0.05), lampMat, x, 1.02, -2.56));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.05), tail, x * 1.24, 1.05, 2.53));
    for (const z of [-1.62, 1.62]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 1.05), dark, x * 1.3, 0.92, z));
  }
  const slots = slotGrid(3, 5, 2, -BOX_W - 0.03, 0.8, 0.52, 0.03, 0.04);
  return { group: g, wheels, wheelRadius: r, slots, lean: null, headlights: [lampMat] };
}

function car(): VehicleModel {
  const src = cityModel('NormalCar1');
  const g = new THREE.Group();
  const headlights: THREE.MeshStandardMaterial[] = [];
  if (src) {
    const c = src.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.name === 'Blue') mat.color.set(0xd9d4c7);
      if (mat.name === 'Headlights') headlights.push(mat);
      m.material = mat;
    });
    g.add(c);
  } else {
    g.add(mesh(new RoundedBoxGeometry(1.8, 0.7, 4.2, 3, 0.2), std(0xd9d4c7, 0.35, 0.4), 0, 0.6, 0));
    g.add(mesh(new RoundedBoxGeometry(1.6, 0.5, 2.1, 3, 0.18), glass(), 0, 1.05, 0.2));
  }
  // hàng ở ghế sau & cốp: 2×2×2 thùng (nhìn thấy qua kính)
  const slots = slotGrid(2, 2, 2, -BOX_W / 2 - 0.02, 0.45, 0.35, 0.04, 0.05);
  return { group: g, wheels: [], wheelRadius: 0.33, slots, lean: null, headlights };
}

/** Nút bánh xe ngoài cùng trong GLB (mesh nhiều vật liệu có nhóm cha cùng tên — chỉ quay nhóm cha). */
export function findWheels(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if (/wheel/i.test(o.name)) { out.push(o); return; }
    o.children.forEach(visit);
  };
  visit(root);
  return out;
}

export function buildVehicleModel(type: VehicleType): VehicleModel {
  const custom = cityModel(`vehicle_${type}`);
  if (custom) {
    const g = new THREE.Group();
    const body = custom.clone(true);
    g.add(body);
    const base = type === 'moto' ? moto() : type === 'pickup' ? pickup() : car();
    // bánh xe trong GLB đã có pivot riêng (tâm bánh) → quay được quanh trục X
    const wheels = findWheels(body);
    const r = wheels.length ? new THREE.Box3().setFromObject(wheels[0]).getSize(new THREE.Vector3()).y / 2 : base.wheelRadius;
    body.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return { ...base, group: g, wheels, wheelRadius: r, lean: null };
  }
  return type === 'moto' ? moto() : type === 'pickup' ? pickup() : car();
}
