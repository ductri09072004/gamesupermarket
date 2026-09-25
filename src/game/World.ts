import * as THREE from 'three';
import { EYE_HEIGHT } from '../config/constants';
import type { SoundName } from '../core/EventBus';
import type { Services } from '../core/Services';
import type { Assets } from '../engine/Assets';
import type { AudioEngine } from '../engine/Audio';
import type { Input } from '../engine/Input';
import type { Renderer } from '../engine/Renderer';
import { OpenSign } from '../entities/OpenSign';
import { CameraTween } from '../player/CameraTween';
import { HeldItem } from '../player/HeldItem';
import { Interaction } from '../player/Interaction';
import { PlayerController } from '../player/PlayerController';
import { ProductInstances } from '../products/ProductInstances';
import { BuildMode } from '../build/BuildMode';
import type { AABB } from '../world/Colliders';
import { Decor } from '../world/Decor';
import { City } from '../world/City';
import { Exterior } from '../world/Exterior';
import { Lighting } from '../world/Lighting';
import { furnitureMatrix } from '../world/Placement';
import { Store } from '../world/Store';
import { worldToCell } from '../world/NavGrid';
import { Actions } from './Actions';
import { BoxManager } from './BoxManager';
import { CheckoutController } from './Checkout';
import type { GameCtx, Mode } from './Ctx';
import { CustomerManager } from './CustomerManager';
import { Effects } from './Effects';
import { FurnitureManager } from './FurnitureManager';
import { Driving } from './Driving';
import { StaffManager } from './StaffManager';
import { VehicleManager } from './VehicleManager';
import { TutorialArrow } from './TutorialArrow';

/** Toàn bộ cảnh 3D của 1 ván chơi (hoặc cảnh nền của main menu). */
export class World implements GameCtx {
  readonly root = new THREE.Group();
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly store = new Store();
  readonly exterior = new Exterior();
  readonly city = new City();
  readonly decor = new Decor();
  readonly lighting: Lighting;
  readonly furniture: FurnitureManager;
  readonly boxes: BoxManager;
  readonly products: ProductInstances;
  readonly effects = new Effects();
  readonly player: PlayerController;
  readonly held: HeldItem;
  readonly interaction: Interaction;
  readonly tween: CameraTween;
  readonly actions: Actions;
  readonly customers: CustomerManager;
  readonly staff: StaffManager;
  readonly checkout: CheckoutController;
  readonly build: BuildMode;
  readonly sign = new OpenSign();
  readonly arrow = new TutorialArrow();
  readonly vehicles: VehicleManager;
  readonly driving: Driving;
  mode: Mode = 'play';
  private colliderCache: AABB[] | null = null;
  private cityDepth: number;
  private offs: Array<() => void> = [];
  private expandAnim: { fromW: number; fromD: number; t: number } | null = null;

  constructor(readonly s: Services, readonly r: Renderer, readonly input: Input, readonly audio: AudioEngine, assets: Assets | null) {
    this.scene = r.scene;
    this.camera = r.camera;
    this.lighting = new Lighting(r.scene);
    r.registerShadowLight(this.lighting.ceiling);
    const d = s.data;
    this.store.setSize(d.storeW, d.storeH, d.warehouseUnlocked);
    this.exterior.build(d.storeW, d.storeH);
    this.city.build(d.storeH, d.storeW);
    this.cityDepth = d.storeH;
    this.decor.build(d.storeW, d.storeH);
    this.lighting.fit(d.storeW, d.storeH);
    this.furniture = new FurnitureManager(s, assets, audio);
    this.boxes = new BoxManager(s);
    this.products = new ProductInstances(this.root as unknown as THREE.Scene, furnitureMatrix);
    this.player = new PlayerController(this.camera, d.player.gx, d.player.gy, d.player.yaw);
    this.player.onFootstep = (p) => this.sound('footstep', p, 0.9 + Math.random() * 0.2);
    this.player.onJump = () => this.sound('footstep', new THREE.Vector3(this.player.x, 0.05, this.player.z), 1.25);
    this.player.onLand = (v) => this.sound('thud', new THREE.Vector3(this.player.x, 0.05, this.player.z), 1.6 - Math.min(0.5, v * 0.08));
    this.held = new HeldItem(r.heldScene);
    this.interaction = new Interaction(this.root as unknown as THREE.Scene, this.camera, s);
    this.tween = new CameraTween(this.camera);
    this.actions = new Actions(this);
    this.customers = new CustomerManager(this);
    this.staff = new StaffManager(this, this.customers);
    this.checkout = new CheckoutController(this, this.customers, this.staff);
    this.vehicles = new VehicleManager(s, () => this.city.layout.lotSpots);
    this.driving = new Driving(this);
    s.padSpots = () => this.city.padSpots();
    this.build = new BuildMode(this, () => this.peopleCells(), () => this.customers.onFurnitureChanged());
    const sp = s.grid.signPosition;
    this.sign.group.position.set(sp.x, 0, sp.z - 0.45);
    this.sign.set(d.storeOpen, false);
    this.root.add(this.store.group, this.exterior.group, this.city.group, this.decor.group, this.furniture.group, this.boxes.group, this.effects.group,
      this.customers.group, this.staff.group, this.sign.group, this.arrow.group, this.vehicles.group);
    this.scene.add(this.root);
    this.setInteractionRoots();
    this.store.onDoorOpen = () => this.sound('door', this.store.doorCenter.clone().setY(1.2), 0.9);
    this.furniture.onChanged = () => { this.colliderCache = null; this.products.markDirty(); };
    for (const b of d.boxes) if (b.location === 'held' && b.holderId === 'player') this.actions.pickUp(b.uid);
    this.offs.push(
      s.bus.on('inventory:changed', () => this.products.markDirty()),
      s.bus.on('store:toggled', ({ open }) => this.sign.set(open)),
      s.bus.on('grid:changed', ({ reason }) => this.onGridChanged(reason)),
      s.bus.on('furniture:changed', () => this.staff.assignCounters()),
      s.bus.on('vehicle:buy', ({ type }) => { s.vehicles.buy(type, this.vehicles.freeSpot()); }),
      s.bus.on('vehicle:recall', ({ uid }) => this.recallVehicle(uid)),
      s.bus.on('order:arrived', ({ orderId }) => { if (orderId !== 'wholesale') this.sound('truck', new THREE.Vector3(d.storeW / 2, 0.5, d.storeH + 6)); }),
    );
    this.player.applyCamera();
  }

