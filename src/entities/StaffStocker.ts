import * as THREE from 'three';
import { RESTOCK_THRESHOLD, STAFF_STOCK_S } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { BoxData } from '../core/GameState';
import { restockTargets, type RestockTarget } from '../systems/InventorySystem';
import { pickDeliveryTile } from '../systems/OrderSystem';
import { adjacentTiles, footprintCells, frontTiles, type GridPoint } from '../world/Footprint';
import { worldToCell } from '../world/NavGrid';
import { furnitureCenter } from '../world/Placement';
import { BoxModel } from './Box';
import type { StaffBody, StaffBrain } from './StaffTypes';

type State = 'idle' | 'toBox' | 'toShelf' | 'stocking' | 'toTrash' | 'toDepot';

/** Nhân viên xếp kệ: lấy thùng (sàn / kệ kho) → châm ngăn dưới 30% → vứt thùng rỗng; hết việc ra ngoài nghỉ. */
export class StockerBrain implements StaffBrain {
  private state: State = 'idle';
  private timer = 0;
  private box: BoxData | null = null;
  private boxModel: BoxModel | null = null;
  private target: RestockTarget | null = null;
  /** Ô tập kết (m) đang mang thùng còn thừa hàng tới */
  private depot: { gx: number; gy: number } | null = null;

  constructor(private npc: StaffBody) {}

  private get s() {
    return this.npc.world.s;
  }

  /** Mỗi khung hình (kể cả lúc đang đi). */
  update(dt: number): void {
    this.npc.human.setCarrying(!!this.boxModel);
    this.boxModel?.update(dt);
  }

  /** Khi đã tới nơi / đứng yên. */
  tick(sim: number): void {
    const s = this.s;
    switch (this.state) {
      case 'idle':
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = 1.5;
        if (!this.findJob() && this.npc.goRest()) this.npc.setStatus('☕ Nghỉ ngoài cửa hàng');
        return;
      case 'toBox':
        this.pickUpBox();
        return;
      case 'toShelf':
        this.state = 'stocking';
        this.timer = STAFF_STOCK_S / this.npc.data.speed;
        if (this.target) {
          const c = furnitureCenter(this.target.furn);
          this.npc.face(c.x, c.z);
        }
        return;
      case 'stocking': {
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = STAFF_STOCK_S / this.npc.data.speed;
        const box = this.box;
        const target = this.target;
        const furn = target ? s.state.furniture(target.furn.uid) : undefined;
        if (!box || !furn || !target) { this.finishBox(); return; }
        const slot = furn.slots[target.slot];
        if (!slot || (slot.productId !== box.productId && slot.qty > 0)) { this.finishBox(); return; }
        const r = s.inventory.stock(box, furn, target.slot);
        if (!r.ok) { this.finishBox(); return; }
        this.npc.world.stockFx(furn.uid, target.slot, this.npc.human.handR.getWorldPosition(new THREE.Vector3()));
        this.npc.human.reach();
        this.boxModel?.setContents(box.productId, box.qty);
        if (box.qty <= 0) this.finishBox();
        return;
      }
      case 'toDepot':
        this.dropBox(this.depot ?? undefined);
        return;
      case 'toTrash':
        if (this.box) s.inventory.removeBox(this.box.uid);
        this.releaseBox();
        this.state = 'idle';
        return;
    }
  }

  private findJob(): boolean {
    const s = this.s;
    const w = this.npc.world;
    for (const t of restockTargets(s.data.furniture, RESTOCK_THRESHOLD)) {
      const sources = s.data.boxes.filter((b) => b.productId === t.productId && b.qty > 0
        && (b.location === 'floor' || b.location === 'rack') && !w.reserved.has(b.uid));
      sources.sort((a, b) => Math.hypot(a.gx - this.npc.x, a.gy - this.npc.z) - Math.hypot(b.gx - this.npc.x, b.gy - this.npc.z));
      for (const b of sources) {
        const goals = this.boxGoals(b);
        if (goals.length && this.npc.walkTo(goals)) {
          w.reserved.add(b.uid);
          this.box = b;
          this.target = t;
          this.state = 'toBox';
          this.npc.setStatus('📦 Đi lấy hàng');
          return true;
        }
      }
    }
    return false;
  }

