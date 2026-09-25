import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { optimalChange, toCents } from '../systems/CheckoutSystem';
import type { CounterParts } from '../entities/CheckoutCounter';
import { moneyMesh } from './CheckoutProps';
import type { Effects } from './Effects';

/** Ngăn kéo tiền 3D: trượt ra/vào, tiền khách đưa và tiền thối xếp trên quầy. */
export class CashDrawer {
  given: Array<{ denom: number; mesh: THREE.Mesh }> = [];
  private paidMeshes: THREE.Mesh[] = [];
  private openT = 0;
  private target = 0;
  private baseZ: number;

  constructor(private parts: CounterParts, private root: THREE.Object3D, private effects: Effects) {
    this.baseZ = parts.drawer.position.z;
  }

  get givenCents(): number {
    return this.given.reduce((a, g) => a + toCents(g.denom), 0);
  }

  open(): void {
    this.target = 1;
  }

  close(): void {
    this.target = 0;
  }

  private world(v: THREE.Vector3): THREE.Vector3 {
    return v.clone().applyMatrix4(this.root.matrix);
  }

  /** Khách đặt tiền lên quầy. */
  showPaid(amount: number, fromWorld: THREE.Vector3): void {
    this.clearPaid();
    optimalChange(toCents(amount)).forEach((d, i) => {
      const m = moneyMesh(d);
      m.quaternion.setFromRotationMatrix(this.root.matrix);
      const to = this.world(this.parts.paidPoint.clone().add(new THREE.Vector3((i % 4) * 0.02, i * 0.003, Math.floor(i / 4) * 0.03)));
      this.effects.fly(m, fromWorld, to, { dur: 0.4 + i * 0.05, arc: 0.1, keep: true });
      this.paidMeshes.push(m);
    });
  }

  /** Lấy 1 tờ/đồng từ khay → đặt lên quầy. */
  take(denom: number, trayWorld: THREE.Vector3): void {
    const m = moneyMesh(denom);
    m.userData = { kind: 'change', index: this.given.length };
    m.quaternion.setFromRotationMatrix(this.root.matrix);
    const n = this.given.length;
    const off = new THREE.Vector3(-0.12 + (n % 6) * 0.05, 0.004 + Math.floor(n / 6) * 0.004, (Math.floor(n / 6) % 2) * 0.04);
    const to = this.world(this.parts.changePoint.clone().add(off));
    this.effects.fly(m, trayWorld, to, { dur: 0.22, arc: 0.08, keep: true });
    this.given.push({ denom, mesh: m });
  }

  /** Bỏ bớt 1 tờ đã lấy. */
  remove(mesh?: THREE.Object3D): void {
    const i = mesh ? this.given.findIndex((g) => g.mesh === mesh) : this.given.length - 1;
    if (i < 0) return;
    const [g] = this.given.splice(i, 1);
    g.mesh.removeFromParent();
  }

  clearGiven(): void {
    for (const g of this.given) g.mesh.removeFromParent();
    this.given = [];
  }

  clearPaid(): void {
    for (const m of this.paidMeshes) m.removeFromParent();
    this.paidMeshes = [];
  }

  givenMeshes(): THREE.Object3D[] {
    return this.given.map((g) => g.mesh);
  }

  update(dt: number): void {
    if (this.openT === this.target) return;
    const step = dt / FEEL.drawerSlideS;
    this.openT = this.target > this.openT ? Math.min(1, this.openT + step) : Math.max(0, this.openT - step);
    const k = 1 - Math.pow(1 - this.openT, 3);
    this.parts.drawer.position.z = this.baseZ + k * 0.34;
  }
}
