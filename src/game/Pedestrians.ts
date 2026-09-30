import * as THREE from 'three';
import { WALKING_VENDOR } from '../config/city';
import { CUSTOMER_MODELS } from '../config/characters';
import { DOOR_X } from '../config/constants';
import { activeQuality } from '../config/quality';
import { PEDESTRIANS } from '../config/traffic';
import { HAIRS, PANTS, SHIRTS, SKINS, type HumanBody } from '../entities/Human';
import { createHuman } from '../entities/RiggedHuman';
import { FAR_ANIM_INTERVAL } from '../entities/Walker';
import { vendorsPackUp } from '../systems/WeatherSystem';
import { walkingVendorsOut } from '../systems/VendorSystem';
import type { CityLayout } from '../world/CityLayout';
import { poseAt, walkLoops, type Route } from '../world/CityRoutes';
import { buildVendorGear, type VendorGear } from './VendorGear';

interface Walker {
  human: HumanBody;
  route: Route;
  d: number;
  speed: number;
  /** Đi sát lề hơn trước mặt tiền siêu thị (né thùng giao hàng) */
  curb: number;
  x: number;
  z: number;
  /** Gánh hàng rong: đồ nghề, giây còn đứng rao, hẹn giờ rao tiếp */
  vendor?: { gear: VendorGear; pause: number; callT: number };
}

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const between = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

/**
 * Người dân đi bộ vòng quanh các khối phố trên vỉa hè (chỉ trang trí, không vào cửa hàng), cùng vài gánh hàng rong
 * (nón lá, đòn gánh) đi chậm và thỉnh thoảng đứng lại rao; mưa thì người thưa đi và gánh hàng nghỉ.
 */
export class Pedestrians {
  readonly group = new THREE.Group();
  private list: Walker[] = [];
  /** Mép đường chính trước cửa hàng (z) và đoạn mặt tiền không có cây */
  private front = { z: 0, x0: -4, x1: 30 };
  /** Sạp hàng rong chiếm hết vỉa hè → bước xuống lòng đường (z đích) để đi vòng qua */
  private detours: Array<{ x0: number; x1: number; z0: number; z1: number; target: number; hours: [number, number] }> = [];
  /** Giờ game (CityLife cập nhật) — chỉ vòng xuống đường khi sạp đang bày hàng */
  hour = 12;
  /** Cường độ mưa 0..1 — hàng rong dọn về (không cần né sạp), người đi bộ thưa dần */
  rain = 0;
  /** Có gánh hàng rong đang đi ngang trước cửa hàng (khách có thể mua của gánh) */
  vendorNear = false;
  /** Gánh hàng rong cất tiếng rao tại (x, z) */
  onCall: (x: number, z: number) => void = () => {};
  private clock = 0;

