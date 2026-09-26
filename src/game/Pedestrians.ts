import * as THREE from 'three';
import { CUSTOMER_MODELS } from '../config/characters';
import { PEDESTRIANS } from '../config/traffic';
import { HAIRS, PANTS, SHIRTS, SKINS, type HumanBody } from '../entities/Human';
import { createHuman } from '../entities/RiggedHuman';
import { FAR_ANIM_INTERVAL } from '../entities/Walker';
import type { CityLayout } from '../world/CityLayout';
import { poseAt, walkLoops, type Route } from '../world/CityRoutes';

interface Walker {
  human: HumanBody;
  route: Route;
  d: number;
  speed: number;
  /** Đi sát lề hơn trước mặt tiền siêu thị (né thùng giao hàng) */
  curb: number;
  x: number;
  z: number;
}

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Người dân đi bộ vòng quanh các khối phố trên vỉa hè (chỉ trang trí, không vào cửa hàng). */
export class Pedestrians {
  readonly group = new THREE.Group();
  private list: Walker[] = [];
  /** Mép đường chính trước cửa hàng (z) và đoạn mặt tiền không có cây */
  private front = { z: 0, x0: -4, x1: 30 };

  reset(L: CityLayout): void {
    this.clear();
    this.front.z = L.roads[1].z0;
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
  }

  /** Trước siêu thị: kéo người đi bộ sát lề (thùng hàng giao nằm sát cửa), chuyển tiếp mượt 3m ở 2 đầu. */
  private nudge(w: Walker, x: number, z: number): number {
    const f = this.front;
    if (z < f.z - 3 || z > f.z) return z;
    const k = Math.min(smooth((x - f.x0) / 3), smooth((f.x1 - x) / 3));
    return z + (f.z - w.curb - z) * k;
  }

  update(dt: number, player: { x: number; z: number }, camera: THREE.Vector3): void {
    for (const w of this.list) {
      const p = poseAt(w.route, w.d);
      // người chơi chắn ngay trước mặt → đứng chờ
      const rx = player.x - p.x;
      const rz = player.z - p.z;
      const along = rx * p.dx + rz * p.dz;
      const blocked = along > 0 && along < 1.1 && Math.abs(rx * p.dz - rz * p.dx) < 0.6;
      const v = blocked ? 0 : w.speed;
      w.d += v * dt;
      w.x = p.x;
      w.z = this.nudge(w, p.x, p.z);
      const root = w.human.root;
      const dist = Math.hypot(w.x - camera.x, w.z - camera.z);
      root.visible = dist < PEDESTRIANS.hideDist;
      if (!root.visible) continue;
      root.position.set(w.x, 0, w.z);
      root.rotation.y = Math.atan2(-p.dx, -p.dz); // quy ước nhân vật quay mặt -Z
      w.human.speed = v;
      w.human.animInterval = dist < PEDESTRIANS.animDist ? 0 : FAR_ANIM_INTERVAL;
      w.human.update(dt);
    }
  }

  private clear(): void {
    for (const w of this.list) {
      w.human.root.removeFromParent();
      w.human.dispose();
    }
    this.list = [];
  }

  destroy(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
