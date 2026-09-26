import * as THREE from 'three';
import { getFurniture } from '../config/furniture';
import { FEEL } from '../config/feel';
import type { Services } from '../core/Services';
import { BOX_H, BoxModel } from '../entities/Box';
import { slotBox } from '../systems/SlotLayout';
import { furnitureMatrix } from '../world/Placement';

interface Entry {
  model: BoxModel;
  dropT: number;
  dropFrom: number;
  y: number;
  /** Bay từ đuôi xe tải tới chỗ đặt (thay cho rơi thẳng xuống) */
  from: THREE.Vector3 | null;
}

/** Thùng trên sàn / vỉa hè / kệ kho. Xếp chồng khi trùng vị trí (snap). */
export class BoxManager {
  readonly group = new THREE.Group();
  private entries = new Map<string, Entry>();
  private dirty = true;
  private pendingDrops = new Set<string>();
  private dropOrigin = new Map<string, THREE.Vector3>();
  /** Kệ kho đang được nhấc → ẩn thùng trên đó. */
  private hiddenHolders = new Set<string>();
  private offs: Array<() => void> = [];
  /** Tư thế thùng trên sàn do vật lý điều khiển (BoxPhysics gán) */
  physicsPose: ((uid: string) => { p: { x: number; y: number; z: number }; q: { x: number; y: number; z: number; w: number } } | null) | null = null;

  constructor(private s: Services) {
    this.offs.push(
      s.bus.on('boxes:changed', () => { this.dirty = true; }),
      s.bus.on('order:arrived', ({ boxUids, from }) => {
        for (const u of boxUids) {
          this.pendingDrops.add(u);
          if (from) this.dropOrigin.set(u, new THREE.Vector3(from.x, from.y, from.z));
        }
        this.dirty = true;
      }),
    );
  }

