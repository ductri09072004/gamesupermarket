import * as THREE from 'three';
import {
  CUSTOMER_SPEED, DARK_THRESHOLD, PICK_TIME_S, QUEUE_PATIENCE_S, REP_OUT_OF_STOCK, REP_TOO_DARK, REP_TOO_EXPENSIVE, REP_WALKOUT,
} from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import { SECURITY } from '../config/hygiene';
import type { FurnitureData } from '../core/GameState';
import type { Services } from '../core/Services';
import type { CheckoutItem } from '../systems/CheckoutSystem';
import type { Wish } from '../systems/CustomerSystem';
import { findProductLocations, productQty } from '../systems/InventorySystem';
import { decidePurchase } from '../systems/PricingSystem';
import { vendingSale } from '../systems/SalesSystem';
import type { GridPoint } from '../world/Footprint';
import { nearestFurniture, shelfFrontGoals } from '../world/ShelfGoals';
import { cellCenter } from '../world/NavGrid';
import { furnitureCenter } from '../world/Placement';
import { Basket } from './Basket';
import type { HumanLook } from './Human';
import { Walker } from './Walker';

export type CustomerState = 'enter' | 'browse' | 'toShelf' | 'pick' | 'toQueue' | 'queue' | 'served' | 'flee' | 'stunned' | 'leave' | 'gone';

export interface CustomerWorld {
  s: Services;
  shakeFurniture(uid: string): void;
  joinQueue(c: Customer): boolean;
  leaveQueue(c: Customer): void;
  /** Món bay từ kệ vào giỏ */
  pickFx(c: Customer, furn: FurnitureData, productId: string): void;
  doorBell(): void;
  /** Độ sáng trong cửa hàng 0..1 (ánh ngày + đèn) */
  brightness(): number;
}

let nextId = 1;

/** Khách 3D: ENTER → BROWSE → tới kệ → lấy hàng → QUEUE → CHECKOUT → LEAVE. */
export class Customer extends Walker {
  readonly id = `c${nextId++}`;
  state: CustomerState = 'enter';
  basketItems: CheckoutItem[] = [];
  readonly basket = new Basket();
  counterUid: string | null = null;
  queueTile: GridPoint | null = null;
  patience = 0;
  private timer = 0;
  private target: { furn: FurnitureData; wish: Wish } | null = null;
  private queuePathOk = false;
  private enteredDoor = false;
  carryingBag = false;
  /** Số món đã mua ở máy bán hàng tự động (đã trả tiền tại máy) */
  private vended = 0;
  /** Khách lớn tuổi (model OldClassy) — dễ bí khi dùng máy tự tính tiền */
  readonly elder: boolean;
  /** Lén mang hàng ra không trả tiền; alarmed: cổng an ninh đã hú */
  thief = false;
  alarmed = false;

  constructor(private world: CustomerWorld, look: HumanLook, spawn: GridPoint, private exit: GridPoint, private wishes: Wish[]) {
    super(world.s, look, cellCenter(spawn.gx, spawn.gy).x, cellCenter(spawn.gx, spawn.gy).z);
    this.human.handL.add(this.basket.group);
    this.human.holding = true;
    this.elder = !!look.model?.startsWith('Old');
    this.walkTo(world.s.grid.doorInside);
  }

  say(text: string, ms = 1700): void {
    this.bubble.show(text, ms);
  }

  tick(sim: number, dt: number): void {
    const run = this.state === 'flee' ? (this.alarmed ? SECURITY.thiefRun : 1.15) : 1;
    const moving = this.step(CUSTOMER_SPEED * run * sim, sim > 0 ? dt : 0);
    if (!this.enteredDoor && this.z < this.s.grid.storeH - 0.2 && this.state === 'enter') {
      this.enteredDoor = true;
      this.world.doorBell();
    }
    if (this.state === 'toQueue' || this.state === 'queue') {
      this.patience += sim;
      if (this.patience > QUEUE_PATIENCE_S) this.walkout();
    }
    if (moving || sim <= 0) return;
    switch (this.state) {
      case 'enter':
        if (!this.s.data.storeOpen) {
          this.say('Đóng cửa rồi à... 😕');
          this.leave();
        } else if (this.world.brightness() < DARK_THRESHOLD) {
          this.say('😨 Tối om vậy, thôi về...', 2000);
          this.s.data.stats.walkouts += 1;
          this.s.progression.changeReputation(REP_TOO_DARK);
          this.leave();
        } else this.state = 'browse';
        break;
      case 'browse':
        this.timer -= sim;
        if (this.timer <= 0) this.nextWish();
        break;
      case 'toShelf': {
        this.state = 'pick';
        this.timer = PICK_TIME_S;
        if (this.target) {
          const c = furnitureCenter(this.target.furn);
          this.face(c.x, c.z);
          this.human.reach();
        }
        break;
      }
      case 'pick':
        this.timer -= sim;
        if (this.timer <= 0) this.pick();
        break;
      case 'toQueue':
        if (this.queueTile && this.cell.gx === this.queueTile.gx && this.cell.gy === this.queueTile.gy) this.state = 'queue';
        else if (this.queueTile && !this.queuePathOk) this.queuePathOk = this.walkTo(this.queueTile);
        break;
      case 'stunned':
        this.timer -= sim;
        if (this.timer <= 0) this.leave();
        break;
      case 'flee':
      case 'leave':
        this.state = 'gone';
        break;
      default:
        break;
    }
  }

