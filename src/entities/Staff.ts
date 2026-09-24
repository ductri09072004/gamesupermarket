import type Phaser from 'phaser';
import { RESTOCK_THRESHOLD, STAFF_PAY_S, STAFF_SCAN_S, STAFF_SPEED, STAFF_STOCK_S } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { BoxData, StaffData } from '../core/GameState';
import type { Services } from '../core/Services';
import { adjacentTiles, counterTiles, footprintCells } from '../iso/Footprint';
import type { GridPoint } from '../iso/IsoMath';
import { customerCashPayment, itemsTotal, optimalChange, sumCents } from '../systems/CheckoutSystem';
import { restockTargets, type RestockTarget } from '../systems/InventorySystem';
import { completeSale } from '../systems/SalesSystem';
import { HAIRS, SHIRTS, SKINS } from '../render/CharacterArt';
import { boxTextureFor } from './Box';
import { CharacterView, PathFollower } from './Character';
import type { Customer } from './Customer';

export interface StaffWorld {
  s: Services;
  scene: Phaser.Scene;
  frontCustomer(counterUid: string): Customer | null;
  isPlayerAtCounter(counterUid: string): boolean;
  reserved: Set<string>;
  shakeFurniture(uid: string): void;
}

type State = 'idle' | 'walk' | 'toBox' | 'toShelf' | 'stocking' | 'toTrash';

export class StaffNpc {
  readonly view: CharacterView;
  counterUid: string | null = null;
  private follower = new PathFollower();
  private state: State = 'idle';
  private timer = 0;
  private customer: Customer | null = null;
  private serviceTotal = 0;
  private box: BoxData | null = null;
  private target: RestockTarget | null = null;

  constructor(private world: StaffWorld, public data: StaffData, start: GridPoint) {
    const look = { shirt: SHIRTS[data.shirt % SHIRTS.length], hair: HAIRS[data.shirt % HAIRS.length], skin: SKINS[data.shirt % SKINS.length], apron: 0x2a9d8f };
    this.view = new CharacterView(world.scene, look, start.gx + 0.5, start.gy + 0.5);
  }

  get gx(): number { return this.view.gx; }
  get gy(): number { return this.view.gy; }

  private walkTo(goals: GridPoint | GridPoint[]): boolean {
    const path = this.world.s.paths.find(this.view.tile, goals);
    this.follower.setPath(path);
    return !!path;
  }

  private move(sim: number): boolean {
    if (this.follower.done || sim <= 0) return !this.follower.done;
    const r = this.follower.step(this.gx, this.gy, STAFF_SPEED * this.data.speed * sim);
    this.view.face(r.dx, r.dy);
    this.view.setPosition(r.gx, r.gy);
    return !r.arrived;
  }

  update(sim: number, dtMs: number): void {
    const moving = this.move(sim);
    this.view.animate(sim > 0 ? dtMs : 0, moving);
    if (moving || sim <= 0) return;
    if (this.data.role === 'cashier') this.updateCashier(sim);
    else this.updateStocker(sim);
  }

