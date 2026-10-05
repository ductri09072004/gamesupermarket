import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, isVnHouse } from '../config/city';
import { mulberry32 } from '../core/Random';
import type { Placement } from './CityLayout';
import { cityModel } from './CityModels';

/**
 * Chi tiết đặc trưng nhà phố Việt, tính từ hình học model (cần model đã nạp):
 * cục nóng điều hoà trên mặt tiền các tầng, bồn nước inox trên mái, đèn lồng dưới mái hiên cửa hiệu.
 */

interface Shape {
  /** Đỉnh (toạ độ cục bộ model: gốc giữa đáy, mặt tiền +Z) */
  pts: Float32Array;
  top: { y: number; cx: number; cz: number; ex: number; ez: number };
}

const shapes = new Map<string, Shape | null>();

function shapeOf(model: string): Shape | null {
  if (shapes.has(model)) return shapes.get(model)!;
  const scene = cityModel(model);
  if (!scene) {
    shapes.set(model, null);
    return null;
  }
  scene.updateMatrixWorld(true);
  const all: number[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      all.push(v.x, v.y, v.z);
    }
  });
  const pts = new Float32Array(all);
  let maxY = -Infinity;
  for (let i = 1; i < pts.length; i += 3) maxY = Math.max(maxY, pts[i]);
  // mặt mái cao nhất: các đỉnh sát maxY → tâm & bề rộng vùng đó (thường là sân thượng / mái tum)
  let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    if (pts[i + 1] < maxY - 0.12) continue;
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    z0 = Math.min(z0, pts[i + 2]); z1 = Math.max(z1, pts[i + 2]);
  }
  const s: Shape = { pts, top: { y: maxY, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ex: x1 - x0, ez: z1 - z0 } };
  shapes.set(model, s);
  return s;
}

/** Mặt tiền nhô ra xa nhất (z lớn nhất) quanh điểm (x, y) — để gắn đồ ra phía trước ban công/tường. */
function frontZ(s: Shape, x: number, y: number, fallback: number): number {
  let z = -Infinity;
  for (let i = 0; i < s.pts.length; i += 3) {
    if (Math.abs(s.pts[i] - x) < 0.4 && Math.abs(s.pts[i + 1] - y) < 0.45) z = Math.max(z, s.pts[i + 2]);
  }
  return Number.isFinite(z) ? z : fallback;
}

export interface Tank {
  x: number;
  y: number;
  z: number;
  rot: number;
}

/** Đồ gắn nhà (placement 'prop' dùng chung InstancedMesh thành phố) + bồn nước trên mái. */
export function houseDetails(placements: Placement[]): { props: Placement[]; tanks: Tank[] } {
  const rng = mulberry32(5150);
  const props: Placement[] = [];
  const tanks: Tank[] = [];
  const toWorld = (p: Placement, lx: number, lz: number) => ({
    x: p.x + Math.cos(p.rot) * lx * (p.sx ?? 1) + Math.sin(p.rot) * lz * (p.sz ?? 1),
    z: p.z - Math.sin(p.rot) * lx * (p.sx ?? 1) + Math.cos(p.rot) * lz * (p.sz ?? 1),
  });
  let lantern = 0;
  for (const p of placements) {
    if (p.kind !== 'building' || !isVnHouse(p.model)) continue;
    const s = shapeOf(p.model);
    if (!s) continue;
    const [w, h, d] = BUILDINGS[p.model]; // toạ độ gốc; toWorld tự nhân hệ số co giãn
    // cục nóng điều hoà: tầng 2 trở lên, sát mép trái/phải mặt tiền
    for (let y = 3.6; y < h - 1.1; y += 3.2) {
      if (rng() > 0.6) continue;
      const lx = (rng() < 0.5 ? -1 : 1) * (w / 2 - 0.45);
      const lz = frontZ(s, lx, y, d / 2) + 0.17;
      const c = toWorld(p, lx, lz);
      props.push({ kind: 'prop', model: 'vn_ac_unit', x: c.x, z: c.z, rot: p.rot, variant: 0, y: y - 0.35 });
    }
    // bồn nước inox trên mái (mái đủ rộng)
    if (s.top.ex > 1.3 && s.top.ez > 0.9 && rng() < 0.8) {
      const c = toWorld(p, s.top.cx, s.top.cz - s.top.ez * 0.15);
      tanks.push({ x: c.x, y: s.top.y, z: c.z, rot: p.rot + (rng() < 0.5 ? 0 : Math.PI / 2) });
    }
    // đèn lồng dưới mái hiên cửa hiệu (xen kẽ)
    if (p.sign && lantern++ % 2 === 0) {
      // treo ở mép ngoài mái hiên (mái hiên vươn ra ~1.1m, cao ~2.4m) — trên đầu người đi bộ
      const c = toWorld(p, 0, d / 2 + 1.05);
      props.push({ kind: 'prop', model: 'vn_lanterns', x: c.x, z: c.z, rot: p.rot, variant: 0, y: 1.95 });
    }
  }
  return { props, tanks };
}

/** Bồn nước inox nằm ngang trên 2 giá đỡ (InstancedMesh). */
export function buildTanks(tanks: Tank[], group: THREE.Group): void {
  if (!tanks.length) return;
  const body = new THREE.CylinderGeometry(0.42, 0.42, 1.35, 16).rotateZ(Math.PI / 2).translate(0, 0.62, 0);
  const caps = [-0.69, 0.69].map((x) => new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    .scale(0.18, 1, 1).rotateZ(x < 0 ? Math.PI / 2 : -Math.PI / 2).translate(x, 0.62, 0));
  const lid = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12).translate(0, 1.07, 0);
  const tank = mergeGeometries([body, ...caps, lid].map((g) => g.toNonIndexed()))!;
  const stand = mergeGeometries([-0.45, 0.45].map((x) => new THREE.BoxGeometry(0.06, 0.3, 0.7).translate(x, 0.15, 0).toNonIndexed()))!;
  const inox = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.28 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3b3f44, metalness: 0.5, roughness: 0.6 });
  const m = new THREE.Matrix4();
  for (const [geo, mat] of [[tank, inox], [stand, iron]] as const) {
    const inst = new THREE.InstancedMesh(geo, mat, tanks.length);
    tanks.forEach((t, i) => inst.setMatrixAt(i, m.makeRotationY(t.rot).setPosition(t.x, t.y, t.z)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
}
