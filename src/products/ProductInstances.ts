import * as THREE from 'three';
import { getFurniture } from '../config/furniture';
import { getProduct, PRODUCTS } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import { itemPosition } from '../systems/SlotLayout';
import { packaging } from './PackagingFactory';

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
  private tmp = new THREE.Matrix4();
  private local = new THREE.Matrix4();
  total = 0;

  constructor(private scene: THREE.Scene, private furnitureMatrix: FurnitureMatrix) {}

  markDirty(): void {
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
      if (def.kind !== 'display') continue;
      const fm = this.furnitureMatrix(f);
      f.slots.forEach((s, si) => {
        if (!s.productId || s.qty <= 0) return;
        const p = getProduct(s.productId);
        const m = this.mesh(p.id, counts.get(p.id) ?? 0);
        const shown = s.qty - (this.holdback.get(`${f.uid}:${si}`) ?? 0);
        for (let i = 0; i < shown; i++) {
          const pos = itemPosition(def, si, p, i);
          const jitter = ((i * 7919) % 13) / 13 - 0.5;
          this.local.makeRotationY(jitter * 0.08).setPosition(pos.x, pos.y, pos.z);
          this.tmp.multiplyMatrices(fm, this.local);
          const n = idx.get(p.id) ?? 0;
          m.setMatrixAt(n, this.tmp);
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
