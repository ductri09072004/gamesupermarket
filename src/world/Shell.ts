import * as THREE from 'three';
import { CEILING_HEIGHT, MAX_STORE_W, STORE_FRONT_Z, WALL_THICKNESS, WAREHOUSE, WAREHOUSE_LOT } from '../config/constants';
import type { AABB } from './Colliders';
import type { Rect } from './CityLayout';
import { applyPbr, pbrSet, setRepeat } from './Materials';
import { signMaterial } from './SignFactory';

const T = WALL_THICKNESS;
const FRONT = STORE_FRONT_Z;
/** Bề dày tường chung giữa cửa hàng và kho (m) */
const PARTY = 0.5;
const WALL_H = CEILING_HEIGHT + 0.3;
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);

function inside(r: Rect, x: number, z: number): boolean {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/**
 * Vỏ nhà cố định: toà nhà chiếm trọn mặt bằng tối đa của cửa hàng (20 × 16m) và của kho bên cạnh ngay từ đầu, để phố không dịch chuyển
 * khi mở rộng. Phần chưa mở khoá là khối đặc kín: mái tôn, tường ngoài, mặt tiền kéo cửa cuốn có biển "Sắp mở rộng" — không có
 * nội thất bên trong và không đi vào được. Vách ngăn với phần đã dùng do Store (cửa hàng) và Shell (kho) dựng.
 */
export class Shell {
  readonly group = new THREE.Group();
  private solids: AABB[] = [];
  private owned: Array<THREE.Material | THREE.BufferGeometry | THREE.Texture> = [];
  private plaster = new THREE.MeshStandardMaterial({ color: 0xd6c8a8, roughness: 0.92 });
  private roof = new THREE.MeshStandardMaterial({ color: 0x77808a, roughness: 0.6, metalness: 0.5 });

  /** Dựng lại theo phần đã mở khoá: cửa hàng rộng W, sâu depth (sát mặt tiền); kho đã mở khoá hay chưa. */
  update(W: number, depth: number, warehouse: boolean): void {
    for (const o of this.owned) o.dispose();
    this.owned = [];
    this.group.clear();
    this.solids = [];
    const B = FRONT - depth;
    const lot: Rect = { x0: WAREHOUSE_LOT.x0, x1: -PARTY, z0: WAREHOUSE_LOT.z0, z1: FRONT };
    const shopActive: Rect = { x0: -PARTY, x1: W, z0: B, z1: FRONT };
    const whActive: Rect | null = warehouse ? { x0: WAREHOUSE.x0, x1: WAREHOUSE.x0 + WAREHOUSE.w, z0: WAREHOUSE.z0, z1: FRONT } : null;
    const masses: Rect[] = [];
    if (B > 0) masses.push({ x0: 0, x1: MAX_STORE_W, z0: 0, z1: B });
    if (W < MAX_STORE_W) masses.push({ x0: W, x1: MAX_STORE_W, z0: B, z1: FRONT });
    if (B > lot.z0) masses.push({ x0: -PARTY, x1: 0, z0: lot.z0, z1: B });
    if (whActive) {
      masses.push({ ...lot, z1: whActive.z0 }, { ...lot, x1: whActive.x0, z0: whActive.z0 });
    } else masses.push(lot);

    const covered = (x: number, z: number) => masses.some((m) => inside(m, x, z)) || inside(shopActive, x, z) || (!!whActive && inside(whActive, x, z));
    for (const m of masses) {
      this.roofOf(m);
      this.solids.push({ minX: m.x0, maxX: m.x1, minZ: m.z0, maxZ: m.z1, tag: 'shell' });
      for (const seg of this.exteriorEdges(m, covered)) this.wall(seg.x0, seg.x1, seg.z0, seg.z1, seg.facade, seg.x1 <= 0 ? (warehouse ? 'KHO HÀNG' : 'KHO · SẮP MỞ') : 'SẮP MỞ RỘNG');
    }
    if (whActive) {
      const { x0, x1, z0 } = whActive;
      this.wall(x0 - T, x0, z0 - T, FRONT + T, false);
      this.wall(x0 - T, x1, z0 - T, z0, false);
      this.wall(x0, x1, FRONT, FRONT + T, true, 'KHO HÀNG');
    }
  }

  /** Các đoạn cạnh của khối nằm ngoài (điểm ngay bên ngoài cạnh không thuộc khối / phần đã dùng nào). */
  private exteriorEdges(m: Rect, covered: (x: number, z: number) => boolean): Array<Rect & { facade: boolean }> {
    const out: Array<Rect & { facade: boolean }> = [];
    const step = 0.25;
    const run = (from: number, to: number, ext: (t: number) => boolean, make: (a: number, b: number) => Rect & { facade: boolean }) => {
      let start: number | null = null;
      for (let t = from; t < to - 1e-6; t += step) {
        const on = ext(t + step / 2);
        if (on && start === null) start = t;
        if (!on && start !== null) { out.push(make(start, t)); start = null; }
      }
      if (start !== null) out.push(make(start, to));
    };
    const d = 0.1;
    run(m.x0, m.x1, (t) => !covered(t, m.z0 - d), (a, b) => ({ x0: a, x1: b, z0: m.z0 - T, z1: m.z0, facade: false }));
    run(m.x0, m.x1, (t) => !covered(t, m.z1 + d), (a, b) => ({ x0: a, x1: b, z0: m.z1, z1: m.z1 + T, facade: m.z1 === FRONT }));
    run(m.z0, m.z1, (t) => !covered(m.x0 - d, t), (a, b) => ({ x0: m.x0 - T, x1: m.x0, z0: a, z1: b, facade: false }));
    run(m.z0, m.z1, (t) => !covered(m.x1 + d, t), (a, b) => ({ x0: m.x1, x1: m.x1 + T, z0: a, z1: b, facade: false }));
    return out;
  }

  private roofOf(m: Rect): void {
    const mesh = new THREE.Mesh(unitPlane, this.roof);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(m.x1 - m.x0, m.z1 - m.z0, 1);
    mesh.position.set((m.x0 + m.x1) / 2, CEILING_HEIGHT + 0.05, (m.z0 + m.z1) / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private shutter(len: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb5babf, roughness: 0.6, metalness: 0.2 });
    const set = pbrSet('shutter');
    if (set) {
      mat.roughness = 1;
      const maps = applyPbr(mat, set, ['map', 'normalMap', 'roughnessMap', 'aoMap'], true);
      setRepeat(maps, len, WALL_H);
      this.owned.push(...maps);
    }
    this.owned.push(mat);
    return mat;
  }

  private wall(x0: number, x1: number, z0: number, z1: number, facade: boolean, label?: string): void {
    const m = new THREE.Mesh(unitBox, facade ? this.shutter(Math.max(x1 - x0, z1 - z0)) : this.plaster);
    m.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
    m.scale.set(x1 - x0, WALL_H, z1 - z0);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.solids.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, tag: 'wall' });
    if (facade && label && x1 - x0 > 3) {
      const mat = signMaterial({ text: label, style: 'paint', bg: '#e9dcb8', ink: '#8a2b1c', accent: '#8a2b1c', w: 1024, h: 256, seed: Math.round(x0) + 7, wear: 0.35 });
      this.owned.push(mat);
      const sign = new THREE.Mesh(unitPlane, mat);
      sign.scale.set(2.8, 0.7, 1);
      sign.position.set((x0 + x1) / 2, 2.7, z1 + 0.012);
      this.group.add(sign);
    }
  }

  /** Vật cản: các khối đặc chưa mở khoá và tường ngoài / vách ngăn kho. */
  colliders(): AABB[] {
    return this.solids;
  }
}