  // ---------- Thu ngân ----------
  private updateCashier(sim: number): void {
    const s = this.world.s;
    const counter = this.counterUid ? s.state.furniture(this.counterUid) : undefined;
    if (!counter) {
      this.view.setStatus('😴 Rảnh');
      return;
    }
    const staffTile = counterTiles(counter.gx, counter.gy, counter.rot).staff;
    const t = this.view.tile;
    const atPost = t.gx === staffTile.gx && t.gy === staffTile.gy;
    if (this.world.isPlayerAtCounter(counter.uid)) {
      if (this.customer) { this.customer.cancelService(); this.customer = null; }
      if (atPost) {
        const spots = adjacentTiles([staffTile]).filter((p) => s.grid.isWalkable(p.gx, p.gy));
        if (spots.length) this.walkTo(spots);
      }
      this.view.setStatus('🙇 Nhường quầy');
      return;
    }
    if (!atPost) {
      this.view.setStatus('🚶 Tới quầy');
      if (!this.walkTo(staffTile)) this.view.setStatus('😴 Rảnh');
      return;
    }
    this.view.face(counter.gx + 0.5 - this.gx, counter.gy + 0.5 - this.gy);
    if (!this.customer) {
      const c = this.world.frontCustomer(counter.uid);
      if (!c || c.state === 'served') {
        this.view.setStatus('😴 Rảnh');
        return;
      }
      c.beginService();
      this.customer = c;
      this.serviceTotal = (c.basket.length * STAFF_SCAN_S + STAFF_PAY_S) / this.data.speed;
      this.timer = this.serviceTotal;
      this.view.setStatus('🧾 Đang tính tiền');
    }
    this.timer -= sim;
    if (this.timer > 0) {
      if (Math.random() < sim * 2) s.bus.emit('sound', { name: 'beep' });
      return;
    }
    const c = this.customer;
    this.customer = null;
    const total = itemsTotal(c.basket);
    const cash = s.rng() < 0.6;
    const paid = cash ? customerCashPayment(total, s.rng) : total;
    const change = cash ? sumCents(optimalChange(Math.round(paid * 100) - Math.round(total * 100))) : 0;
    const tile = counterTiles(counter.gx, counter.gy, counter.rot).customer;
    completeSale(s, c.id, c.basket, cash ? 'cash' : 'card', paid, change, Math.max(20, this.serviceTotal), { gx: tile.gx + 0.5, gy: tile.gy + 0.5 });
    c.finishCheckout(true);
  }

  // ---------- Xếp kệ ----------
  private updateStocker(sim: number): void {
    const s = this.world.s;
    switch (this.state) {
      case 'idle':
      case 'walk':
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = 1.5;
        this.findJob();
        return;
      case 'toBox':
        this.pickUpBox();
        return;
      case 'toShelf':
        this.state = 'stocking';
        this.timer = STAFF_STOCK_S / this.data.speed;
        return;
      case 'stocking': {
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = STAFF_STOCK_S / this.data.speed;
        const box = this.box;
        const target = this.target;
        const furn = target ? s.state.furniture(target.furn.uid) : undefined;
        if (!box || !furn || !target) { this.finishBox(); return; }
        const slot = furn.slots[target.slot];
        const cap = getFurniture(furn.type).slotCapacity;
        if (!slot || (slot.productId !== box.productId && slot.qty > 0) || slot.qty >= cap) { this.finishBox(); return; }
        const r = s.inventory.stock(box, furn);
        if (!r.ok) { this.finishBox(); return; }
        this.world.shakeFurniture(furn.uid);
        this.view.setHeld(boxTextureFor(this.world.scene, box));
        if (box.qty <= 0) this.finishBox();
        return;
      }
      case 'toTrash':
        if (this.box) s.inventory.removeBox(this.box.uid);
        this.box = null;
        this.view.setHeld(null);
        this.state = 'idle';
        return;
    }
  }

  private findJob(): void {
    const s = this.world.s;
    const targets = restockTargets(s.data.furniture, RESTOCK_THRESHOLD);
    for (const t of targets) {
      const sources = s.data.boxes.filter((b) => b.productId === t.productId && b.qty > 0
        && (b.location === 'floor' || b.location === 'rack') && !this.world.reserved.has(b.uid));
      sources.sort((a, b) => Math.hypot(a.gx - this.gx, a.gy - this.gy) - Math.hypot(b.gx - this.gx, b.gy - this.gy));
      for (const b of sources) {
        const goals = this.boxGoals(b);
        if (goals.length && this.walkTo(goals)) {
          this.world.reserved.add(b.uid);
          this.box = b;
          this.target = t;
          this.state = 'toBox';
          this.view.setStatus('📦 Đi lấy hàng');
          return;
        }
      }
    }
    this.view.setStatus('😴 Rảnh');
    if (this.state === 'idle' && Math.random() < 0.3) {
      // đi dạo quanh cửa hàng
      const g = s.grid;
      const p = { gx: Math.floor(Math.random() * g.storeW), gy: Math.floor(Math.random() * g.storeH) };
      if (g.isWalkable(p.gx, p.gy)) this.walkTo(p);
    }
  }

