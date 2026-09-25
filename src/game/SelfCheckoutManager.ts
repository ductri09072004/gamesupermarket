import * as THREE from 'three';
import { REP_SELF_HELPED, SELF_ASSIST_SPEEDUP, SELF_HELP_PATIENCE_S, SELF_PAY_S, SELF_SCAN_S } from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import type { Customer } from '../entities/Customer';
import type { KioskHelpApi } from '../entities/StaffHelper';
import { productMesh } from '../products/PackagingFactory';
import { itemsTotal, type CheckoutItem } from '../systems/CheckoutSystem';
import { completeSale } from '../systems/SalesSystem';
import { rollHelpIndex } from '../systems/SelfCheckoutSystem';
import { adjacentTiles, counterTiles, footprintCells, type GridPoint } from '../world/Footprint';
import { bagMesh } from './CheckoutProps';
import type { GameCtx } from './Ctx';
import type { CustomerManager } from './CustomerManager';
import { drawKioskScreen, type KioskScreenState } from './KioskScreen';

interface Session {
  customer: Customer;
  items: CheckoutItem[];
  scanned: number;
  timer: number;
  /** Món thứ mấy khách bị bí (-1 = tự làm được) */
  helpAt: number;
  helped: boolean;
  phase: 'scan' | 'help' | 'pay';
  wait: number;
  elapsed: number;
  lines: string[];
  claimedBy: string | null;
}

const LIGHT = { idle: 0x22c55e, busy: 0x3b82f6, help: 0xef4444 };

/**
 * Máy tự tính tiền: khách đứng đầu hàng tự quét từng món → trả tiền tại máy.
 * Một số khách bí giữa chừng (đèn đỏ nháy) → người chơi (E) hoặc nhân viên chăm sóc khách tới giúp.
 */
export class SelfCheckoutManager implements KioskHelpApi {
  private sessions = new Map<string, Session>();
  private screenKeys = new Map<string, string>();
  private done = new Map<string, { t: number; total: number }>();
  private blink = 0;

  constructor(private c: GameCtx, private customers: CustomerManager) {}

