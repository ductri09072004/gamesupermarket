import type Phaser from 'phaser';
import { CUSTOMER_SPEED, PICK_TIME_S, QUEUE_PATIENCE_S, REP_OUT_OF_STOCK, REP_TOO_EXPENSIVE, REP_WALKOUT } from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import type { Services } from '../core/Services';
import { adjacentTiles, distanceToCells, footprintCells } from '../iso/Footprint';
import type { GridPoint } from '../iso/IsoMath';
import type { CheckoutItem } from '../systems/CheckoutSystem';
import type { Wish } from '../systems/CustomerSystem';
import { findProductLocations, productQty } from '../systems/InventorySystem';
import { decidePurchase } from '../systems/PricingSystem';
import { CharacterView, PathFollower } from './Character';
import type { Look } from '../render/CharacterArt';

export type CustomerState = 'enter' | 'browse' | 'toShelf' | 'pick' | 'toQueue' | 'queue' | 'served' | 'leave' | 'gone';

export interface CustomerWorld {
  s: Services;
  scene: Phaser.Scene;
  shakeFurniture(uid: string): void;
  joinQueue(c: Customer): boolean;
  leaveQueue(c: Customer): void;
}

let nextId = 1;

export class Customer {
  readonly id = `c${nextId++}`;
  readonly view: CharacterView;
  state: CustomerState = 'enter';
  basket: CheckoutItem[] = [];
  counterUid: string | null = null;
  queueTile: GridPoint | null = null;
  patience = 0;
  private follower = new PathFollower();
  private timer = 0;
  private target: { furn: FurnitureData; wish: Wish } | null = null;
  private stuckTimer = 0;
  private queuePathOk = false;

  constructor(
    private world: CustomerWorld,
    look: Look,
    spawn: GridPoint,
    private exit: GridPoint,
    private wishes: Wish[],
    pooled: CharacterView | null = null,
  ) {
    if (pooled) {
      this.view = pooled;
      pooled.setLook(look);
      pooled.setPosition(spawn.gx + 0.5, spawn.gy + 0.5);
      pooled.setVisible(true);
    } else {
      this.view = new CharacterView(world.scene, look, spawn.gx + 0.5, spawn.gy + 0.5);
    }
    this.walkTo(world.s.grid.doorInside);
  }

  get gx(): number { return this.view.gx; }
  get gy(): number { return this.view.gy; }
  get tile(): GridPoint { return this.view.tile; }
  get pathRemaining(): GridPoint[] { return this.follower.remaining; }

  private walkTo(goals: GridPoint | GridPoint[]): boolean {
    const path = this.world.s.paths.find(this.tile, goals);
    const list = Array.isArray(goals) ? goals : [goals];
    this.follower.setPath(path, path ? path[path.length - 1] : list[0]);
    return !!path;
  }

  private say(text: string, ms = 1600): void {
    this.view.showBubble(text, ms);
  }

  update(sim: number, dtMs: number): void {
    const moving = this.move(sim);
    this.view.animate(dtMs * (sim > 0 ? 1 : 0), moving);
    if (this.state === 'toQueue' || this.state === 'queue') {
      this.patience += sim;
      if (this.patience > QUEUE_PATIENCE_S) this.walkout();
    }
    if (moving) return;
    switch (this.state) {
      case 'enter':
        if (!this.world.s.data.storeOpen) {
          this.say('Đóng cửa rồi à... 😕');
          this.leave();
        } else {
          this.state = 'browse';
        }
        break;
      case 'browse':
        this.timer -= sim;
        if (this.timer <= 0) this.nextWish();
        break;
      case 'toShelf':
        this.state = 'pick';
        this.timer = PICK_TIME_S;
        if (this.target) {
          const c = distanceToCells(this.gx, this.gy, footprintCells(getFurniture(this.target.furn.type), this.target.furn.gx, this.target.furn.gy, this.target.furn.rot)).cell;
          this.view.face(c.gx + 0.5 - this.gx, c.gy + 0.5 - this.gy);
        }
        break;
      case 'pick':
        this.timer -= sim;
        if (this.timer <= 0) this.pick();
        break;
      case 'toQueue':
        if (this.queueTile && this.tile.gx === this.queueTile.gx && this.tile.gy === this.queueTile.gy) this.state = 'queue';
        break;
      case 'leave':
        this.state = 'gone';
        break;
      default:
        break;
    }
  }

  /** Di chuyển theo path; trả true nếu còn đang đi. */
  private move(sim: number): boolean {
    if (this.follower.done || sim <= 0) return !this.follower.done;
    const next = this.follower.next;
    const grid = this.world.s.grid;
    if (next && !grid.isWalkable(next.gx, next.gy)) {
      // lưới thay đổi (đặt nội thất) → tìm đường lại
      this.stuckTimer += sim;
      if (this.stuckTimer > 0.3 && this.follower.goal) {
        this.stuckTimer = 0;
        if (!this.walkTo(this.follower.goal)) this.follower.clear();
      }
      return true;
    }
    const r = this.follower.step(this.gx, this.gy, CUSTOMER_SPEED * sim);
    this.view.face(r.dx, r.dy);
    this.view.setPosition(r.gx, r.gy);
    return !r.arrived;
  }

