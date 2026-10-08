import * as THREE from 'three';
import { getFurniture } from '../config/furniture';
import { getProduct, PRODUCTS } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import { hashString } from '../core/Random';
import { itemPosition } from '../systems/SlotLayout';
import { packaging } from './PackagingFactory';

/** Băm số nguyên → [0,1). */
function hash01(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Ma trận world của nội thất (gốc giữa đáy footprint, xoay theo rot). */
export type FurnitureMatrix = (f: FurnitureData) => THREE.Matrix4;

/**
 * Hiển thị toàn bộ sản phẩm trên kệ bằng InstancedMesh (1 mesh / sản phẩm).
 * `holdback` ẩn tạm vài món trên cùng của 1 slot trong lúc món đang bay tới.
 */
export class ProductInstances {
  private meshes = new Map<string, THREE.InstancedMesh>();
  private dirty = true;
  private holdback = new Map<string, number>();
  /** Nội thất đang được nhấc (Build mode) → ẩn hàng trên đó. */
  private hidden = new Set<string>();
  private tmp = new THREE.Matrix4();
  private local = new THREE.Matrix4();
  private tint = new THREE.Color();
  private euler = new THREE.Euler();
  private quat = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private at = new THREE.Vector3();
  total = 0;

  constructor(private scene: THREE.Scene, private furnitureMatrix: FurnitureMatrix) {}

  markDirty(): void {
    this.dirty = true;
  }

  setHidden(furnUid: string, hidden: boolean): void {
    if (hidden) this.hidden.add(furnUid);
    else this.hidden.delete(furnUid);
    this.dirty = true;
  }

  hold(furnUid: string, slot: number, delta: number): void {
    const k = `${furnUid}:${slot}`;
    const v = (this.holdback.get(k) ?? 0) + delta;
    if (v <= 0) this.holdback.delete(k);
    else this.holdback.set(k, v);
    this.dirty = true;
  }

  private mesh(productId: string, need: number): THREE.InstancedMesh {
    let m = this.meshes.get(productId);
    if (m && m.instanceMatrix.count >= need) return m;
    const cap = Math.max(64, Math.ceil(need * 1.5));
    if (m) {
      this.scene.remove(m);
      m.dispose();
    }
    const pk = packaging(productId);
    m = new THREE.InstancedMesh(pk.geometry, pk.materials, cap);
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.name = `products:${productId}`;
    this.scene.add(m);
    this.meshes.set(productId, m);
    return m;
  }

  /** Vị trí world của món thứ i trong slot. */
  itemWorld(f: FurnitureData, slot: number, productId: string, i: number, out = new THREE.Vector3()): THREE.Vector3 {
    const def = getFurniture(f.type);
    const p = itemPosition(def, slot, getProduct(productId), i);
    return out.set(p.x, p.y, p.z).applyMatrix4(this.furnitureMatrix(f));
  }

  update(furniture: FurnitureData[]): void {
    if (!this.dirty) return;
    this.dirty = false;
    const counts = new Map<string, number>();
    for (const f of furniture) for (const s of f.slots) if (s.productId && s.qty > 0) counts.set(s.productId, (counts.get(s.productId) ?? 0) + s.qty);
    const idx = new Map<string, number>();
    this.total = 0;
    for (const f of furniture) {
      const def = getFurniture(f.type);
      if (def.kind !== 'display' || this.hidden.has(f.uid)) continue;
      const fm = this.furnitureMatrix(f);
      const fh = hashString(f.uid);
      f.slots.forEach((s, si) => {
        if (!s.productId || s.qty <= 0) return;
        const p = getProduct(s.productId);
        const m = this.mesh(p.id, counts.get(p.id) ?? 0);
        const shown = s.qty - (this.holdback.get(`${f.uid}:${si}`) ?? 0);
        for (let i = 0; i < shown; i++) {
          const pos = itemPosition(def, si, p, i);
          // số ngẫu nhiên xác định theo (nội thất, slot, vị trí) nên không nhấp nháy giữa các lần cập nhật
          const r1 = hash01(fh + si * 131 + i * 7919);
          const r2 = hash01(fh * 3 + si * 17 + i * 104729);
          const r3 = hash01(fh * 7 + si * 29 + i * 15485863);
          const lean = p.shape === 'bag' ? (r3 - 0.5) * 0.14 : 0;
          this.euler.set(lean, (r1 - 0.5) * 0.22, p.shape === 'bag' ? (r2 - 0.5) * 0.06 : 0);
          this.quat.setFromEuler(this.euler);
          this.at.set(pos.x + (r2 - 0.5) * 0.008, pos.y, pos.z + (r3 - 0.5) * 0.008);
          this.local.compose(this.at, this.quat, this.one);
          this.tmp.multiplyMatrices(fm, this.local);
          const n = idx.get(p.id) ?? 0;
          m.setMatrixAt(n, this.tmp);
          const v = 0.9 + r1 * 0.12;
          m.setColorAt(n, this.tint.setRGB(v, v * (0.97 + r2 * 0.03), v * (0.93 + r3 * 0.06)));
          idx.set(p.id, n + 1);
          this.total++;
        }
      });
    }
    for (const p of PRODUCTS) {
      const m = this.meshes.get(p.id);
      if (!m) continue;
      m.count = idx.get(p.id) ?? 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }

  dispose(): void {
    for (const m of this.meshes.values()) {
      this.scene.remove(m);
      m.dispose();
    }
    this.meshes.clear();
  }
}
