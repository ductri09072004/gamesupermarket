import Phaser from 'phaser';
import { getFurniture } from '../../config/furniture';
import { makeFurniture, type FurnitureData } from '../../core/GameState';
import type { Services } from '../../core/Services';
import { DEPTH_FLOOR_OVERLAY, DEPTH_UI } from '../../iso/DepthSort';
import { footprintCells } from '../../iso/Footprint';
import { gridToScreen, screenToGrid, type GridPoint } from '../../iso/IsoMath';
import { furnitureTexture } from '../../render/FurnitureArt';
import { canPlace } from '../../systems/BuildSystem';
import { isFurnitureEmpty } from '../../systems/InventorySystem';
import { BuildPanel } from '../../ui/buildPanel';
import type { FurnitureManager } from './FurnitureManager';

interface Holding {
  type: string;
  rot: number;
  from: FurnitureData | null;
}

export class BuildController {
  active = false;
  private holding: Holding | null = null;
  private ghost: Phaser.GameObjects.Image;
  private overlay: Phaser.GameObjects.Graphics;
  private tile: GridPoint = { gx: 0, gy: 0 };
  private panel = new BuildPanel();
  private valid = false;

  constructor(
    private scene: Phaser.Scene,
    private s: Services,
    private furniture: FurnitureManager,
    private occupiedByPeople: () => GridPoint[],
    private onChanged: () => void,
  ) {
    this.ghost = scene.add.image(0, 0, '__DEFAULT').setVisible(false).setDepth(DEPTH_UI - 100).setAlpha(0.75);
    this.overlay = scene.add.graphics().setDepth(DEPTH_FLOOR_OVERLAY).setVisible(false);
    s.bus.on('build:hold', ({ furnitureId }) => {
      if (!this.active) this.enter();
      this.holdFromStock(furnitureId);
    });
  }

  toggle(): void {
    if (this.active) this.exit();
    else this.enter();
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.s.time.pause('build');
    this.drawOverlay();
    this.overlay.setVisible(true);
    this.panel.open({
      onPick: (t) => this.holdFromStock(t),
      onShop: () => this.s.bus.emit('ui:openPc', { app: 'furniture' }),
      onExit: () => this.exit(),
    });
    this.panel.setStock(this.s.data.furnitureStock);
    this.panel.setStatus('Chọn nội thất trong kho hoặc click vào nội thất có sẵn', null);
    this.s.bus.emit('build:mode', { active: true });
  }

  exit(): void {
    if (!this.active) return;
    this.cancel();
    this.active = false;
    this.overlay.setVisible(false);
    this.ghost.setVisible(false);
    this.panel.close();
    this.s.time.resume('build');
    this.s.bus.emit('build:mode', { active: false });
  }

  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    g.lineStyle(1, 0x3a86ff, 0.35);
    this.s.grid.forEach((gx, gy) => {
      if (!this.s.grid.isStoreInterior(gx, gy) && !this.s.grid.isWarehouseInterior(gx, gy)) return;
      const a = gridToScreen(gx, gy);
      const b = gridToScreen(gx + 1, gy);
      const c = gridToScreen(gx + 1, gy + 1);
      const d = gridToScreen(gx, gy + 1);
      g.strokePoints([a, b, c, d].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
    });
  }

  private holdFromStock(type: string): void {
    const i = this.s.data.furnitureStock.indexOf(type);
    if (i < 0) return;
    this.cancel();
    this.s.data.furnitureStock.splice(i, 1);
    this.holding = { type, rot: 0, from: null };
    this.panel.setStock(this.s.data.furnitureStock);
    this.refreshGhost();
  }

  private pickUp(tile: GridPoint): void {
    const uid = this.s.grid.occupant(tile.gx, tile.gy);
    const f = uid ? this.s.state.furniture(uid) : undefined;
    if (!f) return;
    if (!isFurnitureEmpty(f)) {
      this.s.bus.emit('toast', { message: 'Kệ còn hàng — hãy lấy hàng ra trước khi di chuyển', kind: 'error' });
      this.s.bus.emit('sound', { name: 'error' });
      return;
    }
    this.holding = { type: f.type, rot: f.rot, from: f };
    this.s.grid.free(f.uid);
    this.furniture.get(f.uid)?.setVisible(false);
    this.refreshGhost();
    this.s.bus.emit('sound', { name: 'pop' });
  }

