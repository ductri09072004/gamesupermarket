import * as THREE from 'three';
import { ROAD_WIDTH } from '../config/city';
import type { OrderData } from '../core/GameState';
import { buildTruck, type TruckModel } from '../entities/TruckModel';
import type { AABB } from '../world/Colliders';
import { LANE_OFFSET } from '../world/CityRoutes';
import type { CityLayout } from '../world/CityLayout';
import type { GameCtx } from './Ctx';

type Phase = 'arrive' | 'unload' | 'leave';

interface Truck {
  m: TruckModel;
  order: OrderData;
  x: number;
  speed: number;
  phase: Phase;
  t: number;
  delivered: boolean;
  dist: number;
  /** Giây liên tiếp bị chặn đứng (không tính lúc đang dỡ hàng / đã tới điểm đỗ) */
  blockedT: number;
  /** Lệch về phía vỉa hè (m) — leo lề nhường / lách qua xe đứng chắn */
  off: number;
  /** Quãng còn phải lùi (m); 0 = không lùi */
  reverse: number;
  /** Quãng đường còn giữ lệch lề sau khi đã lách */
  yieldLeft: number;
}

const MAX_SPEED = 9;
const ACCEL = 2.5;
const BRAKE = 4;
/** Đuôi xe dừng ở x này (ngay sau ô giao hàng) */
const REAR_STOP_X = 8.2;
const DOOR_S = 0.7;
const UNLOAD_S = 3.4;
/** Xe tải đỗ lệch về phía vỉa hè (m) để chừa chỗ cho xe máy lách qua */
const TRUCK_CURB_SHIFT = 0.7;
/** Gỡ kẹt: bị chặn quá STUCK.curbS giây → leo lề; quá STUCK.reverseS và phía sau trống → lùi; quá STUCK.warpS → tới thẳng điểm đỗ */
const STUCK = { curbS: 3.5, reverseS: 9, warpS: 26, curbMax: 1.7, curbSpeed: 1.2, holdM: 14, reverseM: 6, reverseSpeed: 2.2 };

/**
 * Xe tải giao hàng: chạy trên làn sát cửa hàng của đường chính (hướng -X), đỗ trước ô giao hàng,
 * kéo cửa cuốn, thùng bay từ đuôi xe ra vỉa hè rồi chạy tiếp ra khỏi phố. Nhiều đơn → xếp hàng chờ.
 */
export class DeliveryTrucks {
  readonly group = new THREE.Group();
  private trucks: Truck[] = [];

  constructor(private c: GameCtx, private layout: () => CityLayout) {}

  private get laneZ(): number {
    return this.layout().roads[1].z0 + ROAD_WIDTH / 2 - LANE_OFFSET - TRUCK_CURB_SHIFT;
  }

  dispatch(order: OrderData): void {
    const m = buildTruck();
    m.group.rotation.y = Math.PI / 2; // đầu xe (-Z cục bộ) hướng -X
    this.group.add(m.group);
    const x = this.layout().bounds.x1 - 6;
    this.trucks.push({ m, order, x, speed: MAX_SPEED, phase: 'arrive', t: 0, delivered: false, dist: 0, blockedT: 0, off: 0, reverse: 0, yieldLeft: 0 });
    this.c.toast('🚚 Xe tải đang chở hàng tới cửa hàng...', 'info');
  }

  /** Tâm xe khi đuôi xe ở REAR_STOP_X; xe thứ i trong hàng đứng lùi sau các xe trước (mỗi xe dài khác nhau). */
  private stopX(queue: Truck[], i: number): number {
    if (i === 0) return REAR_STOP_X - queue[0].m.len / 2;
    // đầu xe thứ i cách đuôi xe đứng trước 2.5m
    let front = REAR_STOP_X + 2.5;
    for (let k = 1; k < i; k++) front += queue[k].m.len + 2.5;
    return front + queue[i].m.len / 2;
  }