  private boxGoals(b: BoxData): GridPoint[] {
    const g = this.s.grid;
    if (b.location === 'rack' && b.holderId) {
      const rack = this.s.state.furniture(b.holderId);
      if (!rack) return [];
      return frontTiles(getFurniture(rack.type), rack.gx, rack.gy, rack.rot).filter((p) => g.isWalkable(p.gx, p.gy));
    }
    const t = worldToCell(b.gx, b.gy);
    return [t, ...adjacentTiles([t])].filter((p) => g.isWalkable(p.gx, p.gy));
  }

  private pickUpBox(): void {
    const s = this.s;
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
    box.holderId = this.npc.data.uid;
    box.open = true;
    s.bus.emit('boxes:changed', {});
    this.boxModel = new BoxModel(box.productId);
    this.boxModel.setOpen(true, true);
    this.boxModel.setContents(box.productId, box.qty);
    this.boxModel.group.scale.setScalar(0.85);
    this.boxModel.group.position.set(0, 0.95, -0.35);
    this.npc.human.root.add(this.boxModel.group);
    const furn = s.state.furniture(target.furn.uid);
    const goals = furn ? frontTiles(getFurniture(furn.type), furn.gx, furn.gy, furn.rot).filter((p) => s.grid.isWalkable(p.gx, p.gy)) : [];
    if (!goals.length || !this.npc.walkTo(goals)) {
      this.finishBox();
      return;
    }
    this.state = 'toShelf';
    this.npc.setStatus('🧺 Đang xếp kệ');
  }

  private finishBox(): void {
    const s = this.s;
    const box = this.box;
    this.target = null;
    if (!box) { this.releaseBox(); this.state = 'idle'; return; }
    if (box.qty <= 0) {
      const trash = s.data.furniture.find((f) => getFurniture(f.type).kind === 'trash');
      const goals = trash ? adjacentTiles(footprintCells(getFurniture(trash.type), trash.gx, trash.gy, trash.rot)).filter((p) => s.grid.isWalkable(p.gx, p.gy)) : [];
      if (goals.length && this.npc.walkTo(goals)) {
        this.state = 'toTrash';
        this.npc.setStatus('🗑️ Vứt thùng');
        this.boxModel?.fold();
        return;
      }
      s.inventory.removeBox(box.uid);
      this.releaseBox();
      this.state = 'idle';
      return;
    }
    this.carryToDepot();
  }

  /** Thùng còn hàng: mang ra chỗ tập kết trước cửa hàng (ô giao hàng còn ít thùng nhất), không bỏ lại cạnh kệ. */
  private carryToDepot(): void {
    const s = this.s;
    const counts = new Map<string, number>();
    for (const b of s.data.boxes) {
      if (b.location !== 'floor') continue;
      const k = `${b.gx.toFixed(2)},${b.gy.toFixed(2)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const spot = pickDeliveryTile(s.grid.deliverySpots(), counts);
    const cell = worldToCell(spot.gx, spot.gy);
    const goals = [cell, ...adjacentTiles([cell])].filter((p) => s.grid.isWalkable(p.gx, p.gy));
    if (goals.length && this.npc.walkTo(goals)) {
      this.depot = spot;
      this.state = 'toDepot';
      this.npc.setStatus('📦 Mang thùng thừa ra chỗ tập kết');
      return;
    }
    this.dropBox();
  }

  /** Đặt thùng còn hàng xuống sàn: tại ô tập kết nếu có, không thì ngay chỗ đứng. */
  private dropBox(at?: { gx: number; gy: number }): void {
    const box = this.box;
    this.depot = null;
    if (box && box.location === 'staff') {
      box.location = 'floor';
      box.holderId = null;
      box.open = false;
      box.gx = at ? at.gx : Math.round(this.npc.x * 100) / 100;
      box.gy = at ? at.gy : Math.round(this.npc.z * 100) / 100;
      this.s.bus.emit('boxes:changed', {});
      this.npc.human.reach();
    }
    this.releaseBox();
    this.state = 'idle';
    this.timer = 0.5;
  }

  private releaseBox(): void {
    if (this.box) this.npc.world.reserved.delete(this.box.uid);
    this.box = null;
    this.target = null;
    this.boxModel?.dispose();
    this.boxModel = null;
  }

  destroy(): void {
    this.dropBox();
  }
}
