import * as THREE from 'three';
import {
  CARRY_SPEED_MULT, CROUCH_EYE_HEIGHT, CROUCH_SPEED, EYE_HEIGHT, MOUSE_SENSITIVITY, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED,
} from '../config/constants';
import { FEEL } from '../config/feel';
import type { Input } from '../engine/Input';
import { moveCircle, type AABB } from '../world/Colliders';

/** Người chơi góc nhìn thứ nhất: di chuyển, chạy, ngồi xổm, headbob, bước chân. */
export class PlayerController {
  x: number;
  z: number;
  yaw: number;
  pitch = -0.05;
  eye = EYE_HEIGHT;
  crouching = false;
  carrying = false;
  moveEnabled = true;
  headbob = true;
  sensitivity = 1;
  private vx = 0;
  private vz = 0;
  private bobDist = 0;
  private bobOffset = 0;
  private lastStep = 0;
  speed = 0;
  onFootstep: (pos: THREE.Vector3) => void = () => {};
  /** Camera không đi theo người chơi (đang tween vào máy tính / quầy / build) */
  cameraOverride = false;

  constructor(private camera: THREE.PerspectiveCamera, x: number, z: number, yaw: number) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    camera.rotation.order = 'YXZ';
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  look(dx: number, dy: number): void {
    const s = MOUSE_SENSITIVITY * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * s));
  }

  update(dt: number, input: Input, colliders: AABB[]): void {
    const k = input.keys;
    let fx = 0;
    let fz = 0;
    if (this.moveEnabled) {
      if (k.isDown('KeyW') || k.isDown('ArrowUp')) fz -= 1;
      if (k.isDown('KeyS') || k.isDown('ArrowDown')) fz += 1;
      if (k.isDown('KeyA') || k.isDown('ArrowLeft')) fx -= 1;
      if (k.isDown('KeyD') || k.isDown('ArrowRight')) fx += 1;
      this.crouching = k.isDown('ControlLeft') || k.isDown('ControlRight') || k.isDown('KeyC');
    }
    const len = Math.hypot(fx, fz);
    let target = 0;
    if (len > 0) {
      fx /= len;
      fz /= len;
      const run = (k.isDown('ShiftLeft') || k.isDown('ShiftRight')) && !this.crouching;
      target = this.crouching ? CROUCH_SPEED : run ? RUN_SPEED : WALK_SPEED;
      if (this.carrying) target *= CARRY_SPEED_MULT;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = (fx * cos + fz * sin) * target;
    const wz = (-fx * sin + fz * cos) * target;
    const accel = 1 - Math.exp(-dt * 14);
    this.vx += (wx - this.vx) * accel;
    this.vz += (wz - this.vz) * accel;
    const p = moveCircle(this.x, this.z, this.vx * dt, this.vz * dt, PLAYER_RADIUS, colliders);
    const moved = Math.hypot(p.x - this.x, p.z - this.z);
    this.speed = moved / dt;
    this.x = p.x;
    this.z = p.z;
    const eyeTarget = this.crouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
    this.eye += (eyeTarget - this.eye) * (1 - Math.exp(-dt * 10));
    // headbob + bước chân
    if (this.speed > 0.3) {
      this.bobDist += moved;
      const phase = this.bobDist * FEEL.headbobFreq * Math.PI;
      this.bobOffset = this.headbob ? Math.abs(Math.sin(phase)) * FEEL.headbobAmp * Math.min(1, this.speed / WALK_SPEED) : 0;
      const step = Math.floor(this.bobDist * FEEL.headbobFreq);
      if (step !== this.lastStep) {
        this.lastStep = step;
        this.onFootstep(new THREE.Vector3(this.x, 0.05, this.z));
      }
    } else {
      this.bobOffset *= 1 - Math.min(1, dt * 8);
    }
  }

  /** Đặt camera theo người chơi (trừ khi đang bị điều khiển bởi tween khác). */
  applyCamera(): void {
    if (this.cameraOverride) return;
    this.camera.position.set(this.x, this.eye + this.bobOffset, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  teleport(x: number, z: number, yaw?: number): void {
    this.x = x;
    this.z = z;
    this.vx = 0;
    this.vz = 0;
    if (yaw !== undefined) this.yaw = yaw;
  }

  get moving(): boolean {
    return this.speed > 0.3;
  }
}
