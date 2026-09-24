import Phaser from 'phaser';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import { Keyboard } from '../core/Input';
import { getServices, type Services } from '../core/Services';
import { Player } from '../entities/Player';
import { inputToGridVector, type GridPoint } from '../iso/IsoMath';
import { screenToGrid } from '../iso/IsoMath';
import { BoxManager } from './game/BoxManager';
import { BuildController } from './game/BuildController';
import { CameraController } from './game/CameraController';
import { CheckoutController } from './game/CheckoutController';
import { CustomerManager } from './game/CustomerManager';
import { DebugOverlay } from './game/DebugOverlay';
import { Effects } from './game/Effects';
import { FurnitureManager } from './game/FurnitureManager';
import { Interaction } from './game/Interaction';
import { Lighting } from './game/Lighting';
import { StaffManager } from './game/StaffManager';
import { WorldView } from './game/WorldView';
import { showTooltip, hideTooltip } from '../ui/tooltip';

export class GameScene extends Phaser.Scene {
  s!: Services;
  keys!: Keyboard;
  player!: Player;
  world!: WorldView;
  furniture!: FurnitureManager;
  boxes!: BoxManager;
  customers!: CustomerManager;
  staff!: StaffManager;
  interaction!: Interaction;
  checkout!: CheckoutController;
  build!: BuildController;
  cameraCtl!: CameraController;
  effects!: Effects;
  lighting!: Lighting;
  debug!: DebugOverlay;
  private offs: Array<() => void> = [];
  private uiBlocking = new Set<string>();

  constructor() {
    super('Game');
  }

