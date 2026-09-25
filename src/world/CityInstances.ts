import * as THREE from 'three';
import { BUILDINGS, BUILDING_TEXTURES } from '../config/city';
import { buildingAtlas, cityModel } from './CityModels';
import type { Placement } from './CityLayout';

const CHUNK = 70;
const tmp = new THREE.Matrix4();
const place = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);

/** Vật liệu nhà theo biến thể màu (atlas) — dùng chung giữa mọi nhà cùng màu. */
const variantMats = new Map<string, THREE.Material>();
function buildingMaterial(base: THREE.Material, variant: number): THREE.Material {
  const tex = buildingAtlas(BUILDING_TEXTURES[variant % BUILDING_TEXTURES.length]);
  const key = `${base.name}:${variant}:${!!tex}`;
  let m = variantMats.get(key);
  if (!m) {
    const c = (base as THREE.MeshStandardMaterial).clone();
    if (tex) {
      c.map = tex;
      c.color.set(0xffffff);
    }
    c.roughness = 0.85;
    m = c;
    variantMats.set(key, m);
  }
  return m;
}

/** Hình khối thay thế khi thiếu model (game vẫn chạy khi manifest rỗng). */
function fallback(p: Placement): THREE.Object3D {
  const g = new THREE.Group();
  const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  if (p.kind === 'building') {
    const [w, h, d] = BUILDINGS[p.model] ?? [6, 7, 6];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat([0xd9c7a7, 0xa3b8c8, 0xc98f7a, 0xb7c9a0][p.variant % 4]));
    b.position.y = h / 2;
    g.add(b);
  } else if (p.kind === 'tree') {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6), mat(0x6b4f3a));
    t.position.y = 1.2;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), mat(0x55803d));
    c.position.y = 3.4;
    g.add(t, c);
  } else if (p.kind === 'car') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 4.2), mat(0x8899aa));
    b.position.y = 0.7;
    g.add(b);
  } else {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), mat(0x3f4650));
    pole.position.y = 2.3;
    g.add(pole);
  }
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rot;
  return g;
}

/**
 * Đặt mọi model thành phố bằng InstancedMesh: 1 InstancedMesh cho mỗi (model, biến thể màu, mesh con)
 * → vài chục draw call cho cả trăm ngôi nhà/cây. Trả về vật liệu đèn (bật sáng ban đêm).
 */
export function buildCityInstances(placements: Placement[], group: THREE.Group): THREE.MeshStandardMaterial[] {
  const lamps = new Set<THREE.MeshStandardMaterial>();
  const byKey = new Map<string, Placement[]>();
  for (const p of placements) {
    // chia theo ô CHUNK m để frustum culling loại được cả cụm ngoài tầm nhìn
    const chunk = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    const key = `${p.kind === 'building' ? `${p.model}|${p.variant}` : p.model}@${chunk}`;
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    const first = list[0];
    const scene = cityModel(first.model);
    if (!scene) {
      for (const p of list) group.add(fallback(p));
      continue;
    }
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = mesh.material;
      if (first.kind === 'building') {
        material = Array.isArray(material) ? material.map((m) => buildingMaterial(m, first.variant)) : buildingMaterial(material, first.variant);
      }
      for (const m of [material].flat()) if (m.name === 'Light') lamps.add(m as THREE.MeshStandardMaterial);
      const inst = new THREE.InstancedMesh(mesh.geometry, material, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        place.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, tmp.multiplyMatrices(place, mesh.matrixWorld));
      });
      inst.receiveShadow = true;
      inst.castShadow = first.kind === 'car';
      inst.computeBoundingSphere();
      group.add(inst);
    });
  }
  return [...lamps];
}
