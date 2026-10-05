import * as THREE from 'three';
import { groundAt } from '../world/Alleys';
import { buildNavGrid, findRoute, type NavGrid, type Pt, type Route } from '../world/Navigation';
import type { World } from './World';

export interface Destination {
  x: number;
  z: number;
  label: string;
}

const ARRIVE_M = 3;
const RECALC_S = 1;
const GUIDE_RANGE = 70;
const STEP = 2.6;
const MAX_ARROWS = 40;

/**
 * Điểm đến người chơi chọn trên bản đồ: tính đường đi bộ (A* trên lưới thành phố), vẽ mũi tên chỉ lối trên mặt đất
 * (chỉ ~70m trước mặt), cột sáng ở đích, báo khi tới nơi. Đường được tính lại mỗi giây khi người chơi di chuyển.
 */
export class Waypoint {
  readonly group = new THREE.Group();
  dest: Destination | null = null;
  route: Route | null = null;
  /** Đã có điểm đến nhưng không có đường */
  unreachable = false;
  private grid: NavGrid | null = null;
  private gridKey: unknown = null;
  private timer = 0;
  private lastFrom: Pt | null = null;
  private arrows: THREE.InstancedMesh;
  private beacon: THREE.Mesh;
  private clock = 0;
  onChange: () => void = () => {};

  constructor(private w: World) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.9, depthWrite: false });
    const geo = new THREE.ConeGeometry(0.3, 0.8, 3).rotateX(Math.PI / 2).scale(1.7, 0.25, 1.5); // mũi tên dẹt, đầu về -Z
    this.arrows = new THREE.InstancedMesh(geo, mat, MAX_ARROWS);
    this.arrows.count = 0;
    this.arrows.frustumCulled = false;
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.beacon.visible = false;
    this.group.add(this.arrows, this.beacon);
  }

  private here(): Pt {
    const w = this.w;
    return w.mode === 'drive' ? { x: w.driving.state.x, z: w.driving.state.z } : { x: w.player.x, z: w.player.z };
  }

  private navGrid(): NavGrid {
    const solids = this.w.colliders();
    if (!this.grid || this.gridKey !== solids) {
      this.grid = buildNavGrid(this.w.city.layout.bounds, solids);
      this.gridKey = solids;
    }
    return this.grid;
  }

  /** Chọn điểm đến; trả false nếu không tìm được đường. */
  set(dest: Destination): boolean {
    this.dest = dest;
    this.recompute();
    this.onChange();
    return !this.unreachable;
  }

  clear(): void {
    this.dest = null;
    this.route = null;
    this.unreachable = false;
    this.arrows.count = 0;
    this.beacon.visible = false;
    this.onChange();
  }

  /** Tính lại đường đi từ vị trí hiện tại. */
  recompute(): void {
    if (!this.dest) return;
    const from = this.here();
    this.lastFrom = from;
    this.route = findRoute(this.navGrid(), from, this.dest);
    this.unreachable = !this.route;
  }

  /** Quãng đường còn lại (m): theo đường đi nếu có, không thì đường chim bay. */
  remaining(): number {
    if (!this.dest) return 0;
    if (this.route) return this.route.length;
    const p = this.here();
    return Math.hypot(this.dest.x - p.x, this.dest.z - p.z);
  }

  update(dt: number): void {
    if (!this.dest) return;
    this.clock += dt;
    const p = this.here();
    if (Math.hypot(this.dest.x - p.x, this.dest.z - p.z) < ARRIVE_M) {
      this.w.toast(`📍 Đã tới ${this.dest.label}`, 'success');
      this.clear();
      return;
    }
    this.timer += dt;
    const moved = this.lastFrom ? Math.hypot(p.x - this.lastFrom.x, p.z - this.lastFrom.z) : Infinity;
    if (this.timer >= RECALC_S && moved > 1.5) {
      this.timer = 0;
      this.recompute();
      this.onChange();
    }
    this.placeGuide(p);
  }

  /** Mũi tên dọc đường đi (từ vị trí người chơi, tối đa GUIDE_RANGE m) + cột sáng ở đích. */
  private placeGuide(p: Pt): void {
    const d = this.dest!;
    const alleys = this.w.city.layout.alleys;
    this.beacon.visible = true;
    this.beacon.position.set(d.x, groundAt(alleys, d.x, d.z) + 7, d.z);
    (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.1 * Math.sin(this.clock * 3);
    if (!this.route) {
      this.arrows.count = 0;
      return;
    }
    const pts = [p, ...this.route.pts.slice(1)];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    let acc = 0; // quãng đường tính tới đầu đoạn hiện tại
    let next = 1.5 + ((this.clock * 1.4) % STEP); // mũi tên trôi dần về phía đích
    for (let i = 1; i < pts.length && n < MAX_ARROWS && acc < GUIDE_RANGE; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-3) continue;
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      q.setFromAxisAngle(up, Math.atan2(-dx, -dz)); // mũi nhọn về -Z cục bộ → hướng (dx, dz)
      while (next < acc + len && next < GUIDE_RANGE && n < MAX_ARROWS) {
        const x = a.x + dx * (next - acc);
        const z = a.z + dz * (next - acc);
        this.arrows.setMatrixAt(n++, m.compose(new THREE.Vector3(x, groundAt(alleys, x, z) + 0.07, z), q, new THREE.Vector3(1, 1, 1)));
        next += STEP;
      }
      acc += len;
    }
    this.arrows.count = n;
    this.arrows.instanceMatrix.needsUpdate = true;
  }
}
