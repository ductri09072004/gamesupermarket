import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getProduct } from '../config/products';
import { formatMoney } from '../core/Random';
import type { Customer } from '../entities/Customer';
import type { FurnitureView } from '../entities/Shelf';
import {
  changeDueCents, customerCashPayment, evaluateChange, fromCents, itemsTotal, posInput, verifyCardInput,
  type CheckoutItem, type PaymentMethod,
} from '../systems/CheckoutSystem';
import { completeSale } from '../systems/SalesSystem';
import { CheckoutStrip } from '../ui/checkoutPanel';
import { counterTiles } from '../world/Footprint';
import { cellCenter } from '../world/NavGrid';
import { CashDrawer } from './CashDrawer';
import { bagMesh, cardMesh, drawLcd } from './CheckoutProps';
import type { GameCtx } from './Ctx';
import type { CustomerManager } from './CustomerManager';
import type { StaffManager } from './StaffManager';
import { productMesh } from '../products/PackagingFactory';
import { bindCheckoutInput } from './CheckoutInput';

export interface Session {
  customer: Customer;
  items: CheckoutItem[];
  meshes: Array<THREE.Mesh | null>;
  placed: number;
  placeTimer: number;
  startedAt: number;
  method: PaymentMethod | null;
  paid: number;
  pos: string;
  lcd: string[];
  card: THREE.Mesh | null;
}

/** Chế độ thu ngân 3D của người chơi. */
export class CheckoutController {
  active = false;
  counterUid: string | null = null;
  view: FurnitureView | null = null;
  private strip = new CheckoutStrip();
  session: Session | null = null;
  drawer: CashDrawer | null = null;
  private cooldown = 0;
  private laserT = 0;
  private savedQuat = new THREE.Quaternion();

  constructor(private c: GameCtx, private customers: CustomerManager, private staff: StaffManager) {
    bindCheckoutInput(this, c);
  }

  enter(counterUid: string): void {
    const c = this.c;
    const counter = c.s.state.furniture(counterUid);
    const view = c.furniture.get(counterUid);
    if (!counter || !view?.counter || this.active) return;
    this.active = true;
    this.counterUid = counterUid;
    this.view = view;
    c.mode = 'checkout';
    const t = counterTiles(view.def, counter.gx, counter.gy, counter.rot);
    const st = cellCenter(t.staff.gx, t.staff.gy);
    c.player.teleport(st.x, st.z);
    c.player.cameraOverride = true;
    this.savedQuat.copy(c.camera.quaternion);
    c.tween.go(view.toWorld(view.counter.cashierView), view.toWorld(view.counter.cashierLook), FEEL.cameraTweenS);
    c.s.time.lockSpeed(true);
    this.staff.playerCounter = counterUid;
    this.drawer = new CashDrawer(view.counter, view.root, c.effects);
    c.input.exitLock();
    c.input.lookEnabled = false;
    this.strip.open({ onConfirm: () => this.confirmCash(), onExit: () => this.exit(), onUndo: () => this.drawer?.remove() });
    drawLcd(view.counter.lcd.canvas, ['MINI MART', 'Xin chào!'], 0);
    view.counter.lcd.tex.needsUpdate = true;
    c.s.bus.emit('checkout:mode', { active: true, counterUid });
  }

