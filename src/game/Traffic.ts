import * as THREE from 'three';
import { PARKED_CARS } from '../config/city';
import { TRAFFIC } from '../config/traffic';
import type { AABB } from '../world/Colliders';
import { cityModel } from '../world/CityModels';
import { carLoops, poseAt, type Route } from '../world/CityRoutes';
import type { CityLayout } from '../world/CityLayout';
import { CAR_IMPACT } from '../config/physics';
import type { CarBody } from '../systems/CarImpact';
import { carBody, stepKnock, type Knock } from './TrafficKnock';

interface Car {
  obj: THREE.Object3D;
  route: Route;
  d: number;
  speed: number;
  max: number;
  /** Quãng đường còn chạy trước khi "về nhà" (biến mất khi khuất xa người chơi) */
  life: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  /** Đang bị văng sau va chạm */
  knock: Knock | null;
}

const tmpColor = new THREE.Color();

/** Xe cộ NPC chạy vòng quanh các khối phố theo làn phải; xuất hiện/rời đi định kỳ, biết giảm tốc sau xe khác & người. */
export class Traffic {
  readonly group = new THREE.Group();
  private cars: Car[] = [];
  private routes: Route[] = [];
  private spawnT = 1;
  private rng = Math.random;

  reset(L: CityLayout): void {
    for (const c of this.cars) c.obj.removeFromParent();
    this.cars = [];
    this.routes = carLoops(L.blocks);
    // vào game đã có sẵn một nửa số xe cho phố khỏi vắng
    for (let i = 0; i < TRAFFIC.maxCars / 2; i++) this.spawn(null);
  }

  private makeModel(): THREE.Object3D {
    const name = PARKED_CARS[Math.floor(this.rng() * PARKED_CARS.length)];
    const src = cityModel(name);
    if (src) {
      const o = src.clone(true);
      o.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
      return o;
    }
    const color = tmpColor.setHSL(this.rng(), 0.5, 0.5).getHex();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 4.2), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 }));
    body.position.y = 0.7;
    body.castShadow = true;
    const g = new THREE.Group();
    g.add(body);
    return g;
  }

  /** Thêm 1 xe ở chỗ trống, ngoài tầm mắt người chơi (nếu biết vị trí). */
  private spawn(player: { x: number; z: number } | null): void {
    for (let tries = 0; tries < 8; tries++) {
      const route = this.routes[Math.floor(this.rng() * this.routes.length)];
      if (!route) return;
      const d = this.rng() * route.total;
      const p = poseAt(route, d);
      if (player && Math.hypot(p.x - player.x, p.z - player.z) < TRAFFIC.spawnHideDist) continue;
      if (this.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < TRAFFIC.spawnGap)) continue;
      const max = TRAFFIC.speed * (0.8 + this.rng() * 0.4);
      const car: Car = { obj: this.makeModel(), route, d, speed: max, max, life: TRAFFIC.lifeMin + this.rng() * TRAFFIC.lifeRand, knock: null, ...p };
      this.place(car);
      this.group.add(car.obj);
      this.cars.push(car);
      return;
    }
  }

  private place(c: Car): void {
    const b = c.knock?.body;
    c.obj.position.set(b ? b.x : c.x, 0, b ? b.z : c.z);
    c.obj.rotation.y = b ? b.yaw : Math.atan2(-c.dx, -c.dz); // model xe thành phố quay đầu về -Z
  }

  /** Vật cản tĩnh cho xe bị văng (nhà, cây, cột đèn) — World gán. */
  statics: () => AABB[] = () => [];

  /**
   * Thân vật lý của từng xe để xe người chơi va vào. commit(): gọi sau khi giải va chạm —
   * nếu vận tốc bị đổi đáng kể thì xe chuyển sang trạng thái văng.
   */
  bodies(): Array<{ body: CarBody; commit: () => void }> {
    return this.cars.map((c) => {
      const body = c.knock ? c.knock.body : carBody(c, CAR_IMPACT.mass.traffic);
      const v0 = { vx: body.vx, vz: body.vz, w: body.w };
      return {
        body,
        commit: () => {
          if (c.knock) return;
          if (Math.hypot(body.vx - v0.vx, body.vz - v0.vz) + Math.abs(body.w - v0.w) > 0.3) c.knock = { body, still: 0, back: null };
        },
      };
    });
  }

  /** Vận tốc mong muốn: giảm khi có vật cản phía trước cùng làn hoặc sắp vào cua. */
  private targetSpeed(c: Car, obstacles: Array<{ x: number; z: number; lat: number }>): number {
    let v = c.max;
    const ahead = poseAt(c.route, c.d + TRAFFIC.lookAhead);
    if (ahead.dx * c.dx + ahead.dz * c.dz < 0.9) v = Math.min(v, TRAFFIC.cornerSpeed);
    const check = (x: number, z: number, lat: number) => {
      const rx = x - c.x;
      const rz = z - c.z;
      const along = rx * c.dx + rz * c.dz;
      const side = Math.abs(rx * c.dz - rz * c.dx);
      if (along <= 0 || along > TRAFFIC.brakeDist || side > lat) return;
      v = Math.min(v, Math.max(0, (along - TRAFFIC.stopDist) / (TRAFFIC.brakeDist - TRAFFIC.stopDist)) * c.max);
    };
    // xe cùng chiều phía trước, hoặc xe đang nằm chắn đường sau va chạm
    for (const o of this.cars) {
      if (o === c) continue;
      if (o.knock) check(o.knock.body.x, o.knock.body.z, 2.2);
      else if (o.dx * c.dx + o.dz * c.dz > 0.3) check(o.x, o.z, 1.6);
    }
    for (const o of obstacles) check(o.x, o.z, o.lat);
    return v;
  }

  /** obstacles: người chơi đi bộ, xe người chơi… (lat = nửa bề ngang cần né). */
  update(dt: number, player: { x: number; z: number }, obstacles: Array<{ x: number; z: number; lat: number }>): void {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = TRAFFIC.spawnEvery * (0.6 + this.rng() * 0.8);
      if (this.cars.length < TRAFFIC.maxCars) this.spawn(player);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.knock && stepKnock(c, dt, this.statics())) {
        this.place(c);
        continue;
      }
      const target = this.targetSpeed(c, obstacles);
      const dv = target - c.speed;
      c.speed += Math.max(-TRAFFIC.brake * dt, Math.min(TRAFFIC.accel * dt, dv));
      const step = Math.max(0, c.speed) * dt;
      c.d += step;
      c.life -= step;
      Object.assign(c, poseAt(c.route, c.d));
      this.place(c);
      // hết lượt → rời phố khi đã khuất xa người chơi
      if (c.life <= 0 && Math.hypot(c.x - player.x, c.z - player.z) > TRAFFIC.spawnHideDist) {
        c.obj.removeFromParent();
        this.cars.splice(i, 1);
      }
    }
  }

  colliders(): AABB[] {
    return this.cars.map((c) => {
      if (c.knock) {
        const b = c.knock.body;
        return { minX: b.x - 2, maxX: b.x + 2, minZ: b.z - 2, maxZ: b.z + 2, tag: 'traffic' };
      }
      const alongX = Math.abs(c.dx) > Math.abs(c.dz);
      const hx = alongX ? 2.2 : 1;
      const hz = alongX ? 1 : 2.2;
      return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz, tag: 'traffic' };
    });
  }

  positions(): Array<{ x: number; z: number }> {
    return this.cars;
  }

  get count(): number {
    return this.cars.length;
  }

  destroy(): void {
    for (const c of this.cars) c.obj.removeFromParent();
    this.cars = [];
    this.group.removeFromParent();
  }
}
