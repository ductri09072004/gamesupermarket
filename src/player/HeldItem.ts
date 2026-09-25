import * as THREE from 'three';
import { FEEL } from '../config/feel';
import type { BoxData } from '../core/GameState';
import { BoxModel } from '../entities/Box';

/**
 * Vật đang cầm vẽ trong scene riêng (render sau, xoá depth → không xuyên tường),
 * lắc nhẹ theo chuyển động & hướng nhìn.
 */
export class HeldItem {
  private pivot = new THREE.Group();
  private holder = new THREE.Group();
  model: BoxModel | null = null;
  box: BoxData | null = null;
  private sway = new THREE.Vector2();
  private bob = 0;
  private raise = 0;
  private base = new THREE.Vector3(0.22, -0.4, -0.62);

  constructor(heldScene: THREE.Scene) {
    this.pivot.add(this.holder);
    heldScene.add(this.pivot);
  }

  hold(box: BoxData | null): void {
    if (this.model) this.model.dispose();
    this.model = null;
    this.box = box;
    if (!box) return;
    this.model = new BoxModel(box.productId);
    this.model.setOpen(box.open, true);
    this.model.setContents(box.productId, box.qty);
    this.model.group.rotation.y = -0.25;
    this.model.group.position.set(-0.23, -0.15, -0.18);
    this.holder.add(this.model.group);
    this.raise = 0;
  }

  refresh(): void {
    if (!this.box || !this.model) return;
    this.model.setOpen(this.box.open);
    this.model.setContents(this.box.productId, this.box.qty);
  }

  /** Vị trí world gần đúng của miệng thùng (điểm xuất phát khi món bay lên kệ). */
  mouthWorld(camera: THREE.Camera): THREE.Vector3 {
    return new THREE.Vector3(this.base.x - 0.05, this.base.y + 0.22, this.base.z - 0.1).applyQuaternion(camera.quaternion).add(camera.position);
  }

  update(dt: number, camera: THREE.Camera, look: { dx: number; dy: number }, speed: number): void {
    this.pivot.quaternion.copy(camera.quaternion);
    this.sway.x += (-look.dx * FEEL.swayAmount * 0.02 - this.sway.x) * Math.min(1, dt * FEEL.swayReturn);
    this.sway.y += (look.dy * FEEL.swayAmount * 0.02 - this.sway.y) * Math.min(1, dt * FEEL.swayReturn);
    this.bob += dt * speed * 2.2;
    this.raise = Math.min(1, this.raise + dt * 4);
    const bobY = Math.sin(this.bob * 2) * FEEL.heldBobAmp * Math.min(1, speed / 3);
    this.holder.position.set(
      this.base.x + this.sway.x + Math.cos(this.bob) * FEEL.heldBobAmp * 0.5 * Math.min(1, speed / 3),
      this.base.y + this.sway.y + bobY - (1 - this.raise) * 0.3,
      this.base.z,
    );
    this.model?.update(dt);
  }
}
