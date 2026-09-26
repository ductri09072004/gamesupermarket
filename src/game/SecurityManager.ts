import * as THREE from 'three';
import { SECURITY } from '../config/hygiene';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import type { Customer } from '../entities/Customer';
import type { SecurityApi } from '../entities/Staff';
import { productMesh } from '../products/PackagingFactory';
import { worldToCell } from '../world/NavGrid';
import { furnitureMatrix } from '../world/Placement';
import type { GameCtx } from './Ctx';
import type { CustomerManager } from './CustomerManager';
import type { MessManager } from './MessManager';

const inv = new THREE.Matrix4();
const proxyGeo = new THREE.BoxGeometry(0.7, 1.8, 0.7).translate(0, 0.9, 0);
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
const tmp = new THREE.Vector3();

/**
 * An ninh: khách trộm đi qua cổng an ninh → còi hú + đèn đỏ; bảo vệ (hoặc người chơi click) tóm được
 * thì hàng văng ra sàn. Trộm thoát → mất hàng.
 */
export class SecurityManager implements SecurityApi {
  private tracked = new Set<Customer>();
  private detected = new Set<Customer>();
  private alarms = new Map<string, number>();
  private blink = 0;
  /** Hộp raycast vô hình bám theo kẻ trộm đã lộ (click để tóm) — rẻ hơn raycast vào mesh có xương */
  readonly group = new THREE.Group();
  private proxies = new Map<Customer, THREE.Mesh>();

  constructor(private c: GameCtx, private customers: CustomerManager, private mess: MessManager) {}

  private gates(): FurnitureData[] {
    return this.c.s.data.furniture.filter((f) => getFurniture(f.type).kind === 'gate');
  }

  thieves(): Customer[] {
    return [...this.detected];
  }

  /** Đang đi qua giữa 2 cột cổng? */
  private inGate(f: FurnitureData, x: number, z: number): boolean {
    const def = getFurniture(f.type);
    tmp.set(x, 0, z).applyMatrix4(inv.copy(furnitureMatrix(f)).invert());
    return Math.abs(tmp.x) < def.size.w / 2 && Math.abs(tmp.z) < 0.6;
  }

  update(dt: number): void {
    for (const cu of this.customers.customers) if (cu.thief) this.tracked.add(cu);
    const gates = this.gates();
    for (const cu of [...this.tracked]) {
      if (cu.state === 'gone') {
        this.escaped(cu, gates.length > 0);
        continue;
      }
      if (!cu.thief) { this.tracked.delete(cu); this.detected.delete(cu); continue; }
      if (this.detected.has(cu)) continue;
      const gate = gates.find((g) => this.inGate(g, cu.x, cu.z));
      if (gate) this.trigger(gate, cu);
    }
    this.syncProxies();
    this.blink += dt;
    for (const g of gates) {
      const parts = this.c.furniture.get(g.uid)?.gate;
      let t = this.alarms.get(g.uid) ?? 0;
      if (t > 0) {
        const before = t;
        t = Math.max(0, t - dt);
        this.alarms.set(g.uid, t);
        // còi dài 1.2s → phát lại cho tới hết thời gian báo động
        if (Math.floor(before / 1.2) !== Math.floor(t / 1.2) && t > 0) this.siren(g);
      }
      if (!parts) continue;
      const on = t > 0 && Math.floor(this.blink * 6) % 2 === 0;
      parts.light.color.setHex(t > 0 ? 0xef4444 : 0x22c55e);
      parts.light.emissive.setHex(t > 0 ? 0xef4444 : 0x22c55e);
      parts.light.emissiveIntensity = t > 0 ? (on ? 4 : 0.3) : 0.8;
    }
  }

  private syncProxies(): void {
    for (const [cu, m] of this.proxies) {
      if (this.detected.has(cu)) continue;
      m.removeFromParent();
      this.proxies.delete(cu);
    }
    for (const cu of this.detected) {
      let m = this.proxies.get(cu);
      if (!m) {
        m = new THREE.Mesh(proxyGeo, proxyMat);
        m.userData = { kind: 'thief', uid: cu.id };
        this.group.add(m);
        this.proxies.set(cu, m);
      }
      m.position.set(cu.x, 0, cu.z);
    }
  }

  /** Kẻ trộm theo id (người chơi click hộp raycast). */
  byId(id: string): Customer | undefined {
    return [...this.detected].find((c) => c.id === id);
  }

  private siren(g: FurnitureData): void {
    this.c.sound('alarm', new THREE.Vector3(0, 1.5, 0).applyMatrix4(furnitureMatrix(g)));
  }

  private trigger(gate: FurnitureData, cu: Customer): void {
    this.detected.add(cu);
    this.alarms.set(gate.uid, SECURITY.alarmS);
    this.siren(gate);
    cu.alarm();
    const guard = this.c.s.data.staff.some((x) => x.role === 'guard');
    this.c.toast(guard ? '🚨 Cổng an ninh báo động! Bảo vệ đang đuổi theo...' : '🚨 Cổng an ninh báo động! Click vào kẻ trộm để tóm lại!', 'error');
  }

  private escaped(cu: Customer, hasGate: boolean): void {
    this.tracked.delete(cu);
    this.detected.delete(cu);
    const value = cu.basketItems.reduce((a, i) => a + i.price, 0);
    this.c.toast(hasGate
      ? `🏃 Kẻ trộm đã chạy thoát với $${value.toFixed(2)} tiền hàng!`
      : `🕵️ Một khách vừa lén mang $${value.toFixed(2)} hàng ra không trả tiền! (Mua Cổng an ninh để phát hiện)`, 'error');
  }

  /** Tóm được: hàng văng tung toé quanh kẻ trộm. */
  catchThief(cu: Customer, by: 'guard' | 'player'): void {
    if (!this.detected.has(cu) && !cu.thief) return;
    this.detected.delete(cu);
    this.tracked.delete(cu);
    const from = new THREE.Vector3(cu.x, 1, cu.z);
    this.c.sound('punch', from);
    const items = cu.caught();
    const g = this.c.s.grid;
    items.forEach((pid, i) => {
      // văng ra theo vòng tròn, chỉ rơi xuống chỗ đi được
      let x = cu.x;
      let z = cu.z;
      for (let k = 0; k < 6; k++) {
        const a = (i / items.length) * Math.PI * 2 + k * 0.7 + this.c.s.rng() * 0.5;
        const r = 0.5 + this.c.s.rng() * 0.7;
        const cell = worldToCell(cu.x + Math.cos(a) * r, cu.z + Math.sin(a) * r);
        if (!g.isWalkable(cell.gx, cell.gy)) continue;
        x = cu.x + Math.cos(a) * r;
        z = cu.z + Math.sin(a) * r;
        break;
      }
      this.c.effects.fly(productMesh(pid), from, new THREE.Vector3(x, 0.05, z), {
        dur: 0.45 + i * 0.03, arc: 0.6, wobble: 1, onDone: () => this.mess.addLoose(pid, x, z),
      });
    });
    this.c.s.progression.changeReputation(SECURITY.repCaught);
    const names = [...new Set(items.map((p) => getProduct(p).icon))].join('');
    this.c.toast(by === 'guard' ? `🛡️ Bảo vệ đã tóm được kẻ trộm! ${names} rơi ra sàn` : `💪 Bạn đã tóm được kẻ trộm! Nhặt ${names} về kệ`, 'success');
  }

  clear(): void {
    this.group.clear();
    this.proxies.clear();
    this.tracked.clear();
    this.detected.clear();
    this.alarms.clear();
  }
}