  private boxGoals(b: BoxData): GridPoint[] {
    const g = this.world.s.grid;
    if (b.location === 'rack' && b.holderId) {
      const rack = this.world.s.state.furniture(b.holderId);
      if (!rack) return [];
      return adjacentTiles(footprintCells(getFurniture(rack.type), rack.gx, rack.gy, rack.rot)).filter((p) => g.isWalkable(p.gx, p.gy));
    }
    const t = { gx: Math.floor(b.gx), gy: Math.floor(b.gy) };
    if (g.isWalkable(t.gx, t.gy)) return [t];
    return adjacentTiles([t]).filter((p) => g.isWalkable(p.gx, p.gy));
  }

  private pickUpBox(): void {
    const s = this.world.s;
    const box = this.box;
    const target = this.target;
    if (!box || !target || !s.state.box(box.uid) || (box.location !== 'floor' && box.location !== 'rack')) {
      this.release();
      return;
    }
    if (box.location === 'rack' && box.holderId) {
      const rack = s.state.furniture(box.holderId);
      if (rack) s.inventory.takeFromRack(rack, box.uid);
    }
    box.location = 'staff';
    box.holderId = this.data.uid;
    box.open = true;
    s.bus.emit('boxes:changed', {});
    this.view.setHeld(boxTextureFor(this.world.scene, box));
    const furn = s.state.furniture(target.furn.uid);
    const goals = furn
      ? adjacentTiles(footprintCells(getFurniture(furn.type), furn.gx, furn.gy, furn.rot)).filter((p) => s.grid.isWalkable(p.gx, p.gy))
      : [];
    if (!goals.length || !this.walkTo(goals)) {
      this.finishBox();
      return;
    }
    this.state = 'toShelf';
    this.view.setStatus('🧺 Đang xếp kệ');
  }

  private finishBox(): void {
    const s = this.world.s;
    const box = this.box;
    this.target = null;
    if (!box) { this.release(); return; }
    if (box.qty <= 0) {
      const trash = s.data.furniture.find((f) => getFurniture(f.type).kind === 'trash');
      const goals = trash
        ? adjacentTiles(footprintCells(getFurniture(trash.type), trash.gx, trash.gy, trash.rot)).filter((p) => s.grid.isWalkable(p.gx, p.gy))
        : [];
      if (goals.length && this.walkTo(goals)) {
        this.state = 'toTrash';
        this.view.setStatus('🗑️ Vứt thùng');
        return;
      }
      s.inventory.removeBox(box.uid);
      this.box = null;
      this.view.setHeld(null);
      this.state = 'idle';
      return;
    }
    this.dropBox();
  }

  /** Đặt thùng còn hàng xuống sàn. */
  dropBox(): void {
    const box = this.box;
    if (box) {
      box.location = 'floor';
      box.holderId = null;
      box.gx = Math.floor(this.gx) + 0.5;
      box.gy = Math.floor(this.gy) + 0.5;
      this.world.reserved.delete(box.uid);
      this.world.s.bus.emit('boxes:changed', {});
    }
    this.release();
  }

  private release(): void {
    if (this.box) this.world.reserved.delete(this.box.uid);
    this.box = null;
    this.target = null;
    this.view.setHeld(null);
    this.state = 'idle';
    this.timer = 0.5;
  }

  destroy(): void {
    if (this.customer) this.customer.cancelService();
    this.dropBox();
    this.view.destroy();
  }
}
