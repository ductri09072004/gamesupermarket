import * as THREE from 'three';
import { NPC_ANIM_CULL_DISTANCE } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { Customer } from '../entities/Customer';
import { StaffNpc, type StaffWorld } from '../entities/Staff';
import { productMesh } from '../products/PackagingFactory';
import type { GameCtx } from './Ctx';
import type { CustomerManager } from './CustomerManager';
import type { KioskHelpApi } from '../entities/StaffHelper';
import type { MessApi, SecurityApi } from '../entities/Staff';
import { DOOR_WIDTH, DOOR_X } from '../config/constants';
import { adjacentTiles, footprintCells, type GridPoint } from '../world/Footprint';
import { m2c } from '../world/NavGrid';

export class StaffManager implements StaffWorld {
  readonly group = new THREE.Group();
  private npcs = new Map<string, StaffNpc>();
  reserved = new Set<string>();
  playerCounter: string | null = null;
  private off: () => void;

  constructor(private c: GameCtx, private customers: CustomerManager, readonly kiosks: KioskHelpApi, readonly mess: MessApi, readonly security: SecurityApi) {
    this.off = c.s.bus.on('staff:changed', () => this.sync());
    this.sync();
  }

  get s() {
    return this.c.s;
  }

  frontCustomer(counterUid: string): Customer | null {
    return this.customers.frontCustomer(counterUid);
  }

  isPlayerAtCounter(counterUid: string): boolean {
    return this.playerCounter === counterUid;
  }

  shakeFurniture(uid: string): void {
    this.c.furniture.get(uid)?.shake();
  }

  stockFx(furnUid: string, slot: number, from: THREE.Vector3): void {
    const f = this.s.state.furniture(furnUid);
    const s = f?.slots[slot];
    if (!f || !s?.productId) return;
    const to = this.c.products.itemWorld(f, slot, s.productId, s.qty - 1);
    this.c.products.hold(f.uid, slot, 1);
    this.c.effects.fly(productMesh(s.productId), from, to, {
      dur: 0.2, arc: 0.08, onDone: () => this.c.products.hold(f.uid, slot, -1),
    });
    this.c.sound('tock', to, 0.9 + Math.random() * 0.2);
  }

  saleFx(amount: number, at: THREE.Vector3): void {
    this.c.effects.floatText(`+$${amount.toFixed(2)}`, at);
  }

  /**
   * Chỗ nghỉ: hàng ô trên vỉa hè sát kính mặt tiền, bắt đầu sau biển Mở cửa & ô giao hàng (bên phải cửa),
   * mỗi nhân viên 1 ô; đông quá thì nối dài sang trước cửa hiệu bên cạnh.
   */
  restSpot(uid: string): GridPoint {
    const g = this.s.grid;
    const i = Math.max(0, this.s.data.staff.findIndex((x) => x.uid === uid));
    const x0 = m2c(DOOR_X + DOOR_WIDTH / 2 + 4.3);
    const spots: GridPoint[] = [];
    for (let gx = x0; spots.length <= i && gx < x0 + 60; gx += 2) if (g.isWalkable(gx, g.sd + 1)) spots.push({ gx, gy: g.sd + 1 });
    return spots[i] ?? spots[spots.length - 1] ?? g.doorOutside;
  }

  exitSpot(): GridPoint {
    return this.s.grid.spawnPoints()[1];
  }

  /** Bảo vệ đứng cạnh cổng an ninh (không đứng giữa lối đi), không có cổng thì đứng trong cửa, lệch sang bên. */
  guardPost(): GridPoint[] {
    const g = this.s.grid;
    const door = g.doorInside;
    const lane = (p: GridPoint) => Math.abs(p.gx - door.gx) <= 1 && p.gy >= door.gy - 1;
    const gate = this.s.data.furniture.find((f) => getFurniture(f.type).kind === 'gate');
    const base = gate ? footprintCells(getFurniture(gate.type), gate.gx, gate.gy, gate.rot) : [{ gx: door.gx - 3, gy: door.gy }, { gx: door.gx + 3, gy: door.gy }];
    const cand = gate ? adjacentTiles(base) : base.flatMap((p) => [p, ...adjacentTiles([p])]);
    return cand.filter((p) => g.isWalkable(p.gx, p.gy) && g.isStoreInterior(p.gx, p.gy) && !lane(p));
  }

  sync(): void {
    const ids = new Set(this.s.data.staff.map((x) => x.uid));
    for (const [uid, npc] of this.npcs) {
      if (ids.has(uid)) continue;
      npc.destroy();
      this.npcs.delete(uid);
    }
    const fresh: StaffNpc[] = [];
    for (const data of this.s.data.staff) {
      if (this.npcs.has(data.uid)) continue;
      const npc = new StaffNpc(this, data, this.s.grid.doorInside);
      this.group.add(npc.human.root);
      this.npcs.set(data.uid, npc);
      fresh.push(npc);
    }
    this.assignCounters();
    // thu ngân không có quầy trống: không xuất hiện (khi có quầy sẽ từ vỉa hè đi vào)
    for (const npc of fresh) if (npc.data.role === 'cashier' && !npc.counterUid) npc.hide();
  }

  assignCounters(): void {
    const counters = this.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'checkout').map((f) => f.uid);
    const taken = new Set<string>();
    for (const npc of this.npcs.values()) {
      if (npc.data.role !== 'cashier') continue;
      if (npc.counterUid && counters.includes(npc.counterUid) && !taken.has(npc.counterUid)) taken.add(npc.counterUid);
      else npc.counterUid = null;
    }
    for (const npc of this.npcs.values()) {
      if (npc.data.role !== 'cashier' || npc.counterUid) continue;
      const free = counters.find((x) => !taken.has(x));
      if (free) {
        npc.counterUid = free;
        taken.add(free);
      }
    }
  }

  update(sim: number, dt: number): void {
    const cam = this.c.camera.position;
    for (const npc of this.npcs.values()) {
      npc.tick(sim, dt);
      npc.update(sim > 0 ? dt : 0, cam, NPC_ANIM_CULL_DISTANCE);
    }
  }

  /** Nhân viên đang có mặt (không tính thu ngân dư đang ẩn). */
  all(): StaffNpc[] {
    return [...this.npcs.values()].filter((n) => n.onDuty);
  }

  destroy(): void {
    this.off();
    this.npcs.forEach((n) => n.dispose());
    this.npcs.clear();
  }
}