  private kiosks(): FurnitureData[] {
    return this.c.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'selfcheckout');
  }

  update(sim: number, dt: number): void {
    this.blink += dt;
    const alive = new Set<string>();
    for (const k of this.kiosks()) {
      alive.add(k.uid);
      let ss = this.sessions.get(k.uid);
      // khách bỏ đi / máy bị dời → huỷ phiên
      if (ss && ss.customer.state !== 'served') {
        this.sessions.delete(k.uid);
        ss = undefined;
      }
      if (!ss && sim > 0) {
        const cu = this.customers.frontCustomer(k.uid);
        if (cu && cu.state !== 'served') ss = this.begin(k, cu);
      }
      if (ss && sim > 0) this.step(k, ss, sim);
      const d = this.done.get(k.uid);
      if (d && (d.t -= dt) <= 0) this.done.delete(k.uid);
      this.render(k.uid, this.sessions.get(k.uid));
    }
    for (const uid of [...this.sessions.keys()]) if (!alive.has(uid)) this.sessions.delete(uid);
  }

  private at(uid: string, local: THREE.Vector3): THREE.Vector3 {
    return this.c.furniture.get(uid)?.toWorld(local) ?? local;
  }

  private begin(k: FurnitureData, cu: Customer): Session {
    const center = this.at(k.uid, new THREE.Vector3());
    cu.beginService({ x: center.x, z: center.z });
    const items = cu.basketItems.map((it) => ({ ...it, scanned: false }));
    const ss: Session = {
      customer: cu, items, scanned: 0, timer: 0.8, helpAt: rollHelpIndex(items.length, cu.elder, this.c.s.rng),
      helped: false, phase: 'scan', wait: 0, elapsed: 0, lines: [], claimedBy: null,
    };
    this.sessions.set(k.uid, ss);
    this.done.delete(k.uid);
    return ss;
  }

  private step(k: FurnitureData, ss: Session, sim: number): void {
    ss.elapsed += sim;
    if (ss.phase === 'help') {
      ss.wait += sim;
      if (ss.wait > SELF_HELP_PATIENCE_S) {
        this.sessions.delete(k.uid);
        ss.customer.walkout('😤 Chẳng ai giúp cả!');
      }
      return;
    }
    ss.timer -= sim;
    if (ss.timer > 0) return;
    if (ss.phase === 'pay') {
      this.finish(k, ss);
      return;
    }
    if (!ss.helped && ss.scanned === ss.helpAt) {
      ss.phase = 'help';
      ss.wait = 0;
      ss.customer.askHelp();
      this.c.sound('error', this.at(k.uid, new THREE.Vector3(0, 1.3, 0)), 0.8);
      this.c.toast('🙋 Có khách cần hỗ trợ ở máy tự tính tiền!', 'info');
      return;
    }
    this.scanOne(k, ss);
    ss.timer = SELF_SCAN_S / (ss.helped ? SELF_ASSIST_SPEEDUP : 1);
    if (ss.scanned >= ss.items.length) {
      ss.phase = 'pay';
      ss.timer = SELF_PAY_S;
    }
  }

  private scanOne(k: FurnitureData, ss: Session): void {
    const it = ss.items[ss.scanned++];
    it.scanned = true;
    const parts = this.c.furniture.get(k.uid)?.kiosk;
    if (parts) {
      const out = ss.customer.basket.takeOut();
      const mesh = out?.mesh ?? productMesh(it.productId);
      const from = out?.world ?? ss.customer.basket.group.getWorldPosition(new THREE.Vector3());
      const scan = this.at(k.uid, parts.scanPoint);
      const bag = this.at(k.uid, parts.bagPoint);
      this.c.effects.fly(mesh, from, scan, {
        dur: 0.4, arc: 0.12, keep: true,
        onDone: () => {
          this.c.sound('beep', scan);
          this.c.effects.fly(mesh, scan, bag, { dur: 0.3, arc: 0.1 });
        },
      });
    }
    ss.customer.human.reach();
    const name = getProduct(it.productId).name.slice(0, 20);
    ss.lines.push(`${name}  $${it.price.toFixed(2)}`);
  }

  private finish(k: FurnitureData, ss: Session): void {
    const s = this.c.s;
    const total = itemsTotal(ss.items);
    const at = this.at(k.uid, new THREE.Vector3(0, 1.5, -0.5));
    // máy tự thối đúng tiền → không có rủi ro thối sai
    const r = completeSale(s, ss.customer.id, ss.items, s.rng() < 0.7 ? 'card' : 'cash', total, 0, ss.elapsed, { gx: at.x, gy: at.z });
    if (ss.helped) s.progression.changeReputation(REP_SELF_HELPED);
    this.c.effects.floatText(`+$${r.revenue.toFixed(2)}`, at);
    ss.customer.finishCheckout(true, bagMesh());
    this.sessions.delete(k.uid);
    this.done.set(k.uid, { t: 2.5, total: r.revenue });
  }

  private render(uid: string, ss: Session | undefined): void {
    const parts = this.c.furniture.get(uid)?.kiosk;
    if (!parts) return;
    const blinkOn = Math.floor(this.blink * 3) % 2 === 0;
    const done = this.done.get(uid);
    let st: KioskScreenState;
    let light = LIGHT.idle;
    let glow = 0.6;
    if (ss?.phase === 'help') {
      st = { kind: 'help', blink: blinkOn };
      light = LIGHT.help;
      glow = blinkOn ? 3 : 0.4;
    } else if (ss?.phase === 'pay') {
      st = { kind: 'pay', total: itemsTotal(ss.items) };
      light = LIGHT.busy;
    } else if (ss) {
      st = { kind: 'scan', lines: ss.lines, total: itemsTotal(ss.items.filter((i) => i.scanned)), count: ss.scanned, of: ss.items.length };
      light = LIGHT.busy;
    } else st = done ? { kind: 'done', total: done.total } : { kind: 'idle' };
    parts.light.emissive.setHex(light);
    parts.light.color.setHex(light);
    parts.light.emissiveIntensity = glow;
    const key = JSON.stringify(st);
    if (this.screenKeys.get(uid) === key) return;
    this.screenKeys.set(uid, key);
    drawKioskScreen(parts.screen.canvas, st);
    parts.screen.tex.needsUpdate = true;
  }

  // ---------- Hỗ trợ khách (người chơi / nhân viên) ----------
  requests(): FurnitureData[] {
    return this.kiosks().filter((k) => {
      const ss = this.sessions.get(k.uid);
      return ss?.phase === 'help' && !ss.claimedBy;
    });
  }

  claim(uid: string, by: string): boolean {
    const ss = this.sessions.get(uid);
    if (ss?.phase !== 'help' || ss.claimedBy) return false;
    ss.claimedBy = by;
    return true;
  }

  release(uid: string, by: string): void {
    const ss = this.sessions.get(uid);
    if (ss?.claimedBy === by) ss.claimedBy = null;
  }

  needsHelp(uid: string): boolean {
    return this.sessions.get(uid)?.phase === 'help';
  }

  assist(uid: string): boolean {
    const ss = this.sessions.get(uid);
    if (ss?.phase !== 'help') return false;
    ss.phase = 'scan';
    ss.helped = true;
    ss.claimedBy = null;
    ss.timer = 0.4;
    ss.customer.thankHelp();
    this.c.sound('click', this.at(uid, new THREE.Vector3(0, 1.2, 0)));
    return true;
  }

  helpSpots(uid: string): GridPoint[] {
    const f = this.c.s.state.furniture(uid);
    if (!f) return [];
    const def = getFurniture(f.type);
    const cust = counterTiles(def, f.gx, f.gy, f.rot).customer;
    const g = this.c.s.grid;
    return adjacentTiles(footprintCells(def, f.gx, f.gy, f.rot))
      .filter((p) => g.isWalkable(p.gx, p.gy) && g.isStoreInterior(p.gx, p.gy) && !(p.gx === cust.gx && p.gy === cust.gy));
  }

  /** Gợi ý phím dưới tâm ngắm khi nhìn vào máy. */
  hint(uid: string): string {
    const ss = this.sessions.get(uid);
    if (ss?.phase === 'help') return '<kbd>E</kbd> Hỗ trợ khách tính tiền';
    return ss ? '🖥️ Khách đang tự thanh toán' : '🖥️ Máy tự tính tiền — đang chờ khách';
  }

  clear(): void {
    this.sessions.clear();
  }
}