  private nextWish(): void {
    const wish = this.wishes.shift();
    if (!wish) {
      this.finishShopping();
      return;
    }
    const p = getProduct(wish.productId);
    const shelves = findProductLocations(this.s.data.furniture, wish.productId);
    if (shelves.length === 0) {
      this.say(`${p.icon} Hết hàng :(`);
      this.s.progression.changeReputation(REP_OUT_OF_STOCK);
      this.timer = 1.2;
      return;
    }
    if (!this.walkTo(shelfFrontGoals(this.s.grid, shelves))) {
      this.say(`${p.icon} ???`);
      this.timer = 0.8;
      return;
    }
    this.target = { furn: nearestFurniture(shelves, this.goal!), wish };
    this.state = 'toShelf';
    this.bubble.show(`💭 ${p.icon}`, 0);
  }

  private pick(): void {
    const t = this.target;
    this.target = null;
    this.state = 'browse';
    this.timer = 0.3;
    this.faceTarget = null;
    if (!t) return;
    const p = getProduct(t.wish.productId);
    if (!this.s.state.furniture(t.furn.uid) || productQty(t.furn, p.id) <= 0) {
      this.say(`${p.icon} Hết hàng :(`);
      this.s.progression.changeReputation(REP_OUT_OF_STOCK);
      return;
    }
    const price = this.s.state.priceOf(p.id);
    const decision = decidePurchase(price, this.s.market(p.id), this.s.rng());
    if (decision === 'expensive') {
      this.say('💸 Đắt quá!');
      this.s.progression.changeReputation(REP_TOO_EXPENSIVE);
      this.timer = 0.9;
      return;
    }
    if (decision === 'skip') {
      this.say('🤔 Hơi đắt...');
      this.timer = 0.7;
      return;
    }
    const want = t.wish.qty;
    const vending = getFurniture(t.furn.type).vending;
    for (let i = 0; i < want; i++) {
      this.world.pickFx(this, t.furn, p.id);
      const taken = this.s.inventory.customerTake(t.furn, p.id, 1);
      if (taken <= 0) break;
      if (vending) {
        vendingSale(this.s, price, p.costPerUnit, this.cell);
        this.vended += 1;
      } else this.basketItems.push({ productId: p.id, price, cost: p.costPerUnit, scanned: false });
    }
    this.world.shakeFurniture(t.furn.uid);
    if (vending) this.say('🥤 Tiện ghê!', 1200);
    else this.bubble.hide();
  }

  private finishShopping(): void {
    if (this.basketItems.length === 0) {
      if (this.vended > 0) this.s.data.stats.customers += 1;
      this.say(this.vended > 0 ? '😋' : '😞');
      this.leave();
      return;
    }
    if (this.s.rng() < SECURITY.theftChance) {
      this.sneakOut();
      return;
    }
    this.bubble.show(`🛒 ${this.basketItems.length}`, 1200);
    this.state = 'toQueue';
    this.patience = 0;
    if (!this.world.joinQueue(this)) {
      this.say('Không có quầy?! 😠');
      this.s.data.stats.walkouts += 1;
      this.leave();
    }
  }

  setQueueTile(tile: GridPoint): void {
    const same = !!this.queueTile && this.queueTile.gx === tile.gx && this.queueTile.gy === tile.gy;
    if (same && this.queuePathOk) return;
    this.queueTile = tile;
    if (this.state !== 'toQueue' && this.state !== 'queue') return;
    this.state = 'toQueue';
    this.queuePathOk = this.walkTo(tile);
  }

  isReadyAtCounter(): boolean {
    if (this.state !== 'queue' || !this.queueTile) return false;
    return this.cell.gx === this.queueTile.gx && this.cell.gy === this.queueTile.gy;
  }

  beginService(counterPos: { x: number; z: number }): void {
    this.state = 'served';
    this.bubble.hide();
    this.face(counterPos.x, counterPos.z);
  }

  cancelService(): void {
    if (this.state === 'served') this.state = 'queue';
    for (const it of this.basketItems) it.scanned = false;
  }

  finishCheckout(happy: boolean, bag?: THREE.Object3D): void {
    this.say(happy ? '😊 Cảm ơn!' : '😠');
    if (bag) {
      bag.position.set(0, -0.3, 0);
      this.human.handR.add(bag);
      this.carryingBag = true;
    }
    this.leave();
  }

  /** Lén cầm giỏ đi thẳng ra cửa, không qua quầy. */
  private sneakOut(): void {
    this.thief = true;
    this.state = 'flee';
    this.bubble.hide();
    if (!this.walkTo(this.exit)) this.state = 'gone';
  }

  /** Cổng an ninh hú còi → bỏ chạy. */
  alarm(): void {
    this.alarmed = true;
    this.say('😱', 1500);
    if (!this.walkTo(this.exit)) this.state = 'gone';
  }

  /** Bị tóm: đứng khựng (hàng đã văng ra) rồi đi về tay không. Trả về các món đang giấu. */
  caught(): string[] {
    const items = this.basketItems.map((i) => i.productId);
    this.basketItems = [];
    while (this.basket.takeOut()) { /* xoá hết món trong giỏ */ }
    this.thief = false;
    this.alarmed = false;
    this.stop();
    this.state = 'stunned';
    this.timer = 1.4;
    this.say('😵 Ui da! Em xin lỗi...', 2200);
    return items;
  }

  walkout(message = '😠 Chờ lâu quá!'): void {
    this.say(message, 2200);
    this.s.data.stats.walkouts += 1;
    this.s.progression.changeReputation(REP_WALKOUT);
    this.leave();
  }

  leave(): void {
    this.queuePathOk = false;
    this.world.leaveQueue(this);
    this.counterUid = null;
    this.queueTile = null;
    this.faceTarget = null;
    this.state = 'leave';
    if (!this.walkTo(this.exit)) this.state = 'gone';
  }
}
