import type Phaser from 'phaser';
import { MAX_CUSTOMERS, MINUTES_PER_SECOND } from '../../config/constants';
import { getFurniture } from '../../config/furniture';
import type { FurnitureData } from '../../core/GameState';
import type { Services } from '../../core/Services';
import { pick } from '../../core/Random';
import { computeQueueTiles } from '../../entities/Checkout';
import type { CharacterView } from '../../entities/Character';
import { Customer, type CustomerWorld } from '../../entities/Customer';
import type { GridPoint } from '../../iso/IsoMath';
import { gridToScreen } from '../../iso/IsoMath';
import { HAIRS, SHIRTS, SKINS } from '../../render/CharacterArt';
import { generateWishlist, SpawnAccumulator, spawnRatePerHour } from '../../systems/CustomerSystem';
import { stockedProductIds } from '../../systems/InventorySystem';
import type { FurnitureManager } from './FurnitureManager';

export class CustomerManager implements CustomerWorld {
  customers: Customer[] = [];
  private queues = new Map<string, Customer[]>();
  private queueCache = new Map<string, { version: number; tiles: GridPoint[] }>();
  private spawner: SpawnAccumulator;
  private pool: CharacterView[] = [];
  private lastCount = -1;

  constructor(public scene: Phaser.Scene, public s: Services, private furniture: FurnitureManager) {
    this.spawner = new SpawnAccumulator(s.rng);
  }

  shakeFurniture(uid: string): void {
    this.furniture.get(uid)?.shake();
  }

  counters(): FurnitureData[] {
    return this.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'checkout');
  }

  queueTiles(counter: FurnitureData): GridPoint[] {
    const v = this.s.grid.version;
    const key = `${counter.uid}:${counter.gx},${counter.gy},${counter.rot}`;
    const c = this.queueCache.get(key);
    if (c && c.version === v) return c.tiles;
    const tiles = computeQueueTiles(this.s.grid, counter);
    this.queueCache.set(key, { version: v, tiles });
    return tiles;
  }

  joinQueue(c: Customer): boolean {
    const counters = this.counters();
    if (counters.length === 0) return false;
    let best = counters[0];
    let bestLen = Infinity;
    for (const k of counters) {
      const len = this.queues.get(k.uid)?.length ?? 0;
      if (len < bestLen) { best = k; bestLen = len; }
    }
    const q = this.queues.get(best.uid) ?? [];
    q.push(c);
    this.queues.set(best.uid, q);
    c.counterUid = best.uid;
    this.assignQueueTiles();
    return true;
  }

  leaveQueue(c: Customer): void {
    if (!c.counterUid) return;
    const q = this.queues.get(c.counterUid);
    if (q) this.queues.set(c.counterUid, q.filter((x) => x !== c));
  }

  queueLength(counterUid: string): number {
    return this.queues.get(counterUid)?.length ?? 0;
  }

  /** Khách đầu hàng đã đứng ở quầy (hoặc đang được phục vụ). */
  frontCustomer(counterUid: string): Customer | null {
    const c = this.queues.get(counterUid)?.[0];
    if (!c) return null;
    return c.state === 'served' || c.isReadyAtCounter() ? c : null;
  }

  private assignQueueTiles(): void {
    for (const [uid, q] of this.queues) {
      const counter = this.s.state.furniture(uid);
      if (!counter) continue;
      const tiles = this.queueTiles(counter);
      q.forEach((c, i) => {
        if (c.state === 'served') return;
        c.setQueueTile(tiles[Math.min(i, tiles.length - 1)]);
      });
    }
  }

  /** Quầy bị nhấc/bán → khách trong hàng chuyển sang quầy khác. */
  onFurnitureChanged(): void {
    for (const [uid, q] of [...this.queues]) {
      if (this.s.state.furniture(uid)) continue;
      this.queues.delete(uid);
      for (const c of q) {
        c.cancelService();
        c.counterUid = null;
        if (!this.joinQueue(c)) c.leave();
      }
    }
    this.assignQueueTiles();
  }

  spawn(): void {
    const s = this.s;
    const spawns = s.grid.spawnPoints();
    const from = pick(s.rng, spawns);
    const exit = pick(s.rng, spawns);
    const wishes = generateWishlist(s.state.unlockedProducts(), stockedProductIds(s.data.furniture), s.rng);
    const look = { shirt: pick(s.rng, SHIRTS), hair: pick(s.rng, HAIRS), skin: pick(s.rng, SKINS) };
    this.customers.push(new Customer(this, look, from, exit, wishes, this.pool.pop() ?? null));
  }

  update(sim: number, dtMs: number): void {
    const s = this.s;
    if (sim > 0 && s.data.storeOpen && s.time.isOpenHours()) {
      const rate = spawnRatePerHour(s.time.hour, s.data.reputation, s.data.storeW, s.data.storeH);
      const n = this.spawner.tick(sim * MINUTES_PER_SECOND, rate);
      for (let i = 0; i < n && this.customers.length < MAX_CUSTOMERS; i++) this.spawn();
    }
    for (const c of this.customers) c.update(sim, dtMs);
    if (this.customers.some((c) => c.state === 'gone')) {
      for (const c of this.customers) if (c.state === 'gone') this.pool.push(c.release());
      this.customers = this.customers.filter((c) => c.state !== 'gone');
    }
    this.assignQueueTiles();
    s.customerCount = this.customers.length;
    if (s.customerCount !== this.lastCount) {
      this.lastCount = s.customerCount;
      s.bus.emit('customer:count', { count: s.customerCount });
    }
  }

  debugDraw(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, 0xff006e, 0.8);
    for (const c of this.customers) {
      const pts = c.pathRemaining;
      let prev = gridToScreen(c.gx, c.gy);
      for (const p of pts) {
        const q = gridToScreen(p.gx + 0.5, p.gy + 0.5);
        g.lineBetween(prev.x, prev.y, q.x, q.y);
        prev = q;
      }
    }
    g.lineStyle(2, 0x3a86ff, 0.8);
    for (const counter of this.counters()) {
      for (const t of this.queueTiles(counter)) {
        const p = gridToScreen(t.gx + 0.5, t.gy + 0.5);
        g.strokeCircle(p.x, p.y, 5);
      }
    }
  }

  clear(): void {
    for (const c of this.customers) c.release().destroy();
    for (const v of this.pool) v.destroy();
    this.customers = [];
    this.pool = [];
    this.queues.clear();
  }
}