  reset(L: CityLayout): void {
    this.clear();
    this.front.z = L.roads[1].z0;
    this.detours = L.stalls.map((s) => ({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, target: s.curb + s.dir * 0.7, hours: s.hours }));
    const routes = walkLoops(L.blocks, PEDESTRIANS.inset);
    for (let i = 0; i < PEDESTRIANS.count; i++) {
      const route = routes[i % routes.length];
      const look = { shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS), female: Math.random() < 0.5, model: pick(CUSTOMER_MODELS) };
      const human = createHuman(look);
      const w: Walker = {
        human, route, d: Math.random() * route.total, speed: PEDESTRIANS.speed * (0.8 + Math.random() * 0.4),
        curb: i % 2 === 0 ? 0.75 : 1.25, x: 0, z: 0,
      };
      this.group.add(human.root);
      this.list.push(w);
    }
    this.addVendors(routes, L.roads[1].z0);
  }

  /** Gánh hàng rong: 2 gánh đi 2 chiều quanh khối phố cửa hàng, gánh còn lại ở khối khác. */
  private addVendors(routes: Route[], frontZ: number): void {
    const passes = (r: Route) => {
      for (let d = 0; d < r.total; d += 2) {
        const p = poseAt(r, d);
        if (Math.hypot(p.x - DOOR_X, p.z - frontZ) < 4.5) return true;
      }
      return false;
    };
    const near = routes.filter(passes);
    for (let i = 0; i < WALKING_VENDOR.count; i++) {
      const route = near[i] ?? pick(routes);
      const look = { shirt: 0x8a6d46, pants: 0x2b2d42, skin: pick(SKINS), hair: 0x1a1a1a, female: true, model: 'mx_Martha' };
      const human = createHuman(look);
      const gear = buildVendorGear(i);
      human.root.add(gear.group);
      human.root.visible = false;
      this.group.add(human.root);
      this.list.push({
        human, route, d: Math.random() * route.total, speed: WALKING_VENDOR.speed * (0.9 + Math.random() * 0.2), curb: 1.0, x: 0, z: 0,
        vendor: { gear, pause: 0, callT: between(WALKING_VENDOR.callEvery) },
      });
    }
  }

  /** Trước siêu thị: kéo người đi bộ sát lề (thùng hàng giao nằm sát cửa), chuyển tiếp mượt 3m ở 2 đầu. */
  private nudge(w: Walker, x: number, z: number): number {
    const packed = vendorsPackUp(this.rain);
    for (const d of this.detours) {
      if (packed || this.hour < d.hours[0] || this.hour >= d.hours[1]) continue;
      if (z < d.z0 - 0.3 || z > d.z1 + 0.3 || x < d.x0 - 3 || x > d.x1 + 3) continue;
      const k = Math.min(smooth((x - (d.x0 - 3)) / 3), smooth((d.x1 + 3 - x) / 3));
      return z + (d.target - z) * k;
    }
    const f = this.front;
    if (z < f.z - 3 || z > f.z) return z;
    const k = Math.min(smooth((x - f.x0) / 3), smooth((f.x1 - x) / 3));
    return z + (f.z - w.curb - z) * k;
  }

  update(dt: number, player: { x: number; z: number }, camera: THREE.Vector3): void {
    this.clock += dt;
    const out = Math.floor(PEDESTRIANS.count * activeQuality().crowd * (1 - 0.65 * this.rain));
    const vendors = walkingVendorsOut(this.hour, this.rain);
    let near = false;
    for (const [i, w] of this.list.entries()) {
      const v = w.vendor;
      if (v ? !vendors : i >= out) {
        w.human.root.visible = false;
        continue;
      }
      const p = poseAt(w.route, w.d);
      // người chơi chắn ngay trước mặt → đứng chờ
      const rx = player.x - p.x;
      const rz = player.z - p.z;
      const along = rx * p.dx + rz * p.dz;
      const blocked = along > 0 && along < 1.1 && Math.abs(rx * p.dz - rz * p.dx) < 0.6;
      let speed = blocked ? 0 : w.speed;
      if (v) {
        v.callT -= dt;
        v.pause = Math.max(0, v.pause - dt);
        if (v.callT <= 0) {
          v.callT = between(WALKING_VENDOR.callEvery);
          v.pause = WALKING_VENDOR.callPauseS;
          this.onCall(w.x, w.z);
        }
        if (v.pause > 0) speed = 0;
        near ||= Math.abs(w.x - DOOR_X) < WALKING_VENDOR.nearDoor && Math.abs(w.z - this.front.z) < 5;
      }
      w.d += speed * dt;
      w.x = p.x;
      w.z = this.nudge(w, p.x, p.z);
      const root = w.human.root;
      const dist = Math.hypot(w.x - camera.x, w.z - camera.z);
      root.visible = dist < PEDESTRIANS.hideDist;
      if (!root.visible) continue;
      root.position.set(w.x, 0, w.z);
      root.rotation.y = Math.atan2(-p.dx, -p.dz); // quy ước nhân vật quay mặt -Z
      w.human.speed = speed;
      w.human.animInterval = dist < PEDESTRIANS.animDist ? 0 : FAR_ANIM_INTERVAL;
      w.human.update(dt);
      v?.gear.animate(this.clock, speed > 0.1);
    }
    this.vendorNear = near;
  }

  private clear(): void {
    for (const w of this.list) {
      w.human.root.removeFromParent();
      w.human.dispose();
    }
    this.list = [];
    this.vendorNear = false;
  }

  destroy(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