  private nextWish(): void {
    const wish = this.wishes.shift();
    if (!wish) {
      this.finishShopping();
      return;
    }
    const p = getProduct(wish.productId);
    const s = this.world.s;
    const shelves = findProductLocations(s.data.furniture, wish.productId);
    if (shelves.length === 0) {
      this.say(`${p.icon} Hết hàng :(`);
      s.progression.changeReputation(REP_OUT_OF_STOCK);
      this.timer = 1.1;
      return;
    }
    const goals: GridPoint[] = [];
    for (const f of shelves) {
      for (const t of adjacentTiles(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot))) {
        if (s.grid.isWalkable(t.gx, t.gy) && s.grid.isStoreInterior(t.gx, t.gy)) goals.push(t);
      }
    }
    if (!this.walkTo(goals)) {
      this.say(`${p.icon} ???`);
      this.timer = 0.8;
      return;
    }
    const end = this.follower.goal!;
    const furn = shelves.reduce((best, f) => {
      const d = distanceToCells(end.gx + 0.5, end.gy + 0.5, footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot)).dist;
      const bd = distanceToCells(end.gx + 0.5, end.gy + 0.5, footprintCells(getFurniture(best.type), best.gx, best.gy, best.rot)).dist;
      return d < bd ? f : best;
    }, shelves[0]);
    this.target = { furn, wish };
    this.state = 'toShelf';
    this.view.showBubble(`💭 ${p.icon}`, 0);
  }

  private pick(): void {
    const s = this.world.s;
    const t = this.target;
    this.target = null;
    this.state = 'browse';
    this.timer = 0.2;
    if (!t) return;
    const p = getProduct(t.wish.productId);
    if (!s.state.furniture(t.furn.uid) || productQty(t.furn, p.id) <= 0) {
      this.say(`${p.icon} Hết hàng :(`);
      s.progression.changeReputation(REP_OUT_OF_STOCK);
      return;
    }
    const price = s.state.priceOf(p.id);
    const decision = decidePurchase(price, s.market(p.id), s.rng());
    if (decision === 'expensive') {
      this.say('💸 Đắt quá!');
      s.progression.changeReputation(REP_TOO_EXPENSIVE);
      this.timer = 0.8;
      return;
    }
    if (decision === 'skip') {
      this.say('🤔 Hơi đắt...');
      this.timer = 0.6;
      return;
    }
    const taken = s.inventory.customerTake(t.furn, p.id, t.wish.qty);
    for (let i = 0; i < taken; i++) this.basket.push({ productId: p.id, price, cost: p.costPerUnit, scanned: false });
    this.world.shakeFurniture(t.furn.uid);
    this.view.hideBubble();
    this.world.s.bus.emit('sound', { name: 'pop' });
  }

  private finishShopping(): void {
    if (this.basket.length === 0) {
      this.say('😞');
      this.leave();
      return;
    }
    this.view.showBubble(`🛒 ${this.basket.length}`, 1200);
    this.state = 'toQueue';
    this.patience = 0;
    if (!this.world.joinQueue(this)) {
      this.say('Không có quầy?! 😠');
      this.world.s.data.stats.walkouts += 1;
      this.leave();
    }
  }

  /** Manager gán ô xếp hàng mới. */
  setQueueTile(tile: GridPoint): void {
    const same = !!this.queueTile && this.queueTile.gx === tile.gx && this.queueTile.gy === tile.gy;
    if (same && this.queuePathOk) return;
    this.queueTile = tile;
    if (this.state !== 'toQueue' && this.state !== 'queue') return;
    this.state = 'toQueue';
    this.queuePathOk = this.walkTo(tile);
    if (!this.queuePathOk) this.follower.clear();
  }

  isReadyAtCounter(): boolean {
    if (this.state !== 'queue' || !this.queueTile) return false;
    const t = this.tile;
    return t.gx === this.queueTile.gx && t.gy === this.queueTile.gy;
  }

  beginService(): void {
    this.state = 'served';
    this.view.hideBubble();
  }

  /** Thu ngân rời quầy giữa chừng → khách tiếp tục chờ. */
  cancelService(): void {
    if (this.state === 'served') this.state = 'queue';
    for (const it of this.basket) it.scanned = false;
  }

  finishCheckout(happy: boolean): void {
    this.say(happy ? '😊 Cảm ơn!' : '😠');
    this.leave();
  }

  private walkout(): void {
    const s = this.world.s;
    this.say('😠 Chờ lâu quá!', 2200);
    s.data.stats.walkouts += 1;
    s.progression.changeReputation(REP_WALKOUT);
    this.leave();
  }

  leave(): void {
    this.queuePathOk = false;
    this.world.leaveQueue(this);
    this.counterUid = null;
    this.queueTile = null;
    this.state = 'leave';
    if (!this.walkTo(this.exit)) this.state = 'gone';
  }

  /** Trả view về pool (ẩn đi). */
  release(): CharacterView {
    this.view.hideBubble();
    this.view.setStatus(null);
    this.view.setVisible(false);
    return this.view;
  }
}
