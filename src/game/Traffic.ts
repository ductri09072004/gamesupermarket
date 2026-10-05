import * as THREE from 'three';
import { BUS, MOTO_HIT, MOTO_TRAFFIC, ONE_WAY_BLOCKS, TRAFFIC, YIELD } from '../config/traffic';
import { CAR_IMPACT } from '../config/physics';
import { activeQuality } from '../config/quality';
import type { SoundName } from '../core/EventBus';
import type { CarBody } from '../systems/CarImpact';
import { busPassengers, trafficDensity } from '../systems/TrafficSystem';
import type { AABB } from '../world/Colliders';
import { carLoops, poseAt, type Route } from '../world/CityRoutes';
import type { CityLayout } from '../world/CityLayout';
import { BusService } from './TrafficBus';
import { yieldStep } from './TrafficYield';
import { carModel, busModel, motoModel, type VehicleKind } from './TrafficModels';
import { carBody, stepKnock, type Knock } from './TrafficKnock';
import { hitByMoto, motoThreats, steerMoto } from './TrafficMoto';
import { targetSpeed } from './TrafficSpeed';

interface Stop {
  /** Quãng đường (trên tuyến) tới điểm dừng */
  d: number;
  state: 'approach' | 'dwell' | 'done';
  t: number;
}

export interface Car {
  kind: VehicleKind;
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
  /** Nửa bề ngang / nửa chiều dài thân va chạm */
  hw: number;
  hl: number;
  /** Đang bị văng sau va chạm */
  knock: Knock | null;
  /** Xe máy lắc ngang trong làn: tần số, pha */
  wob: { f: number; ph: number } | null;
  /** Xe buýt: dừng ở trạm */
  stop: Stop | null;
  /** Giây liên tiếp bị vật cản chặn (xe khác / người / xe tải đang dỡ hàng) đứng im */
  blockedT: number;
  /** Lệch ngang về phía lề phải (m): xe tự leo lề nhường đường / vượt xe chết máy để gỡ kẹt */
  off: number;
  /** Quãng đường còn phải chạy lệch lề trước khi nhập lại làn (m) */
  yieldLeft: number;
  /** Bị vật cản chặn ở khung này */
  blockedNow: boolean;
  /** Xe máy: chặn kín hai bên, không lách được → phanh */
  noDodge: boolean;
  /** Xe máy: giây chờ trước khi bóp còi tiếp */
  hornT: number;
}

const MASS: Record<VehicleKind, number> = { car: CAR_IMPACT.mass.traffic, moto: CAR_IMPACT.mass.moto, bus: CAR_IMPACT.mass.bus };
/** Vị trí cửa lên xuống của buýt so với tâm xe: tiến về phía trước / sang bên phải (m) */
const DOOR = { fwd: 3.3, side: 2.7 };

/**
 * Xe cộ NPC chạy vòng quanh các khối phố theo làn phải: ô tô ở làn giữa, xe máy dày đặc sát lề (lắc lư luồn lách,
 * cao điểm đông nghẹt, mưa mặc áo mưa), xe buýt theo lịch dừng ở trạm trước cửa hàng để khách xuống.
 * Xuất hiện/rời đi định kỳ, biết giảm tốc sau xe khác & người.
 */
export class Traffic {
  readonly group = new THREE.Group();
  private cars: Car[] = [];
  private routes: Route[] = [];
  private motoRoutes: Route[] = [];
  private spawnT = 1;
  private motoT = 1;
  private clock = 0;
  private rng = Math.random;
  private service = new BusService();
  /** 1 = bình thường; mưa / ngập nước → chạy chậm lại (CityLife đặt) */
  speedScale = 1;
  /** Giờ game & cường độ mưa (CityLife đặt): mật độ xe, chuyến buýt, áo mưa */
  hour = 12;
  rain = 0;
  onSound: (name: SoundName, x: number, z: number) => void = () => {};
  /** Xe máy tông người chơi đi bộ: vận tốc văng (m/s) */
  onHitPlayer: (vx: number, vz: number, speed: number) => void = () => {};
  private hitCool = 0;
  /** Buýt thả khách: vị trí cửa xe, số người */
  onPassengers: (x: number, z: number, n: number) => void = () => {};

  /** Mép đường chính phía cửa hàng (z) */
  private curbZ = Infinity;

