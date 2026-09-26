import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { BOX_PHYSICS } from '../config/physics';
import type { BoxData } from '../core/GameState';
import type { Services } from '../core/Services';
import { BOX_D, BOX_H, BOX_W } from '../entities/Box';
import type { AABB } from '../world/Colliders';
import type { Support } from '../player/StepSupport';

const P = BOX_PHYSICS;
const tmpQ = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);

/** Thân kinematic đẩy thùng (xe đang lái). */
export interface Pusher {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Xe: hộp theo hướng; người: hình trụ */
  car?: { yaw: number; w: number; l: number; h: number };
}

/**
 * Vật lý thùng hàng trên sàn (cannon-es): người chơi / xe đi vào thì đẩy, thùng đổ và lăn; chồng thùng đổ sập;
 * thả thùng thì rơi thật. Tư thế sau khi dừng được ghi ngược vào BoxData (gx, gy, pose) để lưu game.
 */
export class BoxPhysics {
  private world = new CANNON.World({ gravity: new CANNON.Vec3(0, P.gravity, 0), allowSleep: true });
  private bodies = new Map<string, CANNON.Body>();
  private statics: CANNON.Body[] = [];
  private staticSrc: AABB[] | null = null;
  private car: CANNON.Body | null = null;
  private carKey = '';
  private boxMat = new CANNON.Material('box');
  private writeT = 0;

  constructor(private s: Services, private staticColliders: () => AABB[], private animating: (uid: string) => boolean) {
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
    this.world.defaultContactMaterial.friction = P.friction;
    this.world.defaultContactMaterial.restitution = P.restitution;
  }

  private massOf(b: BoxData): number {
    return P.emptyMass + P.perItemMass * b.qty;
  }

