import type Phaser from 'phaser';
import { getFurniture } from '../../config/furniture';
import type { Services } from '../../core/Services';
import type { Customer } from '../../entities/Customer';
import { StaffNpc, type StaffWorld } from '../../entities/Staff';
import type { CustomerManager } from './CustomerManager';
import type { FurnitureManager } from './FurnitureManager';

export class StaffManager implements StaffWorld {
  private npcs = new Map<string, StaffNpc>();
  reserved = new Set<string>();
  /** Quầy người chơi đang đứng (null nếu không). */
  playerCounter: string | null = null;
  private off: () => void;

  constructor(public scene: Phaser.Scene, public s: Services, private customers: CustomerManager, private furniture: FurnitureManager) {
    this.sync();
    this.off = s.bus.on('staff:changed', () => this.sync());
  }

  frontCustomer(counterUid: string): Customer | null {
    return this.customers.frontCustomer(counterUid);
  }

  isPlayerAtCounter(counterUid: string): boolean {
    return this.playerCounter === counterUid;
  }

  shakeFurniture(uid: string): void {
    this.furniture.get(uid)?.shake();
  }

  hasCashierAt(counterUid: string): boolean {
    for (const n of this.npcs.values()) if (n.counterUid === counterUid) return true;
    return false;
  }

  sync(): void {
    const ids = new Set(this.s.data.staff.map((x) => x.uid));
    for (const [uid, npc] of this.npcs) {
      if (!ids.has(uid)) {
        npc.destroy();
        this.npcs.delete(uid);
      }
    }
    for (const data of this.s.data.staff) {
      if (!this.npcs.has(data.uid)) this.npcs.set(data.uid, new StaffNpc(this, data, this.s.grid.doorInside));
    }
    this.assignCounters();
  }

  assignCounters(): void {
    const counters = this.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'checkout').map((f) => f.uid);
    const taken = new Set<string>();
    for (const npc of this.npcs.values()) {
      if (npc.data.role !== 'cashier') continue;
      if (npc.counterUid && counters.includes(npc.counterUid) && !taken.has(npc.counterUid)) {
        taken.add(npc.counterUid);
      } else {
        npc.counterUid = null;
      }
    }
    for (const npc of this.npcs.values()) {
      if (npc.data.role !== 'cashier' || npc.counterUid) continue;
      const free = counters.find((c) => !taken.has(c));
      if (free) {
        npc.counterUid = free;
        taken.add(free);
      }
    }
  }

  update(sim: number, dtMs: number): void {
    for (const npc of this.npcs.values()) npc.update(sim, dtMs);
  }

  all(): StaffNpc[] {
    return [...this.npcs.values()];
  }

  destroy(): void {
    this.off();
    this.npcs.forEach((n) => n.view.destroy());
    this.npcs.clear();
  }
}