  setHolderHidden(uid: string, hidden: boolean): void {
    if (hidden) this.hiddenHolders.add(uid);
    else this.hiddenHolders.delete(uid);
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  model(uid: string): BoxModel | undefined {
    return this.entries.get(uid)?.model;
  }

  /** Chiều cao nóc chồng thùng tại (x, z) — để snap khi thả. */
  stackTop(x: number, z: number, ignore?: string): { y: number; x: number; z: number } | null {
    let best: { y: number; x: number; z: number } | null = null;
    for (const b of this.s.data.boxes) {
      if (b.location !== 'floor' || b.uid === ignore) continue;
      if (Math.abs(b.gx - x) < 0.3 && Math.abs(b.gy - z) < 0.25) {
        const e = this.entries.get(b.uid);
        const y = (e?.y ?? 0) + BOX_H;
        if (!best || y > best.y) best = { y, x: b.gx, z: b.gy };
      }
    }
    return best;
  }

  private layout(): void {
    const seen = new Set<string>();
    const stacks = new Map<string, number>();
    const boxes = [...this.s.data.boxes].sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
    let dropIndex = 0;
    for (const b of boxes) {
      if (b.location === 'held' || b.location === 'staff' || b.location === 'vehicle') continue;
      seen.add(b.uid);
      let e = this.entries.get(b.uid);
      if (!e) {
        e = { model: new BoxModel(b.productId), dropT: 1, dropFrom: 0, y: 0, from: null };
        e.model.group.userData = { kind: 'box', uid: b.uid };
        this.group.add(e.model.group);
        this.entries.set(b.uid, e);
      }
      e.model.group.userData.uid = b.uid;
      e.model.setOpen(b.open);
      e.model.setContents(b.productId, b.qty);
      const g = e.model.group;
      if (b.location === 'rack' && b.holderId) {
        const rack = this.s.state.furniture(b.holderId);
        if (!rack) continue;
        g.visible = !this.hiddenHolders.has(rack.uid);
        const def = getFurniture(rack.type);
        const i = Math.max(0, rack.boxes.indexOf(b.uid));
        const sb = slotBox(def, i);
        const p = new THREE.Vector3(sb.x0 + sb.width / 2, sb.y, 0).applyMatrix4(furnitureMatrix(rack));
        g.position.copy(p);
        g.rotation.y = 0;
        e.y = p.y;
        continue;
      }
      g.visible = true;
      const key = `${b.gx.toFixed(2)},${b.gy.toFixed(2)}`;
      const n = stacks.get(key) ?? 0;
      stacks.set(key, n + 1);
      e.y = n * BOX_H;
      g.position.set(b.gx, e.y, b.gy);
      g.rotation.y = ((b.uid.charCodeAt(b.uid.length - 1) % 5) - 2) * 0.03;
      if (this.pendingDrops.has(b.uid)) {
        this.pendingDrops.delete(b.uid);
        e.from = this.dropOrigin.get(b.uid) ?? null;
        this.dropOrigin.delete(b.uid);
        e.dropT = -dropIndex++ * (e.from ? 0.18 : 0.25);
        e.dropFrom = e.from ? 0.35 : 1.6;
      }
    }
    for (const [uid, e] of this.entries) {
      if (seen.has(uid)) continue;
      e.model.dispose();
      this.entries.delete(uid);
    }
  }

  /** Đang bay từ xe tải / rơi xuống (vật lý chờ tới khi xong). */
  isAnimating(uid: string): boolean {
    const e = this.entries.get(uid);
    return !!e && (e.dropT < 1 || !!e.from);
  }

  /** Nảy nhẹ khi đặt xuống. */
  bounce(uid: string): void {
    const e = this.entries.get(uid);
    if (e) {
      e.dropT = 0;
      e.dropFrom = 0.25;
    }
  }

  update(dt: number): void {
    if (this.dirty) {
      this.dirty = false;
      this.layout();
    }
    const half = new THREE.Vector3();
    for (const [uid, e] of this.entries) {
      e.model.update(dt);
      if (e.dropT >= 1) {
        // thùng trên sàn: đi theo thân vật lý (gốc model ở giữa đáy, thân vật lý ở tâm hộp)
        const ph = this.physicsPose?.(uid);
        if (!ph) continue;
        const g = e.model.group;
        g.quaternion.set(ph.q.x, ph.q.y, ph.q.z, ph.q.w);
        half.set(0, -BOX_H / 2, 0).applyQuaternion(g.quaternion);
        g.position.set(ph.p.x + half.x, ph.p.y + half.y, ph.p.z + half.z);
        e.y = ph.p.y - BOX_H / 2;
        continue;
      }
      e.dropT += dt / 0.55;
      const t = Math.max(0, Math.min(1, e.dropT));
      // rơi + nảy (easeOutBounce)
      const n1 = 7.5625;
      const d1 = 2.75;
      let b: number;
      if (t < 1 / d1) b = n1 * t * t;
      else if (t < 2 / d1) b = n1 * (t - 1.5 / d1) ** 2 + 0.75;
      else if (t < 2.5 / d1) b = n1 * (t - 2.25 / d1) ** 2 + 0.9375;
      else b = n1 * (t - 2.625 / d1) ** 2 + 0.984375;
      const g = e.model.group;
      g.visible = e.dropT >= 0;
      if (e.from) {
        // bay theo đường vòng cung từ đuôi xe → ô giao hàng, chạm đất nảy nhẹ
        const tx = g.userData.tx ?? (g.userData.tx = g.position.x);
        const tz = g.userData.tz ?? (g.userData.tz = g.position.z);
        const k = Math.min(1, t * 1.6);
        g.position.x = e.from.x + (tx - e.from.x) * k;
        g.position.z = e.from.z + (tz - e.from.z) * k;
        g.position.y = k < 1 ? e.from.y + (e.y - e.from.y) * k + Math.sin(Math.PI * k) * 0.8 : e.y + (1 - b) * e.dropFrom;
        if (e.dropT >= 1) { e.from = null; delete g.userData.tx; delete g.userData.tz; }
        continue;
      }
      g.position.y = e.y + (1 - b) * e.dropFrom * (1 + FEEL.boxDropBounce);
    }
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.entries.forEach((e) => e.model.dispose());
    this.entries.clear();
    this.group.removeFromParent();
  }
}