  create(): void {
    this.s = getServices();
    const s = this.s;
    this.keys = new Keyboard();
    this.cameras.main.setBackgroundColor('#a7d98b');
    this.world = new WorldView(this, s);
    this.furniture = new FurnitureManager(this, s);
    this.boxes = new BoxManager(this, s);
    this.player = new Player(this, s.data.player.gx, s.data.player.gy);
    this.customers = new CustomerManager(this, s, this.furniture);
    this.staff = new StaffManager(this, s, this.customers, this.furniture);
    this.cameraCtl = new CameraController(this, s, () => ({ gx: this.player.gx, gy: this.player.gy, moving: this.player.moving }));
    this.cameraCtl.onZoom = (z) => this.furniture.setZoom(z);
    this.furniture.setZoom(this.cameras.main.zoom);
    this.checkout = new CheckoutController(s, this.player, this.customers, this.staff, this.cameraCtl, this.keys);
    this.interaction = new Interaction(this, s, this.player, this.furniture, this.boxes, this.keys, {
      enterCheckout: (uid) => this.checkout.enter(uid),
    });
    this.build = new BuildController(this, s, this.furniture, () => this.peopleTiles(), () => this.customers.onFurnitureChanged());
    this.effects = new Effects(this, s);
    this.lighting = new Lighting(this, s);
    this.debug = new DebugOverlay(this, s, () => ({ gx: this.player.gx, gy: this.player.gy, depth: this.player.view.depth }), this.customers, this.furniture);
    this.keys.onKey((e) => this.onKey(e));
    this.setupPointer();
    this.offs.push(
      s.bus.on('ui:modal', ({ name, open }) => {
        if (open) this.uiBlocking.add(name);
        else this.uiBlocking.delete(name);
      }),
      s.bus.on('grid:changed', ({ reason }) => {
        if (reason === 'expansion') {
          s.rebuildGrid();
          this.world.build(true);
          this.cameras.main.shake(250, 0.003);
          this.s.bus.emit('sound', { name: 'place' });
        }
        this.customers.onFurnitureChanged();
        this.staff.assignCounters();
      }),
      s.bus.on('furniture:changed', () => this.staff.assignCounters()),
      s.bus.on('staff:changed', () => this.staff.assignCounters()),
      s.bus.on('game:save', () => this.saveGame()),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private peopleTiles(): GridPoint[] {
    return [this.player.tile, ...this.customers.customers.map((c) => c.tile), ...this.staff.all().map((n) => n.view.tile)];
  }

  saveGame(): void {
    this.s.data.player = { gx: this.player.gx, gy: this.player.gy };
    if (this.s.save()) this.s.bus.emit('toast', { message: '💾 Đã lưu game', kind: 'success' });
  }

  get uiOpen(): boolean {
    return this.uiBlocking.size > 0;
  }

  private onKey(e: KeyboardEvent): void {
    if (this.uiOpen) return;
    if (e.code === 'F3') {
      e.preventDefault();
      this.debug.toggle();
      return;
    }
    if (this.checkout.active) return;
    if (this.build.onKey(e)) {
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'KeyB':
        if (this.player.heldBox && !this.build.active) {
          this.s.bus.emit('toast', { message: 'Đặt thùng xuống trước khi vào chế độ xây dựng', kind: 'error' });
          return;
        }
        this.build.toggle();
        return;
      case 'KeyC':
        this.cameraCtl.toggleFollow();
        return;
      case 'Digit1': case 'Digit2': case 'Digit3':
        this.s.time.setSpeed(Number(e.code.slice(-1)));
        return;
    }
    if (!this.build.active) this.interaction.onKey(e);
  }

  private setupPointer(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.build.pointerMove(p.worldX, p.worldY);
      if (this.build.active || this.uiOpen) { hideTooltip(); return; }
      const b = this.boxes.boxAt(p.worldX, p.worldY);
      if (b) showTooltip(`${getProduct(b.productId).icon} ${getProduct(b.productId).name} ×${b.qty}${b.open ? ' (mở)' : ''}`, p.x, p.y);
      else hideTooltip();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown() || this.uiOpen) return;
      if (this.build.active) {
        this.build.pointerDown(p.worldX, p.worldY);
        return;
      }
      if (this.checkout.active) return;
      const t = screenToGrid(p.worldX, p.worldY);
      const uid = this.s.grid.occupant(t.gx, t.gy);
      const f = uid ? this.s.state.furniture(uid) : undefined;
      if (f && getFurniture(f.type).kind === 'display') {
        this.s.bus.emit('ui:openPrice', { furnitureUid: f.uid });
        this.s.bus.emit('sound', { name: 'click' });
      }
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    const s = this.s;
    if (s.data.gameOver) return;
    const paused = s.time.paused;
    if (!paused) s.orders.update(dt);
    const sim = s.time.update(dt);
    const canMove = !paused && !this.uiOpen && !this.checkout.active;
    const k = this.keys;
    const dir = canMove
      ? inputToGridVector(k.isDown('KeyW') || k.isDown('ArrowUp'), k.isDown('KeyS') || k.isDown('ArrowDown'),
        k.isDown('KeyA') || k.isDown('ArrowLeft'), k.isDown('KeyD') || k.isDown('ArrowRight'))
      : { gx: 0, gy: 0 };
    this.player.update(dt, dir, s.grid);
    this.interaction.enabled = canMove && !this.build.active;
    this.interaction.update(dt);
    this.customers.update(sim, dt);
    this.staff.update(sim, dt);
    this.checkout.update(dt);
    this.boxes.update();
    this.cameraCtl.update(dt);
    this.lighting.update();
    this.world.setBackWallFade(s.grid.isWarehouseInterior(Math.floor(this.player.gx), Math.floor(this.player.gy)));
    const ptr = this.input.activePointer;
    this.debug.update(dt, { x: ptr.worldX, y: ptr.worldY });
    const canEnd = s.day.canEndDay();
    if (canEnd !== this.lastCanEnd) {
      this.lastCanEnd = canEnd;
      s.bus.emit('day:canEnd', { canEnd });
    }
  }

  private lastCanEnd = false;

  /** Đặt lại vị trí sau khi bắt đầu ngày mới. */
  resetForNewDay(): void {
    this.customers.clear();
    const d = this.s.grid.doorInside;
    if (!this.player.heldBox) this.player.teleport(d.gx + 0.5, d.gy - 1.5);
  }

  private cleanup(): void {
    this.offs.forEach((o) => o());
    this.keys.destroy();
    this.checkout.exit();
    this.build.destroy();
    this.debug.destroy();
    this.furniture.destroy();
    this.boxes.destroy();
    this.staff.destroy();
    this.effects.destroy();
    hideTooltip();
  }
}
