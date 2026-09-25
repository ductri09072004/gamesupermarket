import * as THREE from 'three';
import { MAX_CUSTOMERS, MINUTES_PER_SECOND, NPC_ANIM_CULL_DISTANCE } from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import { pick } from '../core/Random';
import { Customer, type CustomerWorld } from '../entities/Customer';
import { HAIRS, PANTS, SHIRTS, SKINS } from '../entities/Human';
import { productMesh } from '../products/PackagingFactory';
import { generateWishlist, SpawnAccumulator, spawnRatePerHour } from '../systems/CustomerSystem';
import { stockedProductIds } from '../systems/InventorySystem';
import type { GridPoint } from '../world/Footprint';
import { computeQueueTiles } from '../world/Queue';
import type { GameCtx } from './Ctx';

export class CustomerManager implements CustomerWorld {
  readonly group = new THREE.Group();
  customers: Customer[] = [];
  private queues = new Map<string, Customer[]>();
  private queueCache = new Map<string, { version: number; tiles: GridPoint[] }>();
  private spawner: SpawnAccumulator;
  private lastCount = -1;
  private debugLines: THREE.LineSegments | null = null;

  constructor(private c: GameCtx) {
    this.spawner = new SpawnAccumulator(c.s.rng);
  }

  get s() {
    return this.c.s;
  }

  shakeFurniture(uid: string): void {
    this.c.furniture.get(uid)?.shake();
  }

  doorBell(): void {
    this.c.sound('doorbell', this.c.store.doorCenter.clone().setY(2.4));
  }

  pickFx(cu: Customer, furn: FurnitureData, productId: string): void {
    const slot = furn.slots.findIndex((sl) => sl.productId === productId && sl.qty > 0);
    if (slot < 0) return;
    const from = this.c.products.itemWorld(furn, slot, productId, furn.slots[slot].qty - 1);
    const to = cu.basket.group.getWorldPosition(new THREE.Vector3());
    this.c.effects.fly(productMesh(productId), from, to, {
      dur: 0.35, arc: 0.15, onDone: () => cu.basket.add(productId),
    });
    this.c.sound('pop', from, 1.2);
  }

  counters(): FurnitureData[] {
    return this.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'checkout');
  }

  queueTiles(counter: FurnitureData): GridPoint[] {
    const v = this.s.grid.version;
    const key = `${counter.uid}:${counter.gx},${counter.gy},${counter.rot}`;
    const hit = this.queueCache.get(key);
    if (hit && hit.version === v) return hit.tiles;
    const tiles = computeQueueTiles(this.s.grid, counter);
    this.queueCache.set(key, { version: v, tiles });
    return tiles;
  }

  joinQueue(cu: Customer): boolean {
    const counters = this.counters();
    if (!counters.length) return false;
    let best = counters[0];
    let bestLen = Infinity;
    for (const k of counters) {
      const len = this.queues.get(k.uid)?.length ?? 0;
      if (len < bestLen) { best = k; bestLen = len; }
    }
    const q = this.queues.get(best.uid) ?? [];
    q.push(cu);
    this.queues.set(best.uid, q);
    cu.counterUid = best.uid;
    this.assignQueueTiles();
    return true;
  }

  leaveQueue(cu: Customer): void {
    if (!cu.counterUid) return;
    const q = this.queues.get(cu.counterUid);
    if (q) this.queues.set(cu.counterUid, q.filter((x) => x !== cu));
  }

  frontCustomer(counterUid: string): Customer | null {
    const cu = this.queues.get(counterUid)?.[0];
    if (!cu) return null;
    return cu.state === 'served' || cu.isReadyAtCounter() ? cu : null;
  }

  private assignQueueTiles(): void {
    for (const [uid, q] of this.queues) {
      const counter = this.s.state.furniture(uid);
      if (!counter) continue;
      const tiles = this.queueTiles(counter);
      q.forEach((cu, i) => {
        if (cu.state !== 'served') cu.setQueueTile(tiles[Math.min(i, tiles.length - 1)]);
      });
    }
  }

  onFurnitureChanged(): void {
    for (const [uid, q] of [...this.queues]) {
      if (this.s.state.furniture(uid)) continue;
      this.queues.delete(uid);
      for (const cu of q) {
        cu.cancelService();
        cu.counterUid = null;
        if (!this.joinQueue(cu)) cu.leave();
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
    const look = { shirt: pick(s.rng, SHIRTS), pants: pick(s.rng, PANTS), skin: pick(s.rng, SKINS), hair: pick(s.rng, HAIRS), female: s.rng() < 0.5 };
    const cu = new Customer(this, look, from, exit, wishes);
    this.group.add(cu.human.root);
    this.customers.push(cu);
  }

  update(sim: number, dt: number): void {
    const s = this.s;
    if (sim > 0 && s.data.storeOpen && s.time.isOpenHours()) {
      const rate = spawnRatePerHour(s.time.hour, s.data.reputation, s.data.storeW, s.data.storeH);
      const n = this.spawner.tick(sim * MINUTES_PER_SECOND, rate);
      for (let i = 0; i < n && this.customers.length < MAX_CUSTOMERS; i++) this.spawn();
    }
    const cam = this.c.camera.position;
    for (const cu of this.customers) {
      cu.tick(sim, dt);
      cu.update(sim > 0 ? dt : 0, cam, NPC_ANIM_CULL_DISTANCE);
    }
    if (this.customers.some((cu) => cu.state === 'gone')) {
      for (const cu of this.customers) if (cu.state === 'gone') cu.dispose();
      this.customers = this.customers.filter((cu) => cu.state !== 'gone');
    }
    this.assignQueueTiles();
    s.customerCount = this.customers.length;
    if (s.customerCount !== this.lastCount) {
      this.lastCount = s.customerCount;
      s.bus.emit('customer:count', { count: s.customerCount });
      this.c.audio.setCrowd(s.customerCount);
    }
    if (this.debugLines) this.drawDebug();
  }

  setDebug(on: boolean): void {
    if (on && !this.debugLines) {
      this.debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff006e, depthTest: false }));
      this.debugLines.renderOrder = 999;
      this.group.add(this.debugLines);
    } else if (!on && this.debugLines) {
      this.debugLines.removeFromParent();
      this.debugLines.geometry.dispose();
      this.debugLines = null;
    }
  }

  private drawDebug(): void {
    const pts: number[] = [];
    for (const cu of this.customers) {
      let px = cu.x;
      let pz = cu.z;
      for (const p of cu.remaining) {
        pts.push(px, 0.05, pz, p.x, 0.05, p.y);
        px = p.x;
        pz = p.y;
      }
    }
    this.debugLines!.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }

  clear(): void {
    for (const cu of this.customers) cu.dispose();
    this.customers = [];
    this.queues.clear();
  }

  names(): string[] {
    return this.customers.map((cu) => `${cu.id}:${cu.state}:${cu.basketItems.map((i) => getProduct(i.productId).icon).join('')}`);
  }
}
