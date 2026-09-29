import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { normalizeModel } from '../engine/Assets';
import { prop } from '../engine/Props';
import { coolerGlass, plastic, steel } from './DisplayMaterials';
import { block } from './FurnitureModels';

/** Hộp cắt (toạ độ nội thất: gốc giữa đáy, mặt trước -Z): phần model nằm trong hộp bị "khoét" bằng shader để nhìn vào trong tủ. */
interface Hole {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/** Khoét lỗ theo hộp trong không gian cục bộ của từng mesh (shader discard) — vật liệu clone riêng cho từng mesh. */
function carve(root: THREE.Object3D, hole: Hole, tint: number): void {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const box = new THREE.Box3(hole.min.clone(), hole.max.clone()).applyMatrix4(inv);
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.color.multiply(new THREE.Color(tint)); // ố bẩn theo năm tháng
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHoleMin = { value: box.min };
      sh.uniforms.uHoleMax = { value: box.max };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHolePos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHolePos = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHolePos;\nuniform vec3 uHoleMin;\nuniform vec3 uHoleMax;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (all(greaterThan(vHolePos, uHoleMin)) && all(lessThan(vHolePos, uHoleMax))) discard;');
    };
    mat.customProgramCacheKey = () => 'carve';
    mesh.material = mat;
  });
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Tủ mát Coca đời cũ (model Sketchfab): cửa đỏ nguyên tấm được khoét 1 ô kính để thấy hàng bên trong,
 * lòng tủ trắng có 3 thanh đỡ + đèn LED dựng bằng code cho khớp các tầng (geom 'coke').
 */
function cokeFridge(def: FurnitureDef, model: THREE.Group): THREE.Group {
  const { d } = def.size;
  const g = normalizeModel(model, def.size);
  const x = 0.4;
  const y0 = 0.27;
  const y1 = 1.31;
  carve(g, { min: V(-x, y0, -d), max: V(x, y1, -d / 2 + 0.13) }, 0xd6cdbf);
  const liner = plastic(0xe9eef2, 0.55);
  const zf = -d / 2 + 0.005;
  const zb = d / 2 - 0.16;
  g.add(block(liner, -x, x, y0, y1, zb, zb + 0.02, false));
  for (const s of [-1, 1]) g.add(block(liner, s < 0 ? -x - 0.02 : x, s < 0 ? -x : x + 0.02, y0, y1, zf, zb, false));
  g.add(block(liner, -x, x, y1, y1 + 0.02, zf, zb, false));
  g.add(block(liner, -x, x, y0 - 0.02, y0, zf, zb, false));
  // thanh đỡ dây inox mỗi tầng
  for (let i = 0; i < def.tiers; i++) {
    const y = 0.3 + i * 0.34 - 0.012;
    g.add(block(steel(), -x, x, y, y + 0.012, zf, zb, false));
  }
  g.add(block(new THREE.MeshBasicMaterial({ color: 0xfff2d0 }), -x + 0.05, x - 0.05, y1 - 0.005, y1, zf + 0.05, zf + 0.09, false));
  // kính che mặt trước ô khoét
  g.add(block(coolerGlass(), -x, x, y0, y1, zf - 0.03, zf - 0.024, false));
  return g;
}

/** Tủ đông nằm (model Sketchfab): khoét nắp trên, lòng tủ + đáy nâng lên 0.45m (geom 'chest') và tấm kính lùa để thấy hàng. */
function chestFreezer(def: FurnitureDef, model: THREE.Group): THREE.Group {
  const { w, d, h } = def.size;
  const g = normalizeModel(model, def.size);
  const hx = w / 2 - 0.1;
  const hz = d / 2 - 0.06;
  carve(g, { min: V(-hx, h - 0.16, -hz), max: V(hx, h + 0.1, hz) }, 0xe0d4b4);
  const liner = plastic(0xdde8f0, 0.55);
  const base = 0.45;
  g.add(block(liner, -hx, hx, base - 0.02, base, -hz, hz, false));
  for (const s of [-1, 1]) {
    g.add(block(liner, s < 0 ? -hx - 0.02 : hx, s < 0 ? -hx : hx + 0.02, base - 0.02, h - 0.02, -hz - 0.02, hz + 0.02, false));
    g.add(block(liner, -hx, hx, base - 0.02, h - 0.02, s < 0 ? -hz - 0.02 : hz, s < 0 ? -hz : hz + 0.02, false));
  }
  // vách ngăn giữa các ngăn
  for (let i = 1; i < def.columns; i++) {
    const x = -hx + (2 * hx * i) / def.columns;
    g.add(block(liner, x - 0.008, x + 0.008, base, h - 0.06, -hz, hz, false));
  }
  g.add(block(coolerGlass(), -hx, hx, h - 0.03, h - 0.024, -hz, hz, false));
  g.add(block(steel(), -hx - 0.02, hx + 0.02, h - 0.036, h - 0.02, -hz - 0.03, -hz, false));
  g.add(block(steel(), -hx - 0.02, hx + 0.02, h - 0.036, h - 0.02, hz, hz + 0.03, false));
  return g;
}

/** Tủ mát / tủ đông dựng từ model cổ; null nếu thiếu model (dùng bản dựng bằng code). */
export function retroCooler(def: FurnitureDef): THREE.Group | null {
  if (def.geom === 'coke') {
    const m = prop('old_fridge_coke');
    return m ? cokeFridge(def, m) : null;
  }
  if (def.geom === 'chest') {
    const m = prop('old_freezer_chest');
    return m ? chestFreezer(def, m) : null;
  }
  return null;
}
