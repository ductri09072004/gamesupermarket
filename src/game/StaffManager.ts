import * as THREE from 'three';
import { NPC_ANIM_CULL_DISTANCE } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { Customer } from '../entities/Customer';
import { StaffNpc, type StaffWorld } from '../entities/Staff';
import { productMesh } from '../products/PackagingFactory';
import type { GameCtx } from './Ctx';
import type { CustomerManager } from './CustomerManager';

export class StaffManager implements StaffWorld {
  readonly group = new THREE.Group();
  private npcs = new Map<string, StaffNpc>();
  reserved = new Set<string>();
  playerCounter: string | null = null;
  private off: () => void;

  constructor(private c: GameCtx, private customers: CustomerManager) {
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

  sync(): void {
    const ids = new Set(this.s.data.staff.map((x) => x.uid));
    for (const [uid, npc] of this.npcs) {
      if (ids.has(uid)) continue;
      npc.destroy();
      this.npcs.delete(uid);
    }
    for (const data of this.s.data.staff) {
      if (this.npcs.has(data.uid)) continue;
      const npc = new StaffNpc(this, data, this.s.grid.doorInside);
      this.group.add(npc.human.root);
      this.npcs.set(data.uid, npc);
    }
    this.assignCounters();
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

  all(): StaffNpc[] {
    return [...this.npcs.values()];
  }

  destroy(): void {
    this.off();
    this.npcs.forEach((n) => n.dispose());
    this.npcs.clear();
  }
}
