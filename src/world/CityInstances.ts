import * as THREE from 'three';
import { BUILDINGS, BUILDING_TEXTURES, isVnHouse, SCOOTER_FILTERS, VN_PASTELS } from '../config/city';
import { BIKE_MODELS } from '../config/fleet';
import { buildingAtlas, cityModel } from './CityModels';
import type { Placement } from './CityLayout';

const CHUNK = 70;
const tmp = new THREE.Matrix4();
const place = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const tint = new THREE.Color();

/** Vật liệu nhà theo biến thể màu (atlas) — dùng chung giữa mọi nhà cùng màu. */
const variantMats = new Map<string, THREE.Material>();

/**
 * Xe máy: texture gốc qua bộ lọc canvas (xoay tông màu) → nhiều màu xe từ 1 model.
 * Model gốc tự phát sáng bằng chính texture (emissiveMap, cường độ 1) → trông như không ăn đèn: hạ còn 0.15.
 */
export function scooterMaterial(base: THREE.Material, variant: number): THREE.Material {
  const filter = SCOOTER_FILTERS[variant % SCOOTER_FILTERS.length];
  const key = `scooter:${base.uuid}:${variant}`;
  let m = variantMats.get(key);
  if (m) return m;
  const mat = (base as THREE.MeshStandardMaterial).clone();
  mat.emissiveIntensity = 0.15;
  const src = mat.map;
  const img = src?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (filter !== 'none' && src && img?.width) {
    // xe đậu nhỏ trên màn hình: bản nhuộm màu chỉ cần ≤256px (nhuộm bằng filter canvas khá tốn)
    const k = Math.min(1, 256 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const g = c.getContext('2d')!;
    g.filter = filter;
    g.drawImage(img, 0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = src.flipY;
    tex.colorSpace = src.colorSpace;
    tex.wrapS = src.wrapS;
    tex.wrapT = src.wrapT;
    mat.map = tex;
    if (mat.emissiveMap) mat.emissiveMap = tex;
  }
  m = mat;
  variantMats.set(key, m);
  return m;
}

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

/** Nhóm mesh chỉ hiện trong khung giờ (hàng rong). */
export interface Scheduled {
  object: THREE.Object3D;
  hours: [number, number];
}

/**
 * Đặt mọi model thành phố bằng InstancedMesh: 1 InstancedMesh cho mỗi (model, biến thể màu, khung giờ, mesh con)
 * → vài chục draw call cho cả trăm ngôi nhà/cây. Trả về vật liệu đèn (bật sáng ban đêm) và các mesh theo giờ.
 */
export function buildCityInstances(placements: Placement[], group: THREE.Group): { lamps: THREE.MeshStandardMaterial[]; scheduled: Scheduled[] } {
  const lamps = new Set<THREE.MeshStandardMaterial>();
  const scheduled: Scheduled[] = [];
  const byKey = new Map<string, Placement[]>();
  for (const p of placements) {
    // chia theo ô CHUNK m để frustum culling loại được cả cụm ngoài tầm nhìn
    const chunk = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
    // nhà Việt: màu sơn nhuộm bằng instanceColor → mọi biến thể chung 1 InstancedMesh
    const byVariant = (p.kind === 'building' && !isVnHouse(p.model)) || p.model === 'vn_scooter';
    const key = `${byVariant ? `${p.model}|${p.variant}` : p.model}@${chunk}${p.hours ? `~${p.hours}` : ''}`;
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    const first = list[0];
    // xe máy đậu vỉa hè: mỗi biến thể là 1 kiểu xe cổ khác nhau (Vespa đỏ/trắng, Yamaha, Lambretta) × màu
    const scene = first.model === 'vn_scooter' ? (cityModel(BIKE_MODELS[first.variant % BIKE_MODELS.length].model) ?? cityModel('vn_scooter')) : cityModel(first.model);
    if (!scene) {
      for (const p of list) {
        const f = fallback(p);
        group.add(f);
        if (p.hours) scheduled.push({ object: f, hours: p.hours });
      }
      continue;
    }
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = mesh.material;
      const vnHouse = first.kind === 'building' && isVnHouse(first.model);
      if (first.kind === 'building' && !vnHouse) {
        material = Array.isArray(material) ? material.map((m) => buildingMaterial(m, first.variant)) : buildingMaterial(material, first.variant);
      } else if (first.model === 'vn_scooter') {
        material = Array.isArray(material) ? material.map((m) => scooterMaterial(m, first.variant)) : scooterMaterial(material, first.variant);
      }
      // đèn đường (Quaternius 'Light') và đèn âm trần nhà phố Việt (emissive mạnh) → sáng theo đêm
      for (const m of [material].flat()) {
        const sm = m as THREE.MeshStandardMaterial;
        if (m.name === 'Light' || (vnHouse && sm.emissiveIntensity >= 2)) lamps.add(sm);
      }
      const inst = new THREE.InstancedMesh(mesh.geometry, material, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        place.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, tmp.multiplyMatrices(place, mesh.matrixWorld));
        // tường (vật liệu gộp màu đỉnh) nhuộm màu sơn theo biến thể; kính & đèn giữ nguyên
        if (vnHouse && (material as THREE.Material).name === 'vn_house_base') inst.setColorAt(i, tint.setHex(VN_PASTELS[p.variant % VN_PASTELS.length]));
      });
      inst.receiveShadow = true;
      inst.castShadow = first.kind === 'car';
      inst.computeBoundingSphere();
      group.add(inst);
      if (first.hours) scheduled.push({ object: inst, hours: first.hours });
    });
  }
  return { lamps: [...lamps], scheduled };
}
