import * as THREE from 'three';
import { RESTOCK_THRESHOLD, STAFF_PAY_S, STAFF_SCAN_S, STAFF_SPEED, STAFF_STOCK_S } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { BoxData, StaffData } from '../core/GameState';
import type { Services } from '../core/Services';
import { customerCashPayment, itemsTotal, optimalChange, sumCents } from '../systems/CheckoutSystem';
import { restockTargets, type RestockTarget } from '../systems/InventorySystem';
import { completeSale } from '../systems/SalesSystem';
import { adjacentTiles, counterTiles, footprintCells, frontTiles, type GridPoint } from '../world/Footprint';
import { cellCenter, worldToCell } from '../world/NavGrid';
import { furnitureCenter } from '../world/Placement';
import { BoxModel } from './Box';
import type { Customer } from './Customer';
import { STAFF_MODELS } from '../config/characters';
import { HAIRS, SKINS } from './Human';
import { Walker } from './Walker';
import { HelperBrain, type KioskHelpApi } from './StaffHelper';

export interface StaffWorld {
  s: Services;
  frontCustomer(counterUid: string): Customer | null;
  isPlayerAtCounter(counterUid: string): boolean;
  reserved: Set<string>;
  shakeFurniture(uid: string): void;
  stockFx(furnUid: string, slot: number, from: THREE.Vector3): void;
  saleFx(amount: number, at: THREE.Vector3): void;
  kiosks: KioskHelpApi;
}

type State = 'idle' | 'toBox' | 'toShelf' | 'stocking' | 'toTrash';

/** Đồng phục cửa hàng: áo xanh ngọc, tạp dề vàng. */
const UNIFORM = { shirt: 0x1f7a6d, pants: 0x2b2d42, apron: 0xffd166 };

export class StaffNpc extends Walker {
  counterUid: string | null = null;
  private state: State = 'idle';
  private timer = 0;
  private customer: Customer | null = null;
  private serviceTotal = 0;
  private box: BoxData | null = null;
  private boxModel: BoxModel | null = null;
  private target: RestockTarget | null = null;
  private status = '';
  private helper: HelperBrain | null = null;

  constructor(private world: StaffWorld, public data: StaffData, start: GridPoint) {
    super(world.s, { ...UNIFORM, skin: SKINS[data.shirt % SKINS.length], hair: HAIRS[data.shirt % HAIRS.length], female: data.shirt % 2 === 0, model: STAFF_MODELS[data.shirt % 2 === 0 ? 1 : 0] },
      cellCenter(start.gx, start.gy).x, cellCenter(start.gx, start.gy).z);
    if (data.role === 'helper') this.helper = new HelperBrain(this, world.kiosks);
  }

  setStatus(text: string): void {
    if (text === this.status) return;
    this.status = text;
    this.bubble.show(text, 0);
  }

  tick(sim: number, dt: number): void {
    const moving = this.step(STAFF_SPEED * this.data.speed * sim, sim > 0 ? dt : 0);
    this.human.setCarrying(!!this.boxModel);
    this.boxModel?.update(dt);
    if (moving || sim <= 0) return;
    if (this.data.role === 'cashier') this.cashier(sim);
    else if (this.helper) this.helper.tick(sim);
    else this.stocker(sim);
  }