  toast(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
    this.s.bus.emit('toast', { message, kind });
  }

  sound(name: SoundName, pos?: THREE.Vector3, pitch?: number): void {
    this.s.bus.emit('sound', { name, pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined, pitch });
  }

  colliders(): AABB[] {
    if (!this.colliderCache) this.colliderCache = [...this.store.colliders(), ...this.furniture.colliders(), ...this.city.colliders()];
    return this.colliderCache;
  }

  private recallVehicle(uid: string): void {
    const v = this.s.vehicles.get(uid);
    if (!v || this.driving.uid === uid) return;
    const sp = this.vehicles.freeSpot(uid);
    Object.assign(v, { x: sp.x, z: sp.z, yaw: sp.yaw });
    this.toast('📍 Xe đã về bãi đỗ cạnh cửa hàng', 'success');
  }

  private setInteractionRoots(): void {
    const kiosk = this.city.kioskObject;
    this.interaction.roots = [this.furniture.group, this.boxes.group, this.sign.group, this.vehicles.group, ...(kiosk ? [kiosk] : [])];
  }

  private peopleCells() {
    return [worldToCell(this.player.x, this.player.z), ...this.customers.customers.map((c) => c.cell), ...this.staff.all().map((n) => n.cell)];
  }

  private onGridChanged(reason: string): void {
    if (reason === 'expansion') {
      this.expandAnim = { fromW: this.store.W, fromD: this.store.D, t: 0 };
      this.s.rebuildGrid();
      this.exterior.build(this.s.data.storeW, this.s.data.storeH);
      // đường chính dịch theo mặt tiền → xe đỗ phía trước cửa hàng dịch theo
      const dz = this.s.data.storeH - this.cityDepth;
      for (const v of this.s.data.vehicles) if (v.z > this.cityDepth - 1) v.z += dz;
      this.cityDepth = this.s.data.storeH;
      this.city.build(this.s.data.storeH, this.s.data.storeW);
      this.setInteractionRoots();
      this.s.bus.emit('vehicles:changed', {});
      this.decor.build(this.s.data.storeW, this.s.data.storeH);
      this.lighting.fit(this.s.data.storeW, this.s.data.storeH);
      const sp = this.s.grid.signPosition;
      this.sign.group.position.set(sp.x, 0, sp.z - 0.45);
      this.sound('thud');
    }
    this.colliderCache = null;
    this.customers.onFurnitureChanged();
    this.staff.assignCounters();
  }

