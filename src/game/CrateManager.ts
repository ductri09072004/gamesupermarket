import * as THREE from 'three';
import { crateModel } from '../entities/CrateModel';
import type { Services } from '../core/Services';

interface View {
  obj: THREE.Group;
  /** Rơi từ đuôi xe tải: t chạy 0 → 1 */
  t: number;
  from: THREE.Vector3 | null;
}

/** Thùng nội thất nằm trên vỉa hè / sàn chờ người chơi bê vào lắp đặt. */
export class CrateManager {
  readonly group = new THREE.Group();
  private views = new Map<string, View>();
  private dirty = true;
  private pendingFrom: THREE.Vector3 | null = null;
  private offs: Array<() => void>;

  constructor(private s: Services) {
    this.offs = [
      s.bus.on('crates:changed', () => { this.dirty = true; }),
      s.bus.on('order:arrived', ({ from }) => { if (from) this.pendingFrom = new THREE.Vector3(from.x, from.y, from.z); }),
    ];
  }

  private sync(): void {
    this.dirty = false;
    const alive = new Set<string>();
    for (const k of this.s.data.crates) {
      if (k.held) continue;
      alive.add(k.uid);
      let v = this.views.get(k.uid);
      if (!v) {
        const obj = crateModel(k.type);
        obj.userData = { kind: 'crate', uid: k.uid };
        this.group.add(obj);
        v = { obj, t: this.pendingFrom ? 0 : 1, from: this.pendingFrom?.clone() ?? null };
        this.views.set(k.uid, v);
      }
      v.obj.position.set(k.x, 0, k.z);
      v.obj.rotation.y = ((k.uid.charCodeAt(k.uid.length - 1) % 5) - 2) * 0.04;
    }
    this.pendingFrom = null;
    for (const [uid, v] of this.views) {
      if (alive.has(uid)) continue;
      v.obj.removeFromParent();
      this.views.delete(uid);
    }
  }

  update(dt: number): void {
    if (this.dirty) this.sync();
    for (const [uid, v] of this.views) {
      if (v.t >= 1 || !v.from) continue;
      const k = this.s.data.crates.find((c) => c.uid === uid);
      if (!k) continue;
      v.t = Math.min(1, v.t + dt / 0.6);
      const e = 1 - (1 - v.t) ** 2;
      v.obj.position.set(v.from.x + (k.x - v.from.x) * e, v.from.y * (1 - e) + Math.sin(Math.PI * v.t) * 0.5, v.from.z + (k.z - v.from.z) * e);
    }
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.group.clear();
    this.views.clear();
  }
}