  /** others: xe NPC & người chơi — dừng khi có vật cản phía trước cùng làn. */
  update(dt: number, others: Array<{ x: number; z: number }>): void {
    const z = this.laneZ;
    const queue = this.trucks.filter((t) => t.phase !== 'leave');
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      const tr = this.trucks[i];
      const zt = z - tr.off;
      let target = MAX_SPEED;
      const stopAt = this.stopX(queue, queue.indexOf(tr));
      if (tr.phase === 'arrive') {
        const gap = tr.x - stopAt;
        target = Math.min(MAX_SPEED, Math.sqrt(Math.max(0, 2 * BRAKE * 0.8 * gap)));
        if (gap < 0.05 && tr.speed < 0.3 && queue.indexOf(tr) === 0) this.startUnload(tr);
      } else if (tr.phase === 'unload') {
        target = 0;
        this.unload(tr, dt);
      }
      const free = target;
      // xe NPC / người đứng trước đầu xe (phía -X) cùng làn
      for (const o of others) {
        const ahead = tr.x - tr.m.len / 2 - o.x;
        if (Math.abs(o.z - zt) < 1.8 && ahead > -0.5 && ahead < 10) target = Math.min(target, Math.max(0, (ahead - 2.5) * 1.2));
      }
      if (tr.phase !== 'unload') this.untangle(tr, dt, target < 0.3 && free > 1, others, zt, stopAt);
      const dv = tr.reverse > 0 ? -STUCK.reverseSpeed - tr.speed : target - tr.speed;
      tr.speed = tr.reverse > 0 ? tr.speed + Math.max(-BRAKE * dt, Math.min(ACCEL * dt, dv)) : Math.max(0, tr.speed + Math.max(-BRAKE * 2 * dt, Math.min(ACCEL * dt, dv)));
      tr.x -= tr.speed * dt;
      tr.dist += tr.speed * dt;
      if (tr.reverse > 0) {
        tr.reverse -= -tr.speed * dt;
        if (tr.reverse <= 0) { tr.reverse = 0; tr.speed = 0; }
      }
      tr.m.group.position.set(tr.x, 0, z - tr.off);
      for (const w of tr.m.wheels) w.rotation.x = -tr.dist / tr.m.wheelRadius;
      if (tr.phase === 'leave' && tr.x < this.layout().bounds.x0 + 6) {
        tr.m.group.removeFromParent();
        this.trucks.splice(i, 1);
      }
    }
  }

  /**
   * Gỡ kẹt khi bị chặn đứng: (1) leo lề lách qua vật cản, giữ lệch một đoạn rồi nhập lại làn; (2) vẫn kẹt và phía sau trống thì lùi
   * vài mét cho xe phía trước có chỗ xoay xở; (3) kẹt quá lâu thì tới thẳng điểm đỗ để đơn hàng không bao giờ bị "mất".
   */
  private untangle(tr: Truck, dt: number, blocked: boolean, others: Array<{ x: number; z: number }>, zt: number, stopAt: number): void {
    tr.blockedT = blocked ? tr.blockedT + dt : Math.max(0, tr.blockedT - dt * 2);
    if (tr.blockedT > STUCK.curbS && tr.yieldLeft <= 0) tr.yieldLeft = STUCK.holdM;
    const hold = tr.yieldLeft > 0;
    if (hold && tr.speed > 0.1) tr.yieldLeft -= tr.speed * dt;
    const want = hold ? STUCK.curbMax : 0;
    tr.off += Math.max(-STUCK.curbSpeed * dt, Math.min(STUCK.curbSpeed * dt, want - tr.off));
    // đã leo lề hết cỡ mà vẫn không qua được → lùi nếu sau đuôi xe trống
    if (tr.blockedT > STUCK.reverseS && tr.reverse <= 0 && tr.off >= STUCK.curbMax - 0.05) {
      const rear = tr.x + tr.m.len / 2;
      const clear = !others.some((o) => Math.abs(o.z - zt) < 2 && o.x > rear - 0.5 && o.x < rear + STUCK.reverseM + 2);
      if (clear) {
        tr.reverse = STUCK.reverseM;
        tr.blockedT = STUCK.curbS;
      }
    }
    if (tr.blockedT > STUCK.warpS && tr.phase === 'arrive') {
      // tới thẳng điểm đỗ (giống xe chạy tắt qua vật cản) — đơn hàng vẫn được giao
      tr.x = stopAt;
      tr.off = 0;
      tr.blockedT = 0;
      tr.yieldLeft = 0;
      tr.reverse = 0;
      this.startUnload(tr);
    }
  }

  private startUnload(tr: Truck): void {
    tr.phase = 'unload';
    tr.t = 0;
    tr.speed = 0;
    this.c.sound('truck', new THREE.Vector3(tr.x, 1, this.laneZ));
  }

  private unload(tr: Truck, dt: number): void {
    tr.t += dt;
    // cửa cuốn kéo lên, dỡ xong kéo xuống
    const open = Math.min(1, tr.t / DOOR_S, Math.max(0, (UNLOAD_S - tr.t) / DOOR_S));
    tr.m.door.position.y = 0.8 + open * 1.9;
    tr.m.door.scale.y = 1 - open * 0.85;
    if (!tr.delivered && tr.t > DOOR_S) {
      tr.delivered = true;
      const rear = tr.m.group.localToWorld(tr.m.rear.clone());
      this.c.s.orders.deliver(tr.order, { x: rear.x, y: rear.y, z: rear.z });
      this.c.sound('thud', rear);
    }
    if (tr.t >= UNLOAD_S) {
      tr.phase = 'leave';
      tr.m.door.position.y = 0.8;
      tr.m.door.scale.y = 1;
    }
  }

  colliders(): AABB[] {
    const z = this.laneZ;
    return this.trucks.map((t) => ({ minX: t.x - t.m.len / 2, maxX: t.x + t.m.len / 2, minZ: z - t.off - 1.2, maxZ: z - t.off + 1.2, tag: 'truck' }));
  }

  /** Vật cản cho xe NPC phía sau (vài điểm dọc thân xe). */
  obstacles(): Array<{ x: number; z: number; lat: number }> {
    const z = this.laneZ;
    return this.trucks.flatMap((t) => [-1, 0, 1].map((k) => ({ x: t.x + k * (t.m.len / 2 - 0.5), z: z - t.off, lat: 1.8 })));
  }

  destroy(): void {
    for (const t of this.trucks) t.m.group.removeFromParent();
    this.trucks = [];
  }
}