  reset(L: CityLayout): void {
    this.curbZ = L.roads[1].z0;
    for (const c of this.cars) c.obj.removeFromParent();
    this.cars = [];
    const centers = ONE_WAY_BLOCKS.map((i) => L.loopCenters[i]).filter(Boolean);
    this.routes = carLoops(centers);
    this.motoRoutes = carLoops(centers, MOTO_TRAFFIC.lane, MOTO_TRAFFIC.cornerR);
    this.service.reset(this.routes, L.busStop.bay);
    // vào game đã có sẵn một nửa số xe cho phố khỏi vắng
    const k = activeQuality().traffic;
    for (let i = 0; i < (TRAFFIC.maxCars * k) / 2; i++) this.spawn('car', null);
    for (let i = 0; i < (MOTO_TRAFFIC.max * k) / 2; i++) this.spawn('moto', null);
  }

  private add(kind: VehicleKind, route: Route, d: number, obj: THREE.Object3D, max: number, life: number, dims?: { hw: number; hl: number }): Car {
    const wob = kind === 'moto' ? { f: (Math.PI * 2) / (MOTO_TRAFFIC.wobbleS[0] + this.rng() * (MOTO_TRAFFIC.wobbleS[1] - MOTO_TRAFFIC.wobbleS[0])), ph: this.rng() * 6.28 } : null;
    const [hw, hl] = dims ? [dims.hw, dims.hl] : kind === 'moto' ? [MOTO_TRAFFIC.hw, MOTO_TRAFFIC.hl] : kind === 'bus' ? [BUS.hw, BUS.hl] : [0.92, 2.05];
    const car: Car = { kind, obj, route, d, speed: max, max, life, hw, hl, knock: null, wob, stop: null, blockedT: 0, off: 0, yieldLeft: 0, blockedNow: false, noDodge: false, hornT: 0, ...poseAt(route, d) };
    this.pose(car);
    this.group.add(obj);
    this.cars.push(car);
    return car;
  }

  /** Thêm 1 xe ở chỗ trống, ngoài tầm mắt người chơi (nếu biết vị trí). */
  private spawn(kind: 'car' | 'moto', player: { x: number; z: number } | null): void {
    const moto = kind === 'moto';
    const routes = moto ? this.motoRoutes : this.routes;
    const gap = moto ? 5 : TRAFFIC.spawnGap;
    for (let tries = 0; tries < 8; tries++) {
      const route = routes[Math.floor(this.rng() * routes.length)];
      if (!route) return;
      const d = this.rng() * route.total;
      const p = poseAt(route, d);
      if (player && Math.hypot(p.x - player.x, p.z - player.z) < TRAFFIC.spawnHideDist) continue;
      if (this.cars.some((c) => c.route === route && Math.hypot(c.x - p.x, c.z - p.z) < gap)) continue;
      const life = TRAFFIC.lifeMin + this.rng() * TRAFFIC.lifeRand;
      if (moto) this.add('moto', route, d, motoModel(this.rng).obj, MOTO_TRAFFIC.speed * (0.75 + this.rng() * 0.5), life);
      else {
        const c = carModel(this.rng);
        this.add('car', route, d, c.obj, TRAFFIC.speed * (0.8 + this.rng() * 0.4), life, c);
      }
      return;
    }
  }

