import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Người lái xe máy dựng từ khối đơn giản, gộp thành 1 geometry (màu đỉnh) → mỗi xe máy chỉ thêm 1 draw call. Trục: -Z là phía trước xe. */
export const SHIRTS = [0xe4572e, 0x2e86ab, 0xf3a712, 0x59a14f, 0x9b5de5, 0xf4f1de, 0x3d405b, 0xe76f51];
/** Áo mưa mỏng nhiều màu (bộ áo hoặc áo choàng) */
export const PONCHOS = [0x2f80ed, 0xf2c94c, 0xeb5757, 0x27ae60, 0xbb6bd9, 0xf2994a, 0x56ccf2];
const HELMETS = [0xf5f5f5, 0x222222, 0xc0392b, 0x2a6fdb, 0xe8b923, 0x7b5a3a];
const SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642];
const PANTS = [0x2b2d42, 0x3d405b, 0x264653, 0x1d3557];

function colored(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g.toNonIndexed() : g;
}

function limb(from: THREE.Vector3, to: THREE.Vector3, r: number, hex: number): THREE.BufferGeometry {
  const len = from.distanceTo(to);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return colored(g, hex);
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 1 người ngồi trên yên: z = vị trí dọc xe (âm = về phía trước). */
function person(z: number, hex: number, seed: number, poncho: boolean, driver: boolean): THREE.BufferGeometry[] {
  const skin = SKINS[seed % SKINS.length];
  const parts: THREE.BufferGeometry[] = [];
  const torso = new THREE.CapsuleGeometry(poncho ? 0.2 : 0.16, 0.3, 3, 8).translate(0, 0.96, 0);
  torso.rotateX(-0.15);
  parts.push(colored(torso.translate(0, 0, z), hex));
  parts.push(colored(new THREE.SphereGeometry(0.1, 10, 8).translate(0, 1.36, z - 0.03), skin));
  const helmet = new THREE.SphereGeometry(0.118, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.58).translate(0, 1.4, z - 0.03);
  parts.push(colored(helmet, HELMETS[(seed >> 2) % HELMETS.length]));
  for (const s of [-1, 1]) {
    // tay: vai → tay lái (lái) hoặc ôm người trước (ngồi sau)
    parts.push(limb(V(s * 0.19, 1.13, z), driver ? V(s * 0.27, 0.92, z - 0.42) : V(s * 0.15, 1.0, z - 0.3), 0.04, poncho ? hex : skin));
    // chân: hông → bàn đạp
    parts.push(limb(V(s * 0.13, 0.82, z + 0.05), V(s * 0.17, 0.33, z - 0.3), 0.055, PANTS[(seed >> 1) % PANTS.length]));
  }
  if (poncho) {
    // áo mưa rủ xuống che lưng & đùi
    const cape = new THREE.ConeGeometry(0.33, 0.62, 10, 1, true).translate(0, 0.62, z + 0.1);
    parts.push(colored(cape, hex));
  }
  return parts;
}

const cache = new Map<string, THREE.BufferGeometry>();
export const riderMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });

/** Người lái (+ người ngồi sau) — cache theo kiểu; nhìn từ phía trước = -Z. */
export function riderGeometry(seed: number, pillion: boolean, poncho: boolean): THREE.BufferGeometry {
  const key = `${seed}:${pillion}:${poncho}`;
  let g = cache.get(key);
  if (g) return g;
  const hex = poncho ? PONCHOS[seed % PONCHOS.length] : SHIRTS[seed % SHIRTS.length];
  const parts = person(-0.05, hex, seed, poncho, true);
  if (pillion) parts.push(...person(0.34, poncho ? PONCHOS[(seed + 3) % PONCHOS.length] : SHIRTS[(seed + 3) % SHIRTS.length], seed + 5, poncho, false));
  g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  cache.set(key, g);
  return g;
}
