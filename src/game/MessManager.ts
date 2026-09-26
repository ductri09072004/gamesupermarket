import * as THREE from 'three';
import { DOOR_WIDTH, DOOR_X, MINUTES_PER_SECOND, WALL_THICKNESS } from '../config/constants';
import type { DirtData, DirtKind, LooseItem } from '../core/GameState';
import { dirtMesh, looseMesh } from '../entities/MessModels';
import { productMesh } from '../products/PackagingFactory';
import { findReturnShelf } from '../systems/InventorySystem';
import { adjacentTiles, type GridPoint } from '../world/Footprint';
import { worldToCell } from '../world/NavGrid';
import type { GameCtx } from './Ctx';

/**
 * Chất bẩn (rác, vết đổ, vết bẩn kính) + hàng rơi trên sàn: hiển thị, sinh chỗ bẩn theo khách,
 * giao việc cho lao công / bảo vệ (claim), người chơi click để dọn / nhặt.
 */
export class MessManager {
  readonly group = new THREE.Group();
  private views = new Map<string, THREE.Object3D>();
  private claims = new Map<string, string>();
  private offs: Array<() => void> = [];
  private dirty = true;

  constructor(private c: GameCtx, private people: () => Array<{ x: number; z: number }>) {
    this.offs.push(c.s.bus.on('dirt:changed', () => { this.dirty = true; }), c.s.bus.on('loose:changed', () => { this.dirty = true; }));
  }

  private get d() {
    return this.c.s.data;
  }

  // ---------- sinh chất bẩn ----------
  private floorOk(x: number, z: number): boolean {
    const g = this.c.s.grid;
    const cell = worldToCell(x, z);
    return g.isStoreInterior(cell.gx, cell.gy) && g.isWalkable(cell.gx, cell.gy);
  }

  /** Rác / vết đổ: gần một khách đang trong cửa hàng (hoặc ngẫu nhiên); vết kính: dọc kính mặt tiền. */
  private spot = (kind: DirtKind): { x: number; z: number } | null => {
    const rng = this.c.s.rng;
    const W = this.d.storeW;
    const D = this.d.storeH;
    if (kind === 'smudge') {
      const left = DOOR_X - DOOR_WIDTH / 2 - 0.3;
      const right = W - 0.3 - (DOOR_X + DOOR_WIDTH / 2 + 0.3);
      const t = rng() * (left - 0.3 + right);
      const x = t < left - 0.3 ? 0.3 + t : DOOR_X + DOOR_WIDTH / 2 + 0.3 + (t - (left - 0.3));
      return { x, z: D + WALL_THICKNESS / 2 - 0.035 };
    }
    const inside = this.people().filter((p) => this.floorOk(p.x, p.z));
    for (let i = 0; i < 8; i++) {
      const base = inside.length && rng() < 0.8 ? inside[Math.floor(rng() * inside.length)] : { x: 0.5 + rng() * (W - 1), z: 0.5 + rng() * (D - 1) };
      const x = base.x + (rng() - 0.5) * 1.2;
      const z = base.z + (rng() - 0.5) * 1.2;
      if (this.floorOk(x, z)) return { x, z };
    }
    return null;
  };

  update(sim: number): void {
    const s = this.c.s;
    if (sim > 0 && s.data.storeOpen) {
      const inside = this.people().filter((p) => this.floorOk(p.x, p.z)).length;
      s.cleanliness.update(sim * MINUTES_PER_SECOND, inside, this.spot);
    }
    if (this.dirty) this.sync();
  }

  private sync(): void {
    this.dirty = false;
    const alive = new Set<string>();
    for (const x of this.d.dirt) this.ensure(x.uid, alive, () => dirtMesh(x));
    for (const x of this.d.loose) this.ensure(x.uid, alive, () => looseMesh(x.uid, x.productId, x.x, x.z));
    for (const [uid, v] of this.views) {
      if (alive.has(uid)) continue;
      v.removeFromParent();
      this.views.delete(uid);
      this.claims.delete(uid);
    }
  }

