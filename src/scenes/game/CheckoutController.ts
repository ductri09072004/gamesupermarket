import type { Keyboard } from '../../core/Input';
import type { Services } from '../../core/Services';
import { formatMoney } from '../../core/Random';
import type { Customer } from '../../entities/Customer';
import type { Player } from '../../entities/Player';
import { counterTiles } from '../../iso/Footprint';
import {
  customerCashPayment, evaluateChange, fromCents, itemsTotal, toCents, verifyCardInput,
  type CheckoutItem, type PaymentMethod,
} from '../../systems/CheckoutSystem';
import { completeSale } from '../../systems/SalesSystem';
import { CheckoutPanel } from '../../ui/checkoutPanel';
import type { CameraController } from './CameraController';
import type { CustomerManager } from './CustomerManager';
import type { StaffManager } from './StaffManager';

interface Session {
  customer: Customer;
  items: CheckoutItem[];
  startedAt: number;
  method: PaymentMethod | null;
  paid: number;
}

/** Chế độ thu ngân của người chơi. */
export class CheckoutController {
  active = false;
  counterUid: string | null = null;
  private panel = new CheckoutPanel();
  private session: Session | null = null;
  private cooldown = 0;

  constructor(
    private s: Services,
    private player: Player,
    private customers: CustomerManager,
    private staff: StaffManager,
    private camera: CameraController,
    keys: Keyboard,
  ) {
    keys.onKey((e) => this.onKey(e));
  }

  enter(counterUid: string): void {
    const counter = this.s.state.furniture(counterUid);
    if (!counter || this.active) return;
    const t = counterTiles(counter.gx, counter.gy, counter.rot);
    this.active = true;
    this.counterUid = counterUid;
    this.player.teleport(t.staff.gx + 0.5, t.staff.gy + 0.5);
    this.player.faceTowards(counter.gx + 0.5, counter.gy + 0.5);
    this.s.time.lockSpeed(true);
    this.staff.playerCounter = counterUid;
    const c = counterTiles(counter.gx, counter.gy, counter.rot).customer;
    this.camera.focus((t.staff.gx + c.gx) / 2 + 0.5, (t.staff.gy + c.gy) / 2 + 0.5);
    this.panel.open({
      onScan: (i) => this.scan(i),
      onCashConfirm: (c2) => this.confirmCash(c2),
      onCardSubmit: (inp) => this.submitCard(inp),
      onExit: () => this.exit(),
    });
    this.s.bus.emit('checkout:mode', { active: true, counterUid });
  }

  exit(): void {
    if (!this.active) return;
    if (this.session) this.session.customer.cancelService();
    this.session = null;
    this.active = false;
    this.counterUid = null;
    this.panel.close();
    this.s.time.lockSpeed(false);
    this.staff.playerCounter = null;
    this.camera.unfocus();
    this.s.bus.emit('checkout:mode', { active: false, counterUid: null });
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.active) return;
    if (e.code === 'Escape') { e.preventDefault(); this.exit(); return; }
    if (e.code === 'Space') { e.preventDefault(); this.panel.pressKey('space'); return; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.panel.pressKey('enter'); return; }
    if (e.code === 'Backspace') { this.panel.pressKey('back'); return; }
    if (e.key === '.' || e.key === ',') { this.panel.pressKey('.'); return; }
    if (/^[0-9]$/.test(e.key)) this.panel.pressKey(e.key);
  }

  update(dtMs: number): void {
    if (!this.active || !this.counterUid) return;
    if (!this.s.state.furniture(this.counterUid)) {
      this.exit();
      return;
    }
    if (this.cooldown > 0) {
      this.cooldown -= dtMs;
      if (this.cooldown <= 0) this.panel.showWaiting();
      return;
    }
    if (this.session) {
      if (this.session.customer.state !== 'served') {
        this.session = null;
        this.panel.showWaiting();
      }
      return;
    }
    const c = this.customers.frontCustomer(this.counterUid);
    if (!c || c.state === 'served') return;
    c.beginService();
    const items = c.basket.map((it) => ({ ...it, scanned: false }));
    this.session = { customer: c, items, startedAt: performance.now(), method: null, paid: 0 };
    this.panel.showItems(items);
    this.s.bus.emit('sound', { name: 'door' });
  }

  private scan(i: number): void {
    const ss = this.session;
    if (!ss || ss.method) return;
    const it = ss.items[i];
    if (!it || it.scanned) return;
    it.scanned = true;
    const scanned = ss.items.filter((x) => x.scanned);
    this.panel.markScanned(i, itemsTotal(scanned), scanned.length);
    this.s.bus.emit('sound', { name: 'beep' });
    if (scanned.length < ss.items.length) return;
    const total = itemsTotal(ss.items);
    ss.method = this.s.rng() < 0.6 ? 'cash' : 'card';
    if (ss.method === 'cash') {
      ss.paid = customerCashPayment(total, this.s.rng);
      this.panel.showCash(total, ss.paid);
    } else {
      ss.paid = total;
      this.panel.showCard(total);
    }
  }

  private confirmCash(givenCents: number): void {
    const ss = this.session;
    if (!ss || ss.method !== 'cash') return;
    const total = itemsTotal(ss.items);
    const due = toCents(ss.paid) - toCents(total);
    const ev = evaluateChange(due, givenCents);
    const note = ev.status === 'exact' ? 'Thối tiền chính xác!' : ev.status === 'over'
      ? `Thối dư ${formatMoney(fromCents(ev.diffCents))}` : `Thối thiếu ${formatMoney(fromCents(ev.diffCents))}`;
    this.finish(givenCents, note, ev.status !== 'short');
  }

  private submitCard(input: string): boolean {
    const ss = this.session;
    if (!ss || ss.method !== 'card') return false;
    if (!verifyCardInput(input, itemsTotal(ss.items))) {
      this.s.bus.emit('sound', { name: 'error' });
      return false;
    }
    this.finish(0, 'Thanh toán thẻ thành công', true);
    return true;
  }

  private finish(changeCents: number, note: string, happy: boolean): void {
    const ss = this.session;
    if (!ss || !ss.method || !this.counterUid) return;
    const counter = this.s.state.furniture(this.counterUid);
    const at = counter ? counterTiles(counter.gx, counter.gy, counter.rot).customer : this.player.tile;
    const duration = (performance.now() - ss.startedAt) / 1000;
    const r = completeSale(this.s, ss.customer.id, ss.items, ss.method, ss.paid, changeCents, duration, { gx: at.gx + 0.5, gy: at.gy + 0.5 });
    ss.customer.finishCheckout(happy);
    this.session = null;
    this.panel.showDone(r.revenue, note);
    this.cooldown = 900;
    this.s.bus.emit('tutorial:done', { step: 'checkout' });
  }
}
