import * as THREE from 'three';
import { ROAD_WIDTH } from '../config/city';
import type { OrderData } from '../core/GameState';
import { buildTruck, TRUCK_LEN, type TruckModel } from '../entities/TruckModel';
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
}

const MAX_SPEED = 9;
const ACCEL = 2.5;
const BRAKE = 4;
/** Đuôi xe dừng ở x này (ngay sau ô giao hàng) */
const REAR_STOP_X = 8.2;
const DOOR_S = 0.7;
const UNLOAD_S = 3.4;

/**
 * Xe tải giao hàng: chạy trên làn sát cửa hàng của đường chính (hướng -X), đỗ trước ô giao hàng,
 * kéo cửa cuốn, thùng bay từ đuôi xe ra vỉa hè rồi chạy tiếp ra khỏi phố. Nhiều đơn → xếp hàng chờ.
 */
export class DeliveryTrucks {
  readonly group = new THREE.Group();
  private trucks: Truck[] = [];

  constructor(private c: GameCtx, private layout: () => CityLayout) {}

  private get laneZ(): number {
    return this.layout().roads[1].z0 + ROAD_WIDTH / 2 - LANE_OFFSET;
  }

  dispatch(order: OrderData): void {
    const m = buildTruck();
    m.group.rotation.y = Math.PI / 2; // đầu xe (-Z cục bộ) hướng -X
    this.group.add(m.group);
    const x = this.layout().bounds.x1 - 6;
    this.trucks.push({ m, order, x, speed: MAX_SPEED, phase: 'arrive', t: 0, delivered: false, dist: 0 });
    this.c.toast('🚚 Xe tải đang chở hàng tới cửa hàng...', 'info');
  }

  /** Tâm xe khi đuôi xe ở REAR_STOP_X; xe thứ i trong hàng đứng lùi sau. */
  private stopX(i: number): number {
    return REAR_STOP_X - TRUCK_LEN / 2 + i * (TRUCK_LEN + 2.5);
  }

  /** others: xe NPC & người chơi — dừng khi có vật cản phía trước cùng làn. */
  update(dt: number, others: Array<{ x: number; z: number }>): void {
    const z = this.laneZ;
    const queue = this.trucks.filter((t) => t.phase !== 'leave');
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      const tr = this.trucks[i];
      let target = MAX_SPEED;
      if (tr.phase === 'arrive') {
        const gap = tr.x - this.stopX(queue.indexOf(tr));
        target = Math.min(MAX_SPEED, Math.sqrt(Math.max(0, 2 * BRAKE * 0.8 * gap)));
        if (gap < 0.05 && tr.speed < 0.3 && queue.indexOf(tr) === 0) this.startUnload(tr);
      } else if (tr.phase === 'unload') {
        target = 0;
        this.unload(tr, dt);
      }
      // xe NPC / người đứng trước đầu xe (phía -X) cùng làn
      for (const o of others) {
        const ahead = tr.x - TRUCK_LEN / 2 - o.x;
        if (Math.abs(o.z - z) < 1.8 && ahead > -0.5 && ahead < 10) target = Math.min(target, Math.max(0, (ahead - 2.5) * 1.2));
      }
      const dv = target - tr.speed;
      tr.speed = Math.max(0, tr.speed + Math.max(-BRAKE * 2 * dt, Math.min(ACCEL * dt, dv)));
      tr.x -= tr.speed * dt;
      tr.dist += tr.speed * dt;
      tr.m.group.position.set(tr.x, 0, z);
      for (const w of tr.m.wheels) w.rotation.x = -tr.dist / tr.m.wheelRadius;
      if (tr.phase === 'leave' && tr.x < this.layout().bounds.x0 + 6) {
        tr.m.group.removeFromParent();
        this.trucks.splice(i, 1);
      }
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
    return this.trucks.map((t) => ({ minX: t.x - TRUCK_LEN / 2, maxX: t.x + TRUCK_LEN / 2, minZ: z - 1.2, maxZ: z + 1.2, tag: 'truck' }));
  }

  /** Vật cản cho xe NPC phía sau (vài điểm dọc thân xe). */
  obstacles(): Array<{ x: number; z: number; lat: number }> {
    const z = this.laneZ;
    return this.trucks.flatMap((t) => [-1, 0, 1].map((k) => ({ x: t.x + k * (TRUCK_LEN / 2 - 0.5), z, lat: 1.8 })));
  }

  destroy(): void {
    for (const t of this.trucks) t.m.group.removeFromParent();
    this.trucks = [];
  }
}
