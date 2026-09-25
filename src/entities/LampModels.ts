import * as THREE from 'three';
import { CEILING_HEIGHT } from '../config/constants';
import type { FurnitureDef } from '../config/furniture';
import { cyl, powder, rblock, steel } from './DisplayMaterials';
import { block } from './FurnitureModels';
import { mergedModel } from './MergeStatic';

/** Đèn trần (gốc giữa đáy ở sàn, model treo sát trần CEILING_HEIGHT). */

const glowMats = new Map<string, { mat: THREE.MeshStandardMaterial; on: number }>();

/** Vật liệu phát sáng dùng chung theo loại đèn — công tắc đổi emissiveIntensity cho tất cả. */
function glow(key: string, color: number, on: number): THREE.MeshStandardMaterial {
  let g = glowMats.get(key);
  if (!g) {
    g = { mat: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: color, emissiveIntensity: on, roughness: 0.4 }), on };
    glowMats.set(key, g);
  }
  return g.mat;
}

/** Bật/tắt toàn bộ đèn trần (mặt phát sáng). */
export function setLampsGlow(on: boolean): void {
  for (const g of glowMats.values()) g.mat.emissiveIntensity = on ? g.on : 0;
}

const H = CEILING_HEIGHT;

/** Máng đèn LED tuýp: hộp nhôm sơn trắng + tấm tán quang phát sáng. */
function tube(def: FurnitureDef): THREE.Group {
  const g = new THREE.Group();
  const hw = def.size.w / 2 - 0.05;
  g.add(rblock(powder(0xf1f3f5, 0.4), -hw, hw, H - 0.06, H, -0.1, 0.1, 0.02, false));
  g.add(block(glow('tube', def.light?.color ?? 0xffffff, 2.6), -hw + 0.02, hw - 0.02, H - 0.063, H - 0.058, -0.082, 0.082, false));
  for (const x of [-hw + 0.12, hw - 0.12]) g.add(block(steel(), x - 0.02, x + 0.02, H - 0.005, H, -0.11, 0.11, false));
  return g;
}

/** Đèn thả: đế trần, dây treo, chao kim loại tối, bóng đèn ấm. */
function pendant(def: FurnitureDef): THREE.Group {
  const g = new THREE.Group();
  const dark = powder(0x2b2d42, 0.45);
  g.add(cyl(dark, 0.055, H - 0.03, H, 0, 0, 16));
  g.add(cyl(steel(), 0.004, H - 0.52, H - 0.03, 0, 0, 6));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.18, 24, 1, true), dark);
  shade.position.y = H - 0.61;
  g.add(shade);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.198, 0.179, 24, 1, true), glow('pendantShade', def.light?.color ?? 0xffd9a8, 0.35));
  (inner.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; // nhìn từ dưới lên thấy lòng chao sáng
  inner.position.y = H - 0.61;
  g.add(inner);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), glow('pendantBulb', def.light?.color ?? 0xffd9a8, 3));
  bulb.position.y = H - 0.66;
  g.add(bulb);
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

export function buildLamp(def: FurnitureDef): THREE.Group {
  return mergedModel(`lamp:${def.id}`, () => (def.id === 'lamp_pendant' ? pendant(def) : tube(def)));
}
