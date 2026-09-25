import * as THREE from 'three';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Tween camera tới một góc nhìn (máy tính, quầy thu ngân, build mode) rồi quay lại. */
export class CameraTween {
  private from = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private to = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  private t = 1;
  private dur = 0.5;
  private done: (() => void) | null = null;
  active = false;

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** Bay tới vị trí nhìn về target. */
  go(pos: THREE.Vector3, lookAt: THREE.Vector3, dur: number, onDone?: () => void): void {
    this.from.pos.copy(this.camera.position);
    this.from.quat.copy(this.camera.quaternion);
    this.to.pos.copy(pos);
    const m = new THREE.Matrix4().lookAt(pos, lookAt, new THREE.Vector3(0, 1, 0));
    this.to.quat.setFromRotationMatrix(m);
    this.t = 0;
    this.dur = dur;
    this.done = onDone ?? null;
    this.active = true;
  }

  /** Bay về một transform cụ thể (vị trí mắt người chơi). */
  goTo(pos: THREE.Vector3, quat: THREE.Quaternion, dur: number, onDone?: () => void): void {
    this.from.pos.copy(this.camera.position);
    this.from.quat.copy(this.camera.quaternion);
    this.to.pos.copy(pos);
    this.to.quat.copy(quat);
    this.t = 0;
    this.dur = dur;
    this.done = onDone ?? null;
    this.active = true;
  }

  get target(): { pos: THREE.Vector3; quat: THREE.Quaternion } {
    return this.to;
  }

  update(dt: number): void {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.dur);
    const k = ease(this.t);
    this.camera.position.lerpVectors(this.from.pos, this.to.pos, k);
    this.camera.quaternion.slerpQuaternions(this.from.quat, this.to.quat, k);
    if (this.t >= 1) {
      const d = this.done;
      this.done = null;
      d?.();
    }
  }

  get running(): boolean {
    return this.t < 1;
  }
}
