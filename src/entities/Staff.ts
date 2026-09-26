import * as THREE from 'three';
import { STAFF_PAY_S, STAFF_SCAN_S, STAFF_SPEED } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { DirtData, LooseItem, StaffData } from '../core/GameState';
import type { Services } from '../core/Services';
import { customerCashPayment, itemsTotal, optimalChange, sumCents } from '../systems/CheckoutSystem';
import { completeSale } from '../systems/SalesSystem';
import { adjacentTiles, counterTiles, type GridPoint } from '../world/Footprint';
import { cellCenter } from '../world/NavGrid';
import { furnitureCenter } from '../world/Placement';
import type { Customer } from './Customer';
import { STAFF_MODELS } from '../config/characters';
import { HAIRS, SKINS } from './Human';
import { Walker } from './Walker';
import { HelperBrain, type KioskHelpApi } from './StaffHelper';
import { StockerBrain } from './StaffStocker';
import { CleanerBrain } from './StaffCleaner';
import { GuardBrain } from './StaffGuard';
import type { StaffBody, StaffBrain } from './StaffTypes';

/** Việc dọn dẹp / hàng rơi (MessManager cài đặt). */
export interface MessApi {
  dirtJobs(by: string): DirtData[];
  looseJobs(by: string): LooseItem[];
  claim(uid: string, by: string): boolean;
  release(uid: string, by: string): void;
  workSpots(x: number, z: number, glass: boolean): GridPoint[];
  cleanDirt(uid: string, pos?: THREE.Vector3): boolean;
  takeLoose(uid: string): LooseItem | null;
  addLoose(productId: string, x: number, z: number): void;
  returnToShelf(productId: string, from: THREE.Vector3): boolean;
}

/** An ninh (SecurityManager cài đặt). */
export interface SecurityApi {
  /** Kẻ trộm đã bị cổng phát hiện, chưa bị tóm */
  thieves(): Customer[];
  catchThief(c: Customer, by: 'guard' | 'player'): void;
}

export interface StaffWorld {
  s: Services;
  frontCustomer(counterUid: string): Customer | null;
  isPlayerAtCounter(counterUid: string): boolean;
  reserved: Set<string>;
  shakeFurniture(uid: string): void;
  stockFx(furnUid: string, slot: number, from: THREE.Vector3): void;
  saleFx(amount: number, at: THREE.Vector3): void;
  kiosks: KioskHelpApi;
  mess: MessApi;
  security: SecurityApi;
  /** Chỗ nghỉ riêng của nhân viên (vỉa hè ngoài mặt tiền, không chắn cửa) */
  restSpot(uid: string): GridPoint;
  /** Điểm ra/vào ở mép vỉa hè (thu ngân hết quầy đi về đây rồi ẩn) */
  exitSpot(): GridPoint;
  /** Ô đứng canh của bảo vệ */
  guardPost(): GridPoint[];
}

/** Đồng phục cửa hàng: áo xanh ngọc, tạp dề vàng. */
const UNIFORM = { shirt: 0x1f7a6d, pants: 0x2b2d42, apron: 0xffd166 };

export class StaffNpc extends Walker implements StaffBody {
  counterUid: string | null = null;
  speedMul = 1;
  private timer = 0;
  private customer: Customer | null = null;
  private serviceTotal = 0;
  private status = '';
  private brain: StaffBrain | null = null;

  constructor(readonly world: StaffWorld, public data: StaffData, start: GridPoint) {
    super(world.s, { ...UNIFORM, skin: SKINS[data.shirt % SKINS.length], hair: HAIRS[data.shirt % HAIRS.length], female: data.shirt % 2 === 0, model: STAFF_MODELS[data.shirt % 2 === 0 ? 1 : 0] },
      cellCenter(start.gx, start.gy).x, cellCenter(start.gx, start.gy).z);
    if (data.role === 'helper') this.brain = new HelperBrain(this, world.kiosks);
    else if (data.role === 'stocker') this.brain = new StockerBrain(this);
    else if (data.role === 'cleaner') this.brain = new CleanerBrain(this);
    else if (data.role === 'guard') this.brain = new GuardBrain(this);
  }

  setStatus(text: string): void {
    if (text === this.status) return;
    this.status = text;
    this.bubble.show(text, 0);
  }

  /** Đang có mặt ở cửa hàng (thu ngân không có quầy thì ẩn). */
  get onDuty(): boolean {
    return this.human.root.visible;
  }

  goRest(): boolean {
    const spot = this.world.restSpot(this.data.uid);
    const here = this.cell;
    if (here.gx === spot.gx && here.gy === spot.gy) {
      this.face(this.x, this.z + 5); // nhìn ra đường
      return true;
    }
    if (!this.walkTo(spot)) return true;
    this.setStatus('🚶 Ra ngoài nghỉ');
    return false;
  }

  tick(sim: number, dt: number): void {
    if (this.data.role === 'cashier' && !this.counterUid) {
      this.offDuty(sim, dt);
      return;
    }
    if (!this.onDuty) this.arrive();
    const moving = this.step(STAFF_SPEED * this.data.speed * this.speedMul * sim, sim > 0 ? dt : 0);
    if (sim > 0) this.brain?.update?.(dt);
    if (moving || sim <= 0) return;
    if (this.data.role === 'cashier') this.cashier(sim);
    else this.brain?.tick(sim);
  }

  /** Thu ngân không có quầy: đi ra mép vỉa hè rồi biến mất (không đứng lảng vảng trong cửa hàng). */
  private offDuty(sim: number, dt: number): void {
    if (this.customer) { this.customer.cancelService(); this.customer = null; }
    if (!this.onDuty) return;
    const moving = this.step(STAFF_SPEED * this.data.speed * sim, sim > 0 ? dt : 0);
    if (moving || sim <= 0) return;
    const exit = this.world.exitSpot();
    const here = this.cell;
    if ((here.gx === exit.gx && here.gy === exit.gy) || !this.walkTo(exit)) this.hide();
    else this.setStatus('🏠 Hết quầy trống');
  }

  /** Ẩn khỏi cửa hàng (thu ngân dư). */
  hide(): void {
    this.stop();
    this.human.root.visible = false;
    this.bubble.hide();
    this.status = '';
  }

  /** Có quầy trống: xuất hiện ở mép vỉa hè rồi đi vào. */
  private arrive(): void {
    const e = this.world.exitSpot();
    const c = cellCenter(e.gx, e.gy);
    this.x = c.x;
    this.z = c.z;
    this.sync();
    this.human.root.visible = true;
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

  destroy(): void {
    this.brain?.destroy();
    this.customer?.cancelService();
    this.dispose();
  }
}