  // ---------- Thu ngân ----------
  private cashier(sim: number): void {
    const s = this.world.s;
    const counter = this.counterUid ? s.state.furniture(this.counterUid) : undefined;
    if (!counter) {
      this.setStatus('😴 Rảnh');
      return;
    }
    const def = getFurniture(counter.type);
    const t = counterTiles(def, counter.gx, counter.gy, counter.rot);
    const here = this.cell;
    const atPost = here.gx === t.staff.gx && here.gy === t.staff.gy;
    if (this.world.isPlayerAtCounter(counter.uid)) {
      if (this.customer) { this.customer.cancelService(); this.customer = null; }
      if (atPost) {
        const spots = adjacentTiles([t.staff]).flatMap((p) => adjacentTiles([p])).filter((p) => s.grid.isWalkable(p.gx, p.gy) && !(p.gx === t.staff.gx && p.gy === t.staff.gy));
        if (spots.length) this.walkTo(spots);
      }
      this.setStatus('🙇 Nhường quầy');
      return;
    }
    if (!atPost) {
      this.setStatus('🚶 Tới quầy');
      if (!this.walkTo(t.staff)) this.setStatus('😴 Rảnh');
      return;
    }
    const cc = furnitureCenter(counter);
    this.face(cc.x, cc.z);
    if (!this.customer) {
      const cu = this.world.frontCustomer(counter.uid);
      if (!cu || cu.state === 'served') {
        this.setStatus('😴 Rảnh');
        return;
      }
      cu.beginService(cc);
      this.customer = cu;
      this.serviceTotal = (cu.basketItems.length * STAFF_SCAN_S + STAFF_PAY_S) / this.data.speed;
      this.timer = this.serviceTotal;
      this.setStatus('🧾 Đang tính tiền');
    }
    this.timer -= sim;
    const cu = this.customer;
    if (this.timer > STAFF_PAY_S / this.data.speed && Math.floor((this.timer + sim) / STAFF_SCAN_S) !== Math.floor(this.timer / STAFF_SCAN_S)) {
      cu.basket.takeOut()?.mesh.removeFromParent();
      s.bus.emit('sound', { name: 'beep', pos: { x: cc.x, y: 1, z: cc.z } });
    }
    if (this.timer > 0) return;
    this.customer = null;
    const total = itemsTotal(cu.basketItems);
    const cash = s.rng() < 0.6;
    const paid = cash ? customerCashPayment(total, s.rng) : total;
    const change = cash ? sumCents(optimalChange(Math.round(paid * 100) - Math.round(total * 100))) : 0;
    const r = completeSale(s, cu.id, cu.basketItems, cash ? 'cash' : 'card', paid, change, Math.max(25, this.serviceTotal), { gx: cc.x, gy: cc.z });
    this.world.saleFx(r.revenue, new THREE.Vector3(cc.x, 1.5, cc.z));
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.16), new THREE.MeshStandardMaterial({ color: 0xc8a27a, roughness: 0.9 }));
    const g = new THREE.Group();
    bag.position.y = -0.15;
    g.add(bag);
    cu.finishCheckout(true, g);
  }

  // ---------- Xếp kệ ----------
  private stocker(sim: number): void {
    const s = this.world.s;
    switch (this.state) {
      case 'idle':
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
        if (this.target) {
          const c = furnitureCenter(this.target.furn);
          this.face(c.x, c.z);
        }
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
        if (!slot || (slot.productId !== box.productId && slot.qty > 0)) { this.finishBox(); return; }
        const r = s.inventory.stock(box, furn, target.slot);
        if (!r.ok) { this.finishBox(); return; }
        this.world.stockFx(furn.uid, target.slot, this.human.handR.getWorldPosition(new THREE.Vector3()));
        this.human.reach();
        this.boxModel?.setContents(box.productId, box.qty);
        if (box.qty <= 0) this.finishBox();
        return;
      }
      case 'toTrash':
        if (this.box) s.inventory.removeBox(this.box.uid);
        this.releaseBox();
        this.state = 'idle';
        return;
    }
  }

  private findJob(): void {
    const s = this.world.s;
    for (const t of restockTargets(s.data.furniture, RESTOCK_THRESHOLD)) {
      const sources = s.data.boxes.filter((b) => b.productId === t.productId && b.qty > 0
        && (b.location === 'floor' || b.location === 'rack') && !this.world.reserved.has(b.uid));
      sources.sort((a, b) => Math.hypot(a.gx - this.x, a.gy - this.z) - Math.hypot(b.gx - this.x, b.gy - this.z));
      for (const b of sources) {
        const goals = this.boxGoals(b);
        if (goals.length && this.walkTo(goals)) {
          this.world.reserved.add(b.uid);
          this.box = b;
          this.target = t;
          this.state = 'toBox';
          this.setStatus('📦 Đi lấy hàng');
          return;
        }
      }
    }
    this.setStatus('😴 Rảnh');
  }

  private boxGoals(b: BoxData): GridPoint[] {
    const g = this.world.s.grid;
    if (b.location === 'rack' && b.holderId) {
      const rack = this.world.s.state.furniture(b.holderId);
      if (!rack) return [];
      return frontTiles(getFurniture(rack.type), rack.gx, rack.gy, rack.rot).filter((p) => g.isWalkable(p.gx, p.gy));
    }
    const t = worldToCell(b.gx, b.gy);
    const around = [t, ...adjacentTiles([t])];
    return around.filter((p) => g.isWalkable(p.gx, p.gy));
  }

  private pickUpBox(): void {
    const s = this.world.s;
    const box = this.box;
    const target = this.target;
    if (!box || !target || !s.state.box(box.uid) || (box.location !== 'floor' && box.location !== 'rack')) {
      this.releaseBox();
      this.state = 'idle';
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
    this.boxModel = new BoxModel(box.productId);
    this.boxModel.setOpen(true, true);
    this.boxModel.setContents(box.productId, box.qty);
    this.boxModel.group.scale.setScalar(0.85);
    this.boxModel.group.position.set(0, 0.95, -0.35);
    this.human.root.add(this.boxModel.group);
    const furn = s.state.furniture(target.furn.uid);
    const goals = furn ? frontTiles(getFurniture(furn.type), furn.gx, furn.gy, furn.rot).filter((p) => s.grid.isWalkable(p.gx, p.gy)) : [];
    if (!goals.length || !this.walkTo(goals)) {
      this.finishBox();
      return;
    }
    this.state = 'toShelf';
    this.setStatus('🧺 Đang xếp kệ');
  }

  private finishBox(): void {
    const s = this.world.s;
    const box = this.box;
    this.target = null;
    if (!box) { this.releaseBox(); this.state = 'idle'; return; }
    if (box.qty <= 0) {
      const trash = s.data.furniture.find((f) => getFurniture(f.type).kind === 'trash');
      const goals = trash ? adjacentTiles(footprintCells(getFurniture(trash.type), trash.gx, trash.gy, trash.rot)).filter((p) => s.grid.isWalkable(p.gx, p.gy)) : [];
      if (goals.length && this.walkTo(goals)) {
        this.state = 'toTrash';
        this.setStatus('🗑️ Vứt thùng');
        this.boxModel?.fold();
        return;
      }
      s.inventory.removeBox(box.uid);
      this.releaseBox();
      this.state = 'idle';
      return;
    }
    this.dropBox();
  }

  /** Đặt thùng còn hàng xuống sàn. */
  dropBox(): void {
    const box = this.box;
    if (box && box.location === 'staff') {
      box.location = 'floor';
      box.holderId = null;
      box.gx = Math.round(this.x * 100) / 100;
      box.gy = Math.round(this.z * 100) / 100;
      this.world.s.bus.emit('boxes:changed', {});
    }
    this.releaseBox();
    this.state = 'idle';
    this.timer = 0.5;
  }

  private releaseBox(): void {
    if (this.box) this.world.reserved.delete(this.box.uid);
    this.box = null;
    this.target = null;
    this.boxModel?.dispose();
    this.boxModel = null;
  }

  destroy(): void {
    this.helper?.destroy();
    this.customer?.cancelService();
    this.dropBox();
    this.dispose();
  }
}