  private cancel(): void {
    const h = this.holding;
    if (!h) return;
    this.holding = null;
    if (h.from) {
      this.s.grid.occupy(footprintCells(getFurniture(h.from.type), h.from.gx, h.from.gy, h.from.rot), h.from.uid);
      this.furniture.get(h.from.uid)?.setVisible(true);
    } else {
      this.s.data.furnitureStock.push(h.type);
      this.panel.setStock(this.s.data.furnitureStock);
    }
    this.ghost.setVisible(false);
  }

  rotate(): void {
    if (!this.holding) return;
    this.holding.rot = (this.holding.rot + 1) % 4;
    this.refreshGhost();
  }

  sell(): void {
    const h = this.holding;
    if (!h) return;
    const def = getFurniture(h.type);
    if (!def.sellable) {
      this.s.bus.emit('toast', { message: `Không thể bán ${def.name}`, kind: 'error' });
      return;
    }
    this.holding = null;
    const refund = this.s.shop.sellFurniture(h.type);
    if (h.from) {
      this.s.data.furniture = this.s.data.furniture.filter((f) => f.uid !== h.from!.uid);
      this.furniture.sync();
      this.changed();
    }
    this.ghost.setVisible(false);
    this.s.bus.emit('toast', { message: `Đã bán ${def.name} (+$${refund.toFixed(2)})`, kind: 'info' });
    this.s.bus.emit('sound', { name: 'coin' });
  }

  private changed(): void {
    this.s.syncOccupancy();
    this.s.bus.emit('furniture:changed', {});
    this.s.bus.emit('grid:changed', { reason: 'furniture' });
    this.onChanged();
  }

  private refreshGhost(): void {
    const h = this.holding;
    if (!h) {
      this.ghost.setVisible(false);
      return;
    }
    const def = getFurniture(h.type);
    const tex = furnitureTexture(this.scene, def, h.rot);
    const p = gridToScreen(this.tile.gx, this.tile.gy);
    this.ghost.setTexture(tex.key).setOrigin(tex.anchorX / tex.width, tex.anchorY / tex.height).setPosition(p.x, p.y).setVisible(true);
    const check = canPlace(this.s.grid, def, this.tile.gx, this.tile.gy, h.rot, this.s.data.furniture, h.from?.uid ?? null, this.occupiedByPeople());
    this.valid = check.ok;
    this.ghost.setTint(check.ok ? 0x8dff8d : 0xff6b6b);
    this.panel.setStatus(check.ok ? `${def.icon} ${def.name}: đặt được ✔` : `${def.icon} ${def.name}: ${check.reason}`, check.ok);
  }

  pointerMove(wx: number, wy: number): void {
    if (!this.active) return;
    const t = screenToGrid(wx, wy);
    if (t.gx === this.tile.gx && t.gy === this.tile.gy) return;
    this.tile = t;
    this.refreshGhost();
  }

  pointerDown(wx: number, wy: number): void {
    if (!this.active) return;
    this.tile = screenToGrid(wx, wy);
    if (!this.holding) {
      this.pickUp(this.tile);
      return;
    }
    this.refreshGhost();
    if (!this.valid) {
      this.s.bus.emit('sound', { name: 'error' });
      return;
    }
    const h = this.holding;
    this.holding = null;
    if (h.from) {
      h.from.gx = this.tile.gx;
      h.from.gy = this.tile.gy;
      h.from.rot = h.rot;
      this.furniture.get(h.from.uid)?.setVisible(true);
    } else {
      this.s.data.furniture.push(makeFurniture(this.s.state.newUid('f'), h.type, this.tile.gx, this.tile.gy, h.rot));
    }
    this.ghost.setVisible(false);
    this.furniture.sync();
    this.changed();
    this.s.bus.emit('sound', { name: 'place' });
    const placed = h.from ?? this.s.data.furniture[this.s.data.furniture.length - 1];
    const v = this.furniture.get(placed.uid);
    if (v) this.scene.tweens.add({ targets: v.sprite, scaleY: { from: 0.7, to: 1 }, duration: 260, ease: 'Back.Out' });
  }

  onKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.code === 'KeyR') { this.rotate(); return true; }
    if (e.code === 'Delete' || e.code === 'Backspace') { this.sell(); return true; }
    if (e.code === 'Escape') {
      if (this.holding) this.cancel();
      else this.exit();
      return true;
    }
    return false;
  }

  destroy(): void {
    this.panel.close();
    this.ghost.destroy();
    this.overlay.destroy();
  }
}