  exit(): void {
    if (!this.active) return;
    const c = this.c;
    if (this.session) this.abortSession();
    this.drawer?.clearGiven();
    this.drawer?.clearPaid();
    this.drawer?.close();
    this.active = false;
    this.counterUid = null;
    this.strip.close();
    c.s.time.lockSpeed(false);
    this.staff.playerCounter = null;
    c.input.lookEnabled = true;
    c.player.cameraOverride = true;
    const eye = new THREE.Vector3(c.player.x, c.player.eye, c.player.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.player.pitch, c.player.yaw, 0, 'YXZ'));
    c.tween.goTo(eye, q, FEEL.cameraTweenS * 0.8, () => {
      c.player.cameraOverride = false;
      c.mode = 'play';
    });
    c.s.bus.emit('checkout:mode', { active: false, counterUid: null });
  }

  private abortSession(): void {
    const ss = this.session!;
    for (const m of ss.meshes) m?.removeFromParent();
    ss.card?.removeFromParent();
    ss.customer.cancelService();
    this.session = null;
  }

  private world(v: THREE.Vector3): THREE.Vector3 { return this.view!.toWorld(v); }

  private beltPos(i: number): THREE.Vector3 {
    const p = this.view!.counter!;
    const t = Math.min(1, i / 7);
    return this.world(p.beltEnd.clone().lerp(p.beltStart, t));
  }

  update(dt: number): void {
    if (!this.active || !this.counterUid || !this.view?.counter) return;
    const c = this.c;
    this.drawer?.update(dt);
    // nhìn nhẹ theo chuột
    if (!c.tween.running) {
      const mx = c.input.mouseX / window.innerWidth - 0.5;
      const my = c.input.mouseY / window.innerHeight - 0.5;
      const base = c.tween.target.quat.clone();
      const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(-my * 0.25, -mx * 0.35, 0, 'YXZ'));
      c.camera.quaternion.slerp(base.multiply(off), Math.min(1, dt * 6));
    }
    if (this.laserT > 0) {
      this.laserT -= dt;
      (this.view.counter.laser.material as THREE.MeshBasicMaterial).opacity = this.laserT > 0 ? 0.95 : 0.25;
    }
    if (!c.s.state.furniture(this.counterUid)) {
      this.exit();
      return;
    }
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.strip.waiting();
      return;
    }
    const ss = this.session;
    if (ss) {
      if (ss.customer.state !== 'served') {
        this.abortSession();
        this.strip.waiting();
        return;
      }
      // khách đặt từng món lên băng chuyền
      if (ss.placed < ss.items.length) {
        ss.placeTimer -= dt;
        if (ss.placeTimer <= 0) this.placeNext(ss);
      }
      return;
    }
    const cu = this.customers.frontCustomer(this.counterUid);
    if (!cu || cu.state === 'served') return;
    const center = this.world(new THREE.Vector3(0, 0, 0));
    cu.beginService({ x: center.x, z: center.z });
    const items = cu.basketItems.map((it) => ({ ...it, scanned: false }));
    this.session = {
      customer: cu, items, meshes: items.map(() => null), placed: 0, placeTimer: 0.3, startedAt: performance.now(),
      method: null, paid: 0, pos: '', lcd: ['MINI MART'], card: null,
    };
    this.strip.scanning(0, items.length, 0);
  }

  private placeNext(ss: Session): void {
    const i = ss.placed++;
    ss.placeTimer = 0.3;
    const out = ss.customer.basket.takeOut();
    const mesh = out?.mesh ?? productMesh(ss.items[i].productId);
    const from = out?.world ?? ss.customer.basket.group.getWorldPosition(new THREE.Vector3());
    mesh.userData = { kind: 'beltItem', index: i };
    mesh.quaternion.setFromRotationMatrix(this.view!.root.matrix);
    this.c.effects.fly(mesh, from, this.beltPos(i), { dur: 0.35, arc: 0.15, keep: true });
    ss.meshes[i] = mesh;
    this.c.sound('tock', this.beltPos(i), 0.8);
  }

  scan(i: number): void {
    const ss = this.session;
    const parts = this.view?.counter;
    if (!ss || !parts || ss.method) return;
    const it = ss.items[i];
    const mesh = ss.meshes[i];
    if (!it || it.scanned || !mesh) return;
    it.scanned = true;
    mesh.userData = {};
    const scanW = this.world(parts.scanPoint);
    this.c.effects.fly(mesh, mesh.position.clone(), scanW, {
      dur: FEEL.scanFlyS * 0.5, arc: 0.05, keep: true,
      onDone: () => {
        this.laserT = 0.15;
        this.c.sound('beep', scanW);
        this.c.effects.fly(mesh, scanW, this.world(parts.bagPoint), { dur: FEEL.scanFlyS * 0.5, arc: 0.12 });
      },
    });
    const p = getProduct(it.productId);
    const scanned = ss.items.filter((x) => x.scanned);
    const total = itemsTotal(scanned);
    ss.lcd.push(`${p.name.slice(0, 16).padEnd(16)} ${it.price.toFixed(2)}`);
    drawLcd(parts.lcd.canvas, ss.lcd, total);
    parts.lcd.tex.needsUpdate = true;
    this.strip.scanning(scanned.length, ss.items.length, total);
    if (scanned.length < ss.items.length || ss.placed < ss.items.length) return;
    setTimeout(() => this.startPayment(), FEEL.scanFlyS * 1000 + 150);
  }

  private startPayment(): void {
    const ss = this.session;
    if (!ss || ss.method || !this.view?.counter) return;
    const c = this.c;
    const total = itemsTotal(ss.items);
    ss.method = c.s.rng() < 0.6 ? 'cash' : 'card';
    const hand = ss.customer.human.handR.getWorldPosition(new THREE.Vector3());
    if (ss.method === 'cash') {
      ss.paid = customerCashPayment(total, c.s.rng);
      this.drawer!.showPaid(ss.paid, hand);
      this.drawer!.open();
      c.sound('drawerOpen', this.world(this.view.counter.changePoint));
      this.refreshCash();
    } else {
      ss.paid = total;
      ss.card = cardMesh();
      ss.card.quaternion.setFromRotationMatrix(this.view.root.matrix);
      c.effects.fly(ss.card, hand, this.world(this.view.counter.cardPoint), { dur: 0.5, arc: 0.1, keep: true });
      this.strip.card(total, '');
    }
  }

  refreshCash(): void {
    const ss = this.session;
    if (!ss) return;
    const total = itemsTotal(ss.items);
    const due = changeDueCents(total, ss.paid);
    this.strip.cash(total, ss.paid, fromCents(due), fromCents(this.drawer!.givenCents));
    drawLcd(this.view!.counter!.lcd.canvas, [...ss.lcd.slice(-2), `PAID  ${ss.paid.toFixed(2)}`, `CHANGE ${fromCents(due).toFixed(2)}`], total);
    this.view!.counter!.lcd.tex.needsUpdate = true;
  }

  confirmCash(): void {
    const ss = this.session;
    if (!ss || ss.method !== 'cash') return;
    const total = itemsTotal(ss.items);
    const ev = evaluateChange(changeDueCents(total, ss.paid), this.drawer!.givenCents);
    const note = ev.status === 'exact' ? 'Thối tiền chính xác!' : ev.status === 'over'
      ? `Thối dư ${formatMoney(fromCents(ev.diffCents))}` : `Thối thiếu ${formatMoney(fromCents(ev.diffCents))}`;
    this.finish(this.drawer!.givenCents, note, ev.status !== 'short');
  }

  posKey(key: string): void {
    const ss = this.session;
    if (!ss || ss.method !== 'card') return;
    const total = itemsTotal(ss.items);
    this.c.sound('click');
    if (key === 'enter') {
      if (verifyCardInput(ss.pos, total)) {
        this.finish(0, 'Thanh toán thẻ thành công', true);
      } else {
        this.c.sound('error');
        this.strip.card(total, ss.pos, true);
        ss.pos = '';
      }
      return;
    }
    ss.pos = posInput(ss.pos, key);
    this.strip.card(total, ss.pos);
    drawLcd(this.view!.counter!.lcd.canvas, ss.lcd, total, `$${ss.pos || '0'}`);
    this.view!.counter!.lcd.tex.needsUpdate = true;
  }

  private finish(changeCents: number, note: string, happy: boolean): void {
    const ss = this.session;
    const view = this.view;
    if (!ss || !ss.method || !view?.counter || !this.counterUid) return;
    const c = this.c;
    const at = this.world(new THREE.Vector3(0, 1.2, -0.6));
    const duration = (performance.now() - ss.startedAt) / 1000;
    const r = completeSale(c.s, ss.customer.id, ss.items, ss.method, ss.paid, changeCents, duration, { gx: at.x, gy: at.z });
    c.effects.floatText(`+$${r.revenue.toFixed(2)}`, at.clone().setY(1.5));
    this.drawer!.clearGiven();
    this.drawer!.clearPaid();
    this.drawer!.close();
    if (ss.method === 'cash') c.sound('drawerClose', this.world(view.counter.changePoint));
    ss.card?.removeFromParent();
    ss.customer.finishCheckout(happy, bagMesh());
    this.session = null;
    this.strip.done(r.revenue, note);
    drawLcd(view.counter.lcd.canvas, ['CẢM ƠN QUÝ KHÁCH!', note.slice(0, 26)], r.revenue);
    view.counter.lcd.tex.needsUpdate = true;
    this.cooldown = 1;
    c.s.bus.emit('tutorial:done', { step: 'checkout' });
  }

  get hasSession(): boolean { return this.session !== null; }
}