  private ensure(uid: string, alive: Set<string>, make: () => THREE.Object3D): void {
    alive.add(uid);
    if (this.views.has(uid)) return;
    const v = make();
    this.views.set(uid, v);
    this.group.add(v);
  }

  // ---------- việc cho nhân viên ----------
  claim(uid: string, by: string): boolean {
    const cur = this.claims.get(uid);
    if (cur && cur !== by) return false;
    this.claims.set(uid, by);
    return true;
  }

  release(uid: string, by: string): void {
    if (this.claims.get(uid) === by) this.claims.delete(uid);
  }

  isFree(uid: string, by: string): boolean {
    const cur = this.claims.get(uid);
    return !cur || cur === by;
  }

  dirtJobs(by: string): DirtData[] {
    return this.d.dirt.filter((x) => this.isFree(x.uid, by));
  }

  looseJobs(by: string): LooseItem[] {
    return this.d.loose.filter((x) => this.isFree(x.uid, by));
  }

  /** Ô đứng để dọn: ngay chỗ bẩn hoặc kề bên; vết kính: ô trong cửa hàng sát kính, không được thì ô vỉa hè ngoài kính. */
  workSpots(x: number, z: number, glass: boolean): GridPoint[] {
    const g = this.c.s.grid;
    const cell = worldToCell(x, g.storeH - 0.25);
    const cand = glass
      ? [cell, { gx: cell.gx - 1, gy: cell.gy }, { gx: cell.gx + 1, gy: cell.gy }, { gx: cell.gx, gy: g.sd + 1 }]
      : [worldToCell(x, z), ...adjacentTiles([worldToCell(x, z)])];
    return cand.filter((p) => g.isWalkable(p.gx, p.gy));
  }

  cleanDirt(uid: string, pos?: THREE.Vector3): boolean {
    const d = this.d.dirt.find((x) => x.uid === uid);
    if (!d || !this.c.s.cleanliness.clean(uid)) return false;
    this.c.sound(d.kind === 'litter' ? 'paper' : 'mop', pos ?? new THREE.Vector3(d.x, 0.3, d.z));
    return true;
  }

  addLoose(productId: string, x: number, z: number): void {
    this.d.loose.push({ uid: this.c.s.state.newUid('l'), productId, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
    this.c.s.bus.emit('loose:changed', {});
  }

  takeLoose(uid: string): LooseItem | null {
    const i = this.d.loose.findIndex((x) => x.uid === uid);
    if (i < 0) return null;
    const [it] = this.d.loose.splice(i, 1);
    this.c.s.bus.emit('loose:changed', {});
    return it;
  }

  /** Đặt 1 món về kệ (bay từ `from` vào slot). false nếu không còn chỗ. */
  returnToShelf(productId: string, from: THREE.Vector3): boolean {
    const t = findReturnShelf(this.d.furniture, productId);
    if (!t) return false;
    const to = this.c.products.itemWorld(t.furn, t.slot, productId, t.furn.slots[t.slot].productId === productId ? t.furn.slots[t.slot].qty : 0);
    if (!this.c.s.inventory.returnOne(t.furn, t.slot, productId).ok) return false;
    this.c.products.hold(t.furn.uid, t.slot, 1);
    this.c.effects.fly(productMesh(productId), from, to, { dur: 0.3, arc: 0.12, onDone: () => this.c.products.hold(t.furn.uid, t.slot, -1) });
    this.c.sound('tock', to);
    return true;
  }

  /** Người chơi click món rơi → bay thẳng về kệ. */
  playerPickLoose(uid: string): void {
    const it = this.d.loose.find((x) => x.uid === uid);
    if (!it) return;
    if (!findReturnShelf(this.d.furniture, it.productId)) {
      this.c.toast('Không còn chỗ trên kệ cho món này', 'error');
      return;
    }
    this.takeLoose(uid);
    this.returnToShelf(it.productId, new THREE.Vector3(it.x, 0.1, it.z));
  }

  get count(): number {
    return this.d.dirt.length;
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.group.clear();
    this.views.clear();
  }
}