  /** Cập nhật logic (fixed-step). uiOpen: đang mở modal DOM. */
  update(dt: number, uiOpen: boolean): void {
    const s = this.s;
    if (!s.time.paused) s.orders.update(dt * 1000);
    const sim = s.time.update(dt * 1000);
    const playing = this.mode === 'play' && !uiOpen;
    const look = playing ? this.input.consumeLook() : (this.input.consumeLook(), { dx: 0, dy: 0 });
    if (playing) this.player.look(look.dx, look.dy);
    this.player.moveEnabled = playing;
    if (this.mode === 'drive' && !uiOpen) this.driving.update(dt, look);
    else this.player.update(dt, this.input, [...this.colliders(), ...this.vehicles.colliders()]);
    this.player.applyCamera();
    this.vehicles.update(dt, this.driving.uid ? { uid: this.driving.uid, state: this.driving.state } : null);
    this.tween.update(dt);
    this.interaction.enabled = playing;
    this.interaction.update(this.held.box?.productId ?? null, !!this.held.box?.open, (u) => this.furniture.get(u));
    this.actions.update(dt);
    if (playing && this.held.box?.open && (this.input.locked || !this.input.dragLook || !this.input.dragged)) {
      const t = this.interaction.target;
      if (t.kind === 'slot' && t.uid) {
        if (this.input.isMouseDown(0)) this.actions.place(t.uid, t.slot);
        else if (this.input.isMouseDown(2)) this.actions.takeBack(t.uid, t.slot);
      }
    }
    this.customers.update(sim, dt);
    this.staff.update(sim, dt);
    this.checkout.update(dt);
    this.build.update(dt);
    this.boxes.update(dt);
    this.furniture.update(dt);
    this.products.update(s.data.furniture);
    this.effects.update(dt);
    this.sign.update(dt);
    const people = [{ x: this.player.x, z: this.player.z }, ...this.customers.customers.map((c) => ({ x: c.x, z: c.z })), ...this.staff.all().map((n) => ({ x: n.x, z: n.z }))];
    this.store.update(dt, people);
    this.lighting.setHour(s.time.hour);
    this.exterior.setNight(this.lighting.night);
    this.city.setNight(this.lighting.night);
    this.vehicles.setHeadlights(this.lighting.night);
    this.sign.setNight(this.lighting.night);
    this.held.update(dt, this.camera, look, this.player.speed);
    if (this.expandAnim) {
      const a = this.expandAnim;
      a.t = Math.min(1, a.t + dt / 1.2);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.store.setSize(a.fromW + (s.data.storeW - a.fromW) * k, a.fromD + (s.data.storeH - a.fromD) * k, s.data.warehouseUnlocked);
      if (a.t >= 1) {
        this.expandAnim = null;
        this.colliderCache = null;
      }
    } else if (this.store.warehouse !== s.data.warehouseUnlocked) {
      this.store.setSize(s.data.storeW, s.data.storeH, s.data.warehouseUnlocked);
      this.colliderCache = null;
    }
    this.arrow.point(playing ? this.tutorialTarget() : null, dt);
    this.r.post.outline.selectedObjects = playing
      ? this.interaction.outlineTargets((u) => this.furniture.get(u), (u) => this.boxes.model(u)?.group)
      : [];
  }

  /** Vật cần tới ở bước hướng dẫn hiện tại (mũi tên vàng). */
  private tutorialTarget(): THREE.Vector3 | null {
    const t = this.s.data.tutorial;
    if (t.dismissed) return null;
    const steps = ['pc', 'order', 'pickup', 'stock', 'price', 'open', 'checkout'];
    const step = steps.find((k) => !t[k]);
    if (!step) return null;
    const find = (kind: string) => this.s.data.furniture.find((f) => this.furniture.get(f.uid)?.def.kind === kind);
    const top = (uid: string | undefined) => {
      const v = uid ? this.furniture.get(uid) : undefined;
      return v ? v.toWorld(new THREE.Vector3(0, v.def.size.h + 0.45, 0)) : null;
    };
    switch (step) {
      case 'pc': case 'order': return top(find('computer')?.uid);
      case 'pickup': {
        if (this.held.box) return null;
        const b = this.s.data.boxes.find((x) => x.location === 'floor');
        return b ? new THREE.Vector3(b.gx, 0.4, b.gy) : null;
      }
      case 'stock': case 'price': return top(find('display')?.uid);
      case 'open': return this.sign.group.position.clone().setY(1.6);
      case 'checkout': return this.s.data.storeOpen ? top(find('checkout')?.uid) : null;
    }
    return null;
  }

  /** Vị trí mắt người chơi (dùng khi thoát chế độ camera). */
  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.player.x, EYE_HEIGHT, this.player.z);
  }

  saveSnapshot(): void {
    this.s.data.player = { gx: Math.round(this.player.x * 100) / 100, gy: Math.round(this.player.z * 100) / 100, yaw: this.player.yaw };
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.checkout.exit();
    this.build.exit();
    this.driving.destroy();
    this.vehicles.destroy();
    this.customers.clear();
    this.staff.destroy();
    this.furniture.destroy();
    this.boxes.destroy();
    this.products.dispose();
    this.held.hold(null);
    this.root.removeFromParent();
    this.lighting.dispose();
    this.r.post.outline.selectedObjects = [];
  }
}
