import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getFurniture, isCeiling } from '../config/furniture';
import { makeFurniture, type FurnitureData } from '../core/GameState';
import { canPlace } from '../systems/BuildSystem';
import { BuildPanel } from '../ui/buildPanel';
import { buildGrid, dropContents, ghostModel } from './BuildHelpers';
import { footprintCells, type GridPoint } from '../world/Footprint';
import { worldToCell } from '../world/NavGrid';
import { furnitureMatrix } from '../world/Placement';
import type { GameCtx } from '../game/Ctx';

interface Holding {
  type: string;
  rot: number;
  from: FurnitureData | null;
}

/** Build mode: camera nhìn từ trên, lưới 0.5m, ghost xanh/đỏ, R xoay, click đặt/nhấc, Delete bán 50%. */
export class BuildMode {
  active = false;
  private holding: Holding | null = null;
  private ghost: THREE.Group | null = null;
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, depthWrite: false });
  private grid: THREE.LineSegments | null = null;
  private cell: GridPoint = { gx: 0, gy: 0 };
  private valid = false;
  private panel = new BuildPanel();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** Vào Build mode bằng phím M (dời nhanh) → tự thoát sau khi đặt xong / huỷ. */
  private quick = false;

  constructor(private c: GameCtx, private peopleCells: () => GridPoint[], private onChanged: () => void) {
    c.input.onMouseDown((e) => { if (this.active && e.button === 0 && !(e.target as HTMLElement).closest?.('.build-panel')) this.click(); });
    c.s.bus.on('build:hold', ({ furnitureId }) => {
      if (!this.active) this.enter();
      this.holdFromStock(furnitureId);
    });
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  enter(): void {
    const c = this.c;
    if (this.active || c.mode !== 'play') return;
    if (c.held.box) {
      c.toast('Đặt thùng xuống trước khi vào chế độ xây dựng', 'error');
      return;
    }
    this.active = true;
    c.mode = 'build';
    c.s.time.pause('build');
    c.input.exitLock();
    c.input.lookEnabled = false;
    c.player.cameraOverride = true;
    const { W, D } = c.store;
    const span = Math.max(W, D);
    c.tween.go(new THREE.Vector3(W / 2, span * 1.05 + 3, D / 2 + span * 0.45), new THREE.Vector3(W / 2, 0, D / 2 - (c.s.data.warehouseUnlocked ? 1.5 : 0)), FEEL.cameraTweenS);
    this.grid = buildGrid(this.c.s.grid);
    this.c.scene.add(this.grid);
    this.panel.open({ onPick: (t) => this.holdFromStock(t), onShop: () => c.s.bus.emit('ui:openPc', { app: 'furniture' }), onExit: () => this.exit() });
    this.panel.setStock(c.s.data.furnitureStock);
    this.panel.setStatus('Chọn nội thất trong kho hoặc click vào nội thất có sẵn để nhấc lên', null);
    c.s.bus.emit('build:mode', { active: true });
  }

  exit(): void {
    if (!this.active) return;
    const c = this.c;
    this.cancel();
    this.active = false;
    this.quick = false;
    this.grid?.removeFromParent();
    this.grid = null;
    this.panel.close();
    c.s.time.resume('build');
    c.input.lookEnabled = true;
    const eye = new THREE.Vector3(c.player.x, c.player.eye, c.player.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.player.pitch, c.player.yaw, 0, 'YXZ'));
    c.tween.goTo(eye, q, FEEL.cameraTweenS, () => {
      c.player.cameraOverride = false;
      c.mode = 'play';
    });
    c.s.bus.emit('build:mode', { active: false });
  }

  private setGhost(type: string): void {
    this.ghost?.removeFromParent();
    this.ghost = ghostModel(type, this.ghostMat);
    this.c.scene.add(this.ghost);
  }

  private holdFromStock(type: string): void {
    const i = this.c.s.data.furnitureStock.indexOf(type);
    if (i < 0) return;
    this.cancel();
    this.c.s.data.furnitureStock.splice(i, 1);
    this.holding = { type, rot: 0, from: null };
    this.panel.setStock(this.c.s.data.furnitureStock);
    this.setGhost(type);
    this.refresh();
  }

  /** Click ô: ưu tiên nội thất trên sàn, không có thì nhấc đèn trần phía trên ô đó. */
  private pickUp(cell: GridPoint): void {
    const uid = this.c.s.grid.occupant(cell.gx, cell.gy) ?? this.c.s.data.furniture.find((f) => {
      const def = getFurniture(f.type);
      return isCeiling(def) && footprintCells(def, f.gx, f.gy, f.rot).some((p) => p.gx === cell.gx && p.gy === cell.gy);
    })?.uid;
    if (uid) this.pickUpUid(uid);
  }

  /** Nhấc nội thất lên (kể cả kệ đang có hàng — hàng đi theo kệ). */
  private pickUpUid(uid: string): void {
    const c = this.c;
    const f = c.s.state.furniture(uid);
    if (!f) return;
    this.holding = { type: f.type, rot: f.rot, from: f };
    c.s.grid.free(f.uid);
    this.setCarried(f.uid, true);
    this.setGhost(f.type);
    this.refresh();
    const items = f.slots.reduce((a, s) => a + s.qty, 0) + f.boxes.length;
    this.panel.setStatus(items > 0 ? `Đang dời ${getFurniture(f.type).name} — ${items} món/thùng sẽ đi theo kệ` : 'Chọn vị trí mới rồi click để đặt', null);
    c.sound('pop');
  }

  /** Ẩn kệ cùng hàng/thùng trên đó khi đang cầm. */
  private setCarried(uid: string, carried: boolean): void {
    this.c.furniture.get(uid)?.setVisible(!carried);
    this.c.products.setHidden(uid, carried);
    this.c.boxes.setHolderHidden(uid, carried);
  }

  /** Dời nhanh từ góc nhìn thứ nhất (phím M khi nhìn vào nội thất). */
  moveFurniture(uid: string): void {
    if (this.active || this.c.mode !== 'play') return;
    this.enter();
    if (!this.active) return;
    this.quick = true;
    this.pickUpUid(uid);
  }

  private cancel(): void {
    const h = this.holding;
    this.holding = null;
    this.ghost?.removeFromParent();
    this.ghost = null;
    if (!h) return;
    if (h.from) {
      const def = getFurniture(h.from.type);
      if (!isCeiling(def)) this.c.s.grid.occupy(footprintCells(def, h.from.gx, h.from.gy, h.from.rot), h.from.uid);
      this.setCarried(h.from.uid, false);
    } else {
      this.c.s.data.furnitureStock.push(h.type);
      this.panel.setStock(this.c.s.data.furnitureStock);
    }
  }

  private changed(): void {
    this.c.s.syncOccupancy();
    this.c.furniture.sync();
    this.c.s.bus.emit('furniture:changed', {});
    this.c.s.bus.emit('grid:changed', { reason: 'furniture' });
    this.onChanged();
  }

  rotate(): void {
    if (!this.holding) return;
    this.holding.rot = (this.holding.rot + 1) % 4;
    this.refresh();
  }

  sell(): void {
    const c = this.c;
    const h = this.holding;
    if (!h) return;
    const def = getFurniture(h.type);
    if (!def.sellable) {
      c.toast(`Không thể bán ${def.name}`, 'error');
      return;
    }
    this.holding = null;
    this.ghost?.removeFromParent();
    this.ghost = null;
    const refund = c.s.shop.sellFurniture(h.type);
    let packed = 0;
    if (h.from) {
      packed = dropContents(this.c.s, h.from);
      this.setCarried(h.from.uid, false);
      c.s.data.furniture = c.s.data.furniture.filter((f) => f.uid !== h.from!.uid);
      this.changed();
    }
    c.toast(`Đã bán ${def.name} (+$${refund.toFixed(2)})${packed ? ` — hàng đã đóng vào ${packed} thùng` : ''}`, 'info');
    c.sound('coin');
    if (this.quick) this.exit();
  }

  /** Ô dưới con trỏ (theo tâm footprint). */
  private pointerCell(): GridPoint {
    const c = this.c;
    const ndc = new THREE.Vector2((c.input.mouseX / window.innerWidth) * 2 - 1, -(c.input.mouseY / window.innerHeight) * 2 + 1);
    c.camera.updateMatrixWorld();
    this.ray.setFromCamera(ndc, c.camera);
    const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, p)) return this.cell;
    const cell = worldToCell(p.x, p.z);
    if (this.holding) {
      const def = getFurniture(this.holding.type);
      const w = this.holding.rot % 2 === 0 ? def.footprint.w : def.footprint.h;
      const h = this.holding.rot % 2 === 0 ? def.footprint.h : def.footprint.w;
      return { gx: cell.gx - Math.floor((w - 1) / 2), gy: cell.gy - Math.floor((h - 1) / 2) };
    }
    return cell;
  }

  private refresh(): void {
    const h = this.holding;
    if (!h || !this.ghost) return;
    const def = getFurniture(h.type);
    const check = canPlace(this.c.s.grid, def, this.cell.gx, this.cell.gy, h.rot, this.c.s.data.furniture, h.from?.uid ?? null, this.peopleCells());
    this.valid = check.ok;
    this.ghostMat.color.set(check.ok ? 0x4ade80 : 0xf87171);
    this.ghost.matrix.copy(furnitureMatrix({ uid: '_ghost', type: h.type, gx: this.cell.gx, gy: this.cell.gy, rot: h.rot, slots: [], boxes: [] }));
    this.panel.setStatus(check.ok ? `${def.icon} ${def.name}: đặt được ✔` : `${def.icon} ${def.name}: ${check.reason}`, check.ok);
  }

  private click(): void {
    const c = this.c;
    this.cell = this.pointerCell();
    if (!this.holding) {
      this.pickUp(this.cell);
      return;
    }
    this.refresh();
    if (!this.valid) {
      c.sound('error');
      return;
    }
    const h = this.holding;
    this.holding = null;
    this.ghost?.removeFromParent();
    this.ghost = null;
    let placed: FurnitureData;
    if (h.from) {
      h.from.gx = this.cell.gx;
      h.from.gy = this.cell.gy;
      h.from.rot = h.rot;
      this.setCarried(h.from.uid, false);
      placed = h.from;
    } else {
      placed = makeFurniture(c.s.state.newUid('f'), h.type, this.cell.gx, this.cell.gy, h.rot);
      c.s.data.furniture.push(placed);
    }
    this.changed();
    const v = c.furniture.get(placed.uid);
    if (v) v.model.scale.y = 0.6;
    c.products.markDirty();
    c.boxes.markDirty();
    c.sound('thud');
    if (this.quick) this.exit();
  }

  update(dt: number): void {
    if (!this.active) return;
    for (const v of this.c.furniture.all()) if (v.model.scale.y < 1) v.model.scale.y = Math.min(1, v.model.scale.y + dt * 3);
    if (!this.holding) return;
    const cell = this.pointerCell();
    if (cell.gx !== this.cell.gx || cell.gy !== this.cell.gy) {
      this.cell = cell;
      this.refresh();
    }
  }

  onKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.code === 'KeyR') { this.rotate(); return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.sell(); return true; }
    if (e.code === 'Escape') {
      const wasHolding = !!this.holding;
      this.cancel();
      if (!wasHolding || this.quick) this.exit();
      return true;
    }
    if (e.code === 'KeyB') { this.exit(); return true; }
    return false;
  }
}
