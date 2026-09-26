import * as THREE from 'three';
import { DOOR_WIDTH, DOOR_X, EYE_HEIGHT, PLAYER_RADIUS, WALL_THICKNESS } from '../config/constants';
import { getVehicle } from '../config/vehicles';
import { cargoUsed } from '../systems/VehicleSystem';
import { forward, stepDrive, type DriveState } from '../systems/VehicleDrive';
import { resolveCircle, type AABB } from '../world/Colliders';
import { h, uiRoot } from '../ui/dom';
import type { World } from './World';
import { DriveImpact } from './DriveImpact';

const SUBSTEPS = 3;

/** Lái xe: vật lý arcade + va chạm AABB, camera bám đuôi (chuột xoay quanh xe), HUD tốc độ & hàng. */
export class Driving {
  uid: string | null = null;
  readonly state: DriveState = { x: 0, z: 0, yaw: 0, speed: 0, steer: 0 };
  private camPos = new THREE.Vector3();
  private orbit = 0;
  private orbitIdle = 0;
  private hud: HTMLElement | null = null;
  private engine: THREE.PositionalAudio | null = null;
  private lamp: THREE.SpotLight | null = null;
  private impact: DriveImpact;
  private shakeV = new THREE.Vector3();

  constructor(private w: World) {
    this.impact = new DriveImpact(w);
  }

  get active(): boolean {
    return this.uid !== null;
  }

  enter(uid: string): void {
    this.impact.reset();
    const w = this.w;
    const v = w.s.vehicles.get(uid);
    if (!v || w.mode !== 'play') return;
    if (w.held.box) {
      w.toast('Chất thùng lên xe (click) hoặc thả xuống (Q) trước khi lái', 'error');
      return;
    }
    this.uid = uid;
    Object.assign(this.state, { x: v.x, z: v.z, yaw: v.yaw, speed: 0, steer: 0 });
    w.mode = 'drive';
    w.player.cameraOverride = true;
    const def = getVehicle(v.type);
    const f = forward(v.yaw);
    this.camPos.set(v.x - f.x * def.camDist, def.camHeight, v.z - f.z * def.camDist);
    this.orbit = 0;
    const view = w.vehicles.get(uid);
    if (view) {
      this.engine = w.audio.attachHum(view.root, 0.9);
      this.lamp = new THREE.SpotLight(0xfff1c4, 0, 38, 0.55, 0.5, 1.2);
      this.lamp.position.set(0, 0.9, -def.size[2] / 2);
      this.lamp.target.position.set(0, 0, -def.size[2] / 2 - 10);
      view.root.add(this.lamp, this.lamp.target);
    }
    this.hud = h('div', { class: 'drive-hud' });
    uiRoot().append(this.hud);
    w.sound('door', new THREE.Vector3(v.x, 1, v.z), 0.7);
  }

  exit(): void {
    const w = this.w;
    const v = this.uid ? w.s.vehicles.get(this.uid) : undefined;
    if (!v) return;
    if (Math.abs(this.state.speed) > 1.5) {
      w.toast('Dừng xe hẳn rồi mới xuống (S / Space)', 'error');
      return;
    }
    const def = getVehicle(v.type);
    // bước xuống phía bên trái xe; bị chắn thì thử bên phải / phía sau
    const f = forward(v.yaw);
    const left = { x: f.z, z: -f.x };
    const off = def.size[0] / 2 + 0.55;
    const cands = [[left.x * off, left.z * off], [-left.x * off, -left.z * off], [-f.x * (def.size[2] / 2 + 0.6), -f.z * (def.size[2] / 2 + 0.6)]];
    const walls = w.colliders();
    let pos = { x: v.x + cands[0][0], z: v.z + cands[0][1] };
    for (const [dx, dz] of cands) {
      const r = resolveCircle(v.x + dx, v.z + dz, PLAYER_RADIUS, walls);
      if (!r.hit) { pos = { x: r.x, z: r.z }; break; }
    }
    w.player.x = pos.x;
    w.player.z = pos.z;
    w.player.yaw = v.yaw;
    w.player.pitch = -0.1;
    w.player.cameraOverride = false;
    w.player.applyCamera();
    this.cleanup();
    w.mode = 'play';
    w.sound('door', new THREE.Vector3(v.x, 1, v.z), 0.8);
  }

  private cleanup(): void {
    if (this.engine) {
      if (this.engine.isPlaying) this.engine.stop();
      this.engine.removeFromParent();
    }
    this.lamp?.target.removeFromParent();
    this.lamp?.removeFromParent();
    this.engine = null;
    this.lamp = null;
    this.hud?.remove();
    this.hud = null;
    this.uid = null;
  }

  onKey(e: KeyboardEvent): void {
    if (e.code === 'KeyE' && !e.repeat) this.exit();
  }