  /** Dựng lại vật cản tĩnh khi danh sách collider thay đổi (dời kệ, mở rộng cửa hàng). */
  private syncStatics(): void {
    const src = this.staticColliders();
    if (src === this.staticSrc) return;
    this.staticSrc = src;
    for (const b of this.statics) this.world.removeBody(b);
    this.statics = [];
    const cx = this.s.data.storeW / 2;
    const cz = this.s.data.storeH / 2;
    for (const a of src) {
      if (a.tag === 'bound') continue;
      const x = (a.minX + a.maxX) / 2;
      const z = (a.minZ + a.maxZ) / 2;
      if (Math.hypot(x - cx, z - cz) > P.staticRadius) continue;
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3((a.maxX - a.minX) / 2, P.staticHeight / 2, (a.maxZ - a.minZ) / 2)) });
      body.position.set(x, P.staticHeight / 2, z);
      this.world.addBody(body);
      this.statics.push(body);
    }
    for (const b of this.bodies.values()) b.wakeUp();
  }

  /** Tạo / bỏ thân vật lý theo thùng đang nằm trên sàn. */
  private syncBoxes(): void {
    const floor = this.s.data.boxes.filter((b) => b.location === 'floor').sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
    const alive = new Set<string>();
    const stacks = new Map<string, number>();
    for (const b of floor) {
      alive.add(b.uid);
      const key = `${b.gx.toFixed(2)},${b.gy.toFixed(2)}`;
      const n = stacks.get(key) ?? 0;
      stacks.set(key, n + 1);
      let body = this.bodies.get(b.uid);
      if (!body) {
        body = new CANNON.Body({
          mass: this.massOf(b), material: this.boxMat, shape: new CANNON.Box(new CANNON.Vec3(BOX_W / 2, BOX_H / 2, BOX_D / 2)),
          linearDamping: P.linearDamping, angularDamping: P.angularDamping, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.6,
        });
        if (b.pose) {
          body.position.set(b.gx, b.pose.y, b.gy);
          body.quaternion.set(...b.pose.q);
        } else {
          body.position.set(b.gx, n * BOX_H + BOX_H / 2 + 0.002, b.gy);
          body.quaternion.setFromEuler(0, ((b.uid.charCodeAt(b.uid.length - 1) % 5) - 2) * 0.03, 0);
        }
        this.world.addBody(body);
        this.bodies.set(b.uid, body);
        if (!b.pose) body.sleep();
      }
      // đang bay từ xe tải / rơi xuống: giữ cố định tới khi animation xong
      const kin = this.animating(b.uid);
      const want = kin ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC;
      if (body.type !== want) {
        body.type = want;
        body.mass = kin ? 0 : this.massOf(b);
        body.updateMassProperties();
        body.velocity.setZero();
        body.angularVelocity.setZero();
        if (!kin) body.wakeUp();
      }
    }
    for (const [uid, body] of this.bodies) {
      if (alive.has(uid)) continue;
      // rời sàn (nhặt lên, lên kệ kho, lên xe) → quên tư thế cũ, lần đặt sau đứng thẳng / rơi mới
      const left = this.s.data.boxes.find((b) => b.uid === uid);
      if (left) left.pose = undefined;
      // thùng bên dưới bị nhấc đi → đánh thức hàng xóm để chồng phía trên rơi xuống
      for (const o of this.bodies.values()) if (o.position.distanceTo(body.position) < 1.2) o.wakeUp();
      this.world.removeBody(body);
      this.bodies.delete(uid);
    }
  }

  /** Người chơi thả thùng: xuất hiện trước mặt ở tầm tay rồi rơi, hơi văng về trước. */
  launch(uid: string, from: THREE.Vector3, dir: THREE.Vector3): void {
    this.syncBoxes();
    const body = this.bodies.get(uid);
    if (!body) return;
    body.type = CANNON.Body.DYNAMIC;
    body.position.set(from.x, from.y, from.z);
    tmpQ.setFromAxisAngle(up, Math.atan2(dir.x, dir.z));
    body.quaternion.set(tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w);
    body.velocity.set(dir.x * P.throwSpeed, 0.5, dir.z * P.throwSpeed);
    body.angularVelocity.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    body.wakeUp();
  }

  private setPusher(p: Pusher | null): void {
    if (!p?.car) {
      if (this.car) { this.world.removeBody(this.car); this.car = null; }
      return;
    }
    const key = `${p.car.w},${p.car.l},${p.car.h}`;
    if (!this.car || this.carKey !== key) {
      if (this.car) this.world.removeBody(this.car);
      this.car = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Box(new CANNON.Vec3(p.car.w / 2, p.car.h / 2, p.car.l / 2)) });
      this.carKey = key;
      this.world.addBody(this.car);
    }
    this.car.position.set(p.x, p.car.h / 2, p.z);
    this.car.quaternion.setFromEuler(0, p.car.yaw, 0);
    this.car.velocity.set(p.vx, 0, p.vz);
  }

  /**
   * drive: xe đang lái đẩy thùng (null nếu không lái). walker: người chơi đi bộ — nhận danh sách thùng quanh mình
   * để bước lên / bị chặn (đẩy thùng qua push()).
   */
  update(dt: number, drive: Pusher | null, walker?: { x: number; z: number; supports: Support[] }): void {
    this.syncStatics();
    this.syncBoxes();
    if (walker) walker.supports = this.supports(walker);
    if (this.bodies.size === 0) return;
    this.setPusher(drive);
    this.world.step(1 / 60, dt, 3);
    this.writeT -= dt;
    if (this.writeT > 0) return;
    this.writeT = 0.25;
    for (const b of this.s.data.boxes) {
      const body = this.bodies.get(b.uid);
      if (!body || body.type !== CANNON.Body.DYNAMIC || body.sleepState === CANNON.Body.SLEEPING) continue;
      b.gx = Math.round(body.position.x * 100) / 100;
      b.gy = Math.round(body.position.z * 100) / 100;
      const q = body.quaternion;
      b.pose = { y: Math.round(body.position.y * 1000) / 1000, q: [q.x, q.y, q.z, q.w] };
    }
  }

  /** Thùng trên sàn dưới dạng hộp bao XZ + độ cao nóc — người chơi bước lên / bị chặn. */
  supports(near: { x: number; z: number }, radius = 4): Support[] {
    const out: Support[] = [];
    for (const [uid, b] of this.bodies) {
      if (Math.abs(b.position.x - near.x) > radius || Math.abs(b.position.z - near.z) > radius) continue;
      b.updateAABB();
      const a = b.aabb;
      out.push({ uid, minX: a.lowerBound.x, maxX: a.upperBound.x, minZ: a.lowerBound.z, maxZ: a.upperBound.z, top: a.upperBound.y });
    }
    return out;
  }

  /**
   * Người chơi tì vào thùng theo hướng (dx, dz): đẩy tới tối đa tốc độ đi chậm, lực có giới hạn.
   * Điểm đặt lực ở tâm thùng → thùng trượt thẳng; chồng thùng thì thùng dưới trượt ra, thùng trên đổ.
   */
  push(uid: string, dx: number, dz: number, _feet: number, dt: number): void {
    const b = this.bodies.get(uid);
    if (!b || b.type !== CANNON.Body.DYNAMIC) return;
    const along = b.velocity.x * dx + b.velocity.z * dz;
    const need = P.pushSpeed - along;
    if (need <= 0) return;
    const j = Math.min(need * b.mass, P.pushForce * dt);
    b.wakeUp();
    // điểm đặt lực TƯƠNG ĐỐI so với tâm (API cannon-es): ngay tâm → trượt thẳng, không tự quay
    b.applyImpulse(new CANNON.Vec3(dx * j, 0, dz * j), new CANNON.Vec3(0, 0, 0));
  }

  /** Tư thế hiện tại (tâm hộp) — BoxManager dùng để đặt model. */
  pose(uid: string): { p: CANNON.Vec3; q: CANNON.Quaternion } | null {
    const b = this.bodies.get(uid);
    return b && b.type === CANNON.Body.DYNAMIC ? { p: b.position, q: b.quaternion } : null;
  }

  destroy(): void {
    for (const b of [...this.world.bodies]) this.world.removeBody(b);
    this.bodies.clear();
  }
}
