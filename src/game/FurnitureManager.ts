import * as THREE from 'three';
import { getFurniture, isCeiling } from '../config/furniture';
import { getProduct } from '../config/products';
import type { Services } from '../core/Services';
import type { Assets } from '../engine/Assets';
import type { AudioEngine } from '../engine/Audio';
import { FurnitureView } from '../entities/Shelf';
import { rotatedExtent } from '../world/Footprint';
import type { AABB } from '../world/Colliders';
import { furnitureCenter, furnitureMatrix } from '../world/Placement';

/** Đồng bộ các FurnitureView với state; sinh collider AABB. */
export class FurnitureManager {
  readonly group = new THREE.Group();
  private views = new Map<string, FurnitureView>();
  private offs: Array<() => void> = [];
  private hums = new Map<string, THREE.PositionalAudio>();
  onChanged: () => void = () => {};

  constructor(private s: Services, private assets: Assets | null, private audio: AudioEngine | null) {
    this.sync();
    this.offs.push(
      s.bus.on('price:changed', () => this.views.forEach((v) => v.updateTags())),
      s.bus.on('day:started', () => this.views.forEach((v) => v.updateTags())),
      s.bus.on('inventory:changed', ({ furnitureUid }) => this.views.get(furnitureUid)?.updateTags()),
    );
  }

  private priceInfo = (id: string) => ({ price: this.s.state.priceOf(id), market: this.s.market(id), cost: getProduct(id).costPerUnit });

  get(uid: string): FurnitureView | undefined {
    return this.views.get(uid);
  }

  all(): FurnitureView[] {
    return [...this.views.values()];
  }

  sync(): void {
    const seen = new Set<string>();
    for (const f of this.s.data.furniture) {
      seen.add(f.uid);
      let v = this.views.get(f.uid);
      if (!v) {
        v = new FurnitureView(f, this.assets, this.priceInfo);
        this.views.set(f.uid, v);
        this.group.add(v.root);
        const def = getFurniture(f.type);
        if (this.audio && (def.storage === 'fridge' || def.storage === 'freezer' || def.vending)) {
          this.hums.set(f.uid, this.audio.attachHum(v.root, def.storage === 'freezer' ? 0.6 : 0.4));
        }
      }
      v.data = f;
      v.refresh();
    }
    for (const [uid, v] of this.views) {
      if (seen.has(uid)) continue;
      const hum = this.hums.get(uid);
      if (hum?.isPlaying) hum.stop();
      this.hums.delete(uid);
      v.dispose();
      this.views.delete(uid);
    }
    this.onChanged();
  }

  /** Hộp va chạm theo kích thước thật (hộp bao khi xoay xiên). */
  colliders(): AABB[] {
    const out: AABB[] = [];
    for (const f of this.s.data.furniture) {
      const v = this.views.get(f.uid);
      if (v && !v.root.visible) continue;
      const def = getFurniture(f.type);
      if (isCeiling(def)) continue;
      if (def.kind === 'gate') {
        // chỉ 2 cột 2 bên chặn người chơi; lối giữa đi qua được
        const m = furnitureMatrix(f);
        for (const sx of [-1, 1]) {
          const p = new THREE.Vector3(sx * (def.size.w / 2 - 0.07), 0, 0).applyMatrix4(m);
          out.push({ minX: p.x - 0.1, maxX: p.x + 0.1, minZ: p.z - 0.1, maxZ: p.z + 0.1, tag: f.uid });
        }
        continue;
      }
      const c = furnitureCenter(f);
      const { w: sw, d: sd } = rotatedExtent(def.size.w, def.size.d, f.rot);
      out.push({ minX: c.x - sw / 2, maxX: c.x + sw / 2, minZ: c.z - sd / 2, maxZ: c.z + sd / 2, tag: f.uid });
    }
    return out;
  }

  update(dt: number): void {
    for (const v of this.views.values()) v.update(dt);
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    for (const h of this.hums.values()) if (h.isPlaying) h.stop();
    this.views.forEach((v) => v.dispose());
    this.views.clear();
    this.group.removeFromParent();
  }
}