  /** Vật cản cho xe: tường, nhà, cây, xe khác + chắn cửa kính cửa hàng. */
  private obstacles(): AABB[] {
    const w = this.w;
    const D = w.s.data.storeH;
    const door: AABB = { minX: DOOR_X - DOOR_WIDTH / 2 - 0.2, maxX: DOOR_X + DOOR_WIDTH / 2 + 0.2, minZ: D - 0.2, maxZ: D + WALL_THICKNESS + 0.4, tag: 'door' };
    // xe NPC xử lý riêng bằng va chạm vật rắn (DriveImpact.hitTraffic)
    return [...w.colliders(), ...w.vehicles.colliders(this.uid ?? undefined), ...w.trucks.colliders(), door];
  }

  update(dt: number, look: { dx: number; dy: number }): void {
    const w = this.w;
    const v = this.uid ? w.s.vehicles.get(this.uid) : undefined;
    if (!v) return;
    const def = getVehicle(v.type);
    const k = w.input.keys;
    const throttle = (k.isDown('KeyW') || k.isDown('ArrowUp') ? 1 : 0) - (k.isDown('KeyS') || k.isDown('ArrowDown') ? 1 : 0);
    const steer = (k.isDown('KeyA') || k.isDown('ArrowLeft') ? 1 : 0) - (k.isDown('KeyD') || k.isDown('ArrowRight') ? 1 : 0);
    const input = { throttle, steer, handbrake: k.isDown('Space') };
    const boxes = this.obstacles();
    const [width, , length] = def.size;
    const r = width / 2;
    const n = Math.max(2, Math.round(length / width));
    for (let i = 0; i < SUBSTEPS; i++) {
      const sdt = dt / SUBSTEPS;
      stepDrive(this.state, input, def, sdt);
      this.impact.integrate(this.state, sdt);
      const f = forward(this.state.yaw);
      // vật cản tĩnh: thân xe = chuỗi hình tròn dọc thân; lấy vòng bị đẩy mạnh nhất làm điểm va
      let px = 0;
      let pz = 0;
      let hx = 0;
      let hz = 0;
      for (let j = 0; j < n; j++) {
        const t = (j / (n - 1) - 0.5) * (length - width);
        const cx = this.state.x + f.x * t;
        const cz = this.state.z + f.z * t;
        const res = resolveCircle(cx, cz, r, boxes, 2);
        if (res.hit && Math.hypot(res.x - cx, res.z - cz) > Math.hypot(px, pz)) {
          px = res.x - cx;
          pz = res.z - cz;
          hx = cx;
          hz = cz;
        }
      }
      const len = Math.hypot(px, pz);
      if (len > 0) {
        this.state.x += px;
        this.state.z += pz;
        const nx = px / len;
        const nz = pz / len;
        this.impact.hitStatic(this.state, def, nx, nz, hx + px - nx * r, hz + pz - nz * r);
      }
    }
    this.impact.hitTraffic(this.state, def);
    v.x = this.state.x;
    v.z = this.state.z;
    v.yaw = this.state.yaw;
    w.player.x = v.x;
    w.player.z = v.z;
    this.updateCamera(dt, def.camDist, def.camHeight, look);
    if (this.engine) this.engine.setPlaybackRate(0.55 + Math.abs(this.state.speed) / def.maxSpeed * 1.3);
    if (this.lamp) this.lamp.intensity = w.lighting.night * 40;
    if (this.hud) {
      const used = cargoUsed(v, w.s.data.boxes);
      this.hud.innerHTML = `<div class="dh-speed">${Math.round(Math.abs(this.state.speed) * 3.6)}<small> km/h</small></div>`
        + `<div class="dh-name">${def.icon} ${def.name} · ${this.state.speed < -0.2 ? 'R' : 'D'}</div>`
        + `<div class="dh-cargo">📦 ${used}/${def.capacity} ${def.countBySize ? 'suất' : 'thùng'}</div>`
        + '<div class="dh-keys"><kbd>W</kbd>/<kbd>S</kbd> ga · lùi &nbsp;<kbd>A</kbd>/<kbd>D</kbd> lái &nbsp;<kbd>Space</kbd> phanh tay &nbsp;<kbd>E</kbd> xuống xe</div>';
    }
  }

  private updateCamera(dt: number, dist: number, height: number, look: { dx: number; dy: number }): void {
    const cam = this.w.camera;
    if (look.dx !== 0) {
      this.orbit -= look.dx * 0.004;
      this.orbitIdle = 1.5;
    } else this.orbitIdle = Math.max(0, this.orbitIdle - dt);
    if (this.orbitIdle === 0) this.orbit *= Math.max(0, 1 - dt * 2.5);
    const yaw = this.state.yaw + this.orbit;
    const f = forward(yaw);
    const target = new THREE.Vector3(this.state.x - f.x * dist, height, this.state.z - f.z * dist);
    this.camPos.lerp(target, Math.min(1, dt * 6));
    cam.position.copy(this.camPos).add(this.impact.cameraShake(this.shakeV));
    const ahead = forward(this.state.yaw);
    cam.lookAt(this.state.x + ahead.x * 2, 1.0, this.state.z + ahead.z * 2);
  }

  /** Vị trí mắt người chơi dùng cho âm thanh khi đang lái (tai đặt ở camera). */
  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.state.x, EYE_HEIGHT, this.state.z);
  }

  destroy(): void {
    if (this.active) this.cleanup();
  }
}
