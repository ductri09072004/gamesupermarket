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
import { playerFootstep, stepSurface } from './Footsteps';
import { BoxManager } from './BoxManager';
import { CheckoutController } from './Checkout';
import type { GameCtx, Mode } from './Ctx';
import { CustomerManager } from './CustomerManager';
import { Effects } from './Effects';
import { FurnitureManager } from './FurnitureManager';
import { Driving } from './Driving';
import { StaffManager } from './StaffManager';
import { SelfCheckoutManager } from './SelfCheckoutManager';
import { StoreLighting } from './StoreLighting';
import { VehicleManager } from './VehicleManager';
import { TutorialArrow } from './TutorialArrow';
import { tutorialTarget } from './tutorialTarget';
import { CityLife } from './CityLife';
import { MessManager } from './MessManager';
import { SecurityManager } from './SecurityManager';
import { CrateManager } from './CrateManager';
import { DeliveryTrucks } from './DeliveryTrucks';
import { FpPlace } from '../build/FpPlace';
import { BoxPhysics } from './BoxPhysics';
import { drivePusher } from './Pushers';
import { applyTimeOfDay } from './TimeOfDay';

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
  readonly selfCheckout: SelfCheckoutManager;
  readonly lights: StoreLighting;
  readonly build: BuildMode;
  readonly sign = new OpenSign();
  readonly arrow = new TutorialArrow();
  readonly vehicles: VehicleManager;
  readonly driving: Driving;
  readonly life = new CityLife();
  readonly mess: MessManager;
  readonly security: SecurityManager;
  readonly crates: CrateManager;
  readonly trucks: DeliveryTrucks;
  readonly fp: FpPlace;
  readonly physics: BoxPhysics;
  mode: Mode = 'play';
  private colliderCache: AABB[] | null = null;
  private cityDepth: number;
  private offs: Array<() => void> = [];

  constructor(readonly s: Services, readonly r: Renderer, readonly input: Input, readonly audio: AudioEngine, assets: Assets | null) {
    this.scene = r.scene;
    this.camera = r.camera;
    this.lighting = new Lighting(r.scene);
    r.registerShadowLight(this.lighting.ceiling);
    const d = s.data;
    this.store.setSize(d.storeW, d.storeH, d.warehouseUnlocked);
    this.exterior.build(d.storeW, d.storeH);
    this.city.onBuilt = (L) => this.life.reset(L);
    this.city.build(d.storeH, d.storeW);
    this.cityDepth = d.storeH;
    this.decor.build(d.storeW, d.storeH);
    this.lighting.fit(d.storeW, d.storeH);
    this.lights = new StoreLighting(this);
    this.furniture = new FurnitureManager(s, assets, audio);
    this.boxes = new BoxManager(s);
    this.products = new ProductInstances(this.root as unknown as THREE.Scene, furnitureMatrix);
    this.player = new PlayerController(this.camera, d.player.gx, d.player.gy, d.player.yaw);
    this.player.onFootstep = () => playerFootstep(this, audio);
    this.player.onJump = () => audio.playStep(stepSurface(this), 0.45);
    this.player.onLand = (v) => this.sound('thud', new THREE.Vector3(this.player.x, 0.05, this.player.z), 1.6 - Math.min(0.5, v * 0.08));
    this.held = new HeldItem(r.heldScene);
    this.interaction = new Interaction(this.root as unknown as THREE.Scene, this.camera, s);
    this.tween = new CameraTween(this.camera);
    this.actions = new Actions(this);
    this.customers = new CustomerManager(this);
    this.selfCheckout = new SelfCheckoutManager(this, this.customers);
    this.mess = new MessManager(this, () => this.customers.customers);
    this.security = new SecurityManager(this, this.customers, this.mess);
    this.staff = new StaffManager(this, this.customers, this.selfCheckout, this.mess, this.security);
    this.checkout = new CheckoutController(this, this.customers, this.staff);
    this.vehicles = new VehicleManager(s, () => this.city.layout.lotSpots);
    this.driving = new Driving(this);
    s.padSpots = () => this.city.padSpots();
    this.build = new BuildMode(this, () => this.peopleCells(), () => this.customers.onFurnitureChanged());
    this.fp = new FpPlace(this, () => this.peopleCells(), () => this.customers.onFurnitureChanged());
    this.crates = new CrateManager(s);
    this.physics = new BoxPhysics(s, () => this.colliders(), (u) => this.boxes.isAnimating(u));
    this.boxes.physicsPose = (u) => this.physics.pose(u);
    this.player.onPush = (u, dx, dz) => this.physics.push(u, dx, dz, this.player.y, 1 / 60);
    this.life.traffic.statics = () => this.colliders();
    this.trucks = new DeliveryTrucks(this, () => this.city.layout);
    for (const o of d.orders) o.dispatched = false; // đơn chờ xe từ lần chơi trước → gọi xe tải lại
    s.orders.onDue = (o) => this.trucks.dispatch(o);
    const sp = s.grid.signPosition;
    this.sign.group.position.set(sp.x, 0, sp.z - 0.45);
    this.sign.set(d.storeOpen, false);
    this.root.add(this.store.group, this.exterior.group, this.city.group, this.decor.group, this.furniture.group, this.boxes.group, this.effects.group,
      this.customers.group, this.staff.group, this.sign.group, this.arrow.group, this.vehicles.group, this.lights.lightSwitch.group, this.life.group, this.mess.group, this.security.group, this.crates.group, this.trucks.group);
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
    this.interaction.roots = [this.furniture.group, this.boxes.group, this.mess.group, this.security.group, this.crates.group, this.sign.group, this.vehicles.group, this.lights.lightSwitch.group, ...(kiosk ? [kiosk] : [])];
  }

  private peopleCells() {
    return [worldToCell(this.player.x, this.player.z), ...this.customers.customers.map((c) => c.cell), ...this.staff.all().map((n) => n.cell)];
  }

  private onGridChanged(reason: string): void {
    if (reason === 'expansion') {
      this.store.beginGrow();
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
      this.lights.layout();
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
    else this.player.update(dt, this.input, [...this.colliders(), ...this.vehicles.colliders(), ...this.life.colliders(), ...this.trucks.colliders()]);
    this.player.applyCamera();
    this.vehicles.update(dt, this.driving.uid ? { uid: this.driving.uid, state: this.driving.state } : null);
    const onRoad = this.driving.uid ? this.driving.state : this.player;
    this.trucks.update(s.time.paused ? 0 : dt, [...this.life.traffic.positions(), onRoad]);
    this.life.update(dt, onRoad, !!this.driving.uid, this.camera.position, this.trucks.obstacles());
    this.crates.update(dt);
    this.physics.update(dt, drivePusher(this), this.player);
    if (playing) this.fp.update();
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
    this.selfCheckout.update(sim, dt);
    this.mess.update(sim);
    this.security.update(sim > 0 ? dt : 0);
    this.staff.update(sim, dt);
    this.checkout.update(dt);
    this.build.update();
    this.boxes.update(dt);
    this.furniture.update(dt);
    this.products.update(s.data.furniture);
    this.effects.update(dt);
    this.sign.update(dt);
    const people = [{ x: this.player.x, z: this.player.z }, ...this.customers.customers.map((c) => ({ x: c.x, z: c.z })), ...this.staff.all().map((n) => ({ x: n.x, z: n.z }))];
    this.store.update(dt, people);
    this.lights.update(dt);
    applyTimeOfDay(this, s.time.hour);
    this.held.update(dt, this.camera, look, this.player.speed);
    if (this.store.animateTo(s.data.storeW, s.data.storeH, s.data.warehouseUnlocked, dt)) this.colliderCache = null;
    this.arrow.point(playing ? tutorialTarget(this) : null, dt);
    this.r.post.outline.selectedObjects = playing
      ? this.interaction.outlineTargets((u) => this.furniture.get(u), (u) => this.boxes.model(u)?.group)
      : [];
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
    this.build.destroy();
    this.driving.destroy();
    this.vehicles.destroy();
    this.life.destroy();
    this.trucks.destroy();
    this.crates.destroy();
    this.fp.destroy();
    this.physics.destroy();
    this.s.orders.onDue = null;
    this.customers.clear();
    this.selfCheckout.clear();
    this.security.clear();
    this.mess.destroy();
    this.staff.destroy();
    this.furniture.destroy();
    this.boxes.destroy();
    this.products.dispose();
    this.held.hold(null);
    this.root.removeFromParent();
    this.lighting.dispose();
    this.lights.dispose();
    this.r.post.outline.selectedObjects = [];
  }
}