  /** Chuyến buýt xuất phát từ xa (chờ tới khi người chơi không đứng gần điểm xuất hiện). */
  private dispatchBus(player: { x: number; z: number }): void {
    const svc = this.service;
    const route = svc.route!;
    const p = poseAt(route, svc.startD);
    if (Math.hypot(p.x - player.x, p.z - player.z) < TRAFFIC.spawnHideDist) return;
    if (this.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 12)) return;
    svc.dispatched();
    const bus = this.add('bus', route, svc.startD, busModel(), BUS.speed, BUS.approachM + 150);
    bus.stop = { d: svc.stopD, state: 'approach', t: 0 };
  }

  private pose(c: Car): void {
    const b = c.knock?.body;
    let x = b ? b.x : c.x;
    let z = b ? b.z : c.z;
    if (!b && c.wob) {
      const off = Math.sin(this.clock * c.wob.f + c.wob.ph) * MOTO_TRAFFIC.wobble;
      x += -c.dz * off;
      z += c.dx * off;
    }
    c.obj.position.set(x, 0, z);
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
      const body = c.knock ? c.knock.body : carBody(c, MASS[c.kind]);
      const v0 = { vx: body.vx, vz: body.vz, w: body.w };
      return {
        body,
        commit: () => {
          if (c.knock) return;
          if (Math.hypot(body.vx - v0.vx, body.vz - v0.vz) + Math.abs(body.w - v0.w) > 0.3) {
            c.knock = { body, still: 0, back: null };
            c.off = 0;
            c.yieldLeft = 0;
          }
        },
      };
    });
  }

  /** Buýt vào trạm / rời trạm: tiếng xả hơi, thả khách khi dừng hẳn. */
  private stepStop(c: Car, dt: number): void {
    const s = c.stop;
    if (!s || s.state === 'done') return;
    if (s.state === 'approach') {
      const total = c.route.total;
      const dist = (((s.d - c.d) % total) + total) % total;
      if ((dist < 0.5 || dist > total / 2) && c.speed < 0.4) {
        s.state = 'dwell';
        s.t = BUS.dwellS;
        this.onSound('airBrake', c.x, c.z);
        // đường chính rộng 1,5 làn: buýt chạy giữa làn, hành khách bước xuống sát mép vỉa hè phía cửa hàng
        const door = { x: c.x + c.dx * DOOR.fwd - c.dz * DOOR.side, z: Math.min(c.z + c.dz * DOOR.fwd + c.dx * DOOR.side, this.curbZ - 0.2) };
        this.onPassengers(door.x, door.z, busPassengers(this.hour, this.rng));
      }
    } else if ((s.t -= dt) <= 0) {
      s.state = 'done';
      this.onSound('airBrake', c.x, c.z);
    }
  }

  /** obstacles: người chơi đi bộ, xe người chơi… (lat = nửa bề ngang cần né). onFoot: người chơi đang đi bộ (có thể bị xe máy tông). */
  update(dt: number, player: { x: number; z: number }, obstacles: Array<{ x: number; z: number; lat: number }>, onFoot = false): void {
    this.clock += dt;
    this.hitCool = Math.max(0, this.hitCool - dt);
    if (onFoot && this.hitCool <= 0) {
      const v = hitByMoto(this.cars, player.x, player.z);
      if (v) {
        this.hitCool = MOTO_HIT.cooldownS;
        this.onSound('crash', v.x, v.z);
        this.onHitPlayer(v.vx, v.vz, v.speed);
      }
    }
    this.spawnT -= dt;
    this.motoT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = TRAFFIC.spawnEvery * (0.6 + this.rng() * 0.8);
      if (this.count('car') < Math.round(TRAFFIC.maxCars * activeQuality().traffic * trafficDensity(this.hour, 'car'))) this.spawn('car', player);
    }
    if (this.motoT <= 0) {
      this.motoT = MOTO_TRAFFIC.spawnEvery * (0.6 + this.rng() * 0.8);
      if (this.count('moto') < Math.round(MOTO_TRAFFIC.max * activeQuality().traffic * trafficDensity(this.hour, 'moto'))) this.spawn('moto', player);
    }
    if (this.service.due(this.hour)) this.dispatchBus(player);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.knock && stepKnock(c, dt, this.statics())) {
        this.pose(c);
        continue;
      }
      if (c.kind === 'moto') {
        if (steerMoto(c, motoThreats(c, this.cars, obstacles), dt).honk) this.onSound('horn', c.x, c.z);
      }
      const target = targetSpeed(c, this.cars, obstacles, this.speedScale);
      const dv = target - c.speed;
      c.speed += Math.max(-TRAFFIC.brake * dt, Math.min(TRAFFIC.accel * dt, dv));
      const step = Math.max(0, c.speed) * dt;
      c.d += step;
      c.life -= step;
      yieldStep(c, dt, step);
      Object.assign(c, poseAt(c.route, c.d));
      // vị trí thật = tim làn + lệch về phía lề (bên phải hướng đi)
      c.x += -c.dz * c.off;
      c.z += c.dx * c.off;
      this.stepStop(c, dt);
      this.pose(c);
      // hết lượt → rời phố khi đã khuất xa người chơi
      // kẹt quá lâu ngoài tầm mắt → cho biến mất, khỏi làm nghẽn đường mãi
      const stuck = c.blockedT > YIELD.giveUpS && Math.hypot(c.x - player.x, c.z - player.z) > TRAFFIC.spawnHideDist * 0.6;
      if ((c.life <= 0 || stuck) && Math.hypot(c.x - player.x, c.z - player.z) > TRAFFIC.spawnHideDist * (stuck ? 0.6 : 1)) {
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
      const hx = alongX ? c.hl : c.hw;
      const hz = alongX ? c.hw : c.hl;
      return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz, tag: 'traffic' };
    });
  }

  positions(): Array<{ x: number; z: number }> {
    return this.cars;
  }

  count(kind?: VehicleKind): number {
    return kind ? this.cars.filter((c) => c.kind === kind).length : this.cars.length;
  }

  destroy(): void {
    for (const c of this.cars) c.obj.removeFromParent();
    this.cars = [];
    this.group.removeFromParent();
  }
}
