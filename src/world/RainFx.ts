import * as THREE from 'three';

const COUNT = 1600;
const BOX = 26;
const HEIGHT = 15;

/**
 * Hạt mưa: nét mảnh rơi quanh camera (cuộn vòng trong hộp BOX×HEIGHT nên không cần sinh mới).
 * Hạt nào rơi vào trong mặt bằng cửa hàng thì giấu đi — trong nhà không có mưa.
 */
export class RainFx {
  readonly lines: THREE.LineSegments;
  private pos = new Float32Array(COUNT * 6);
  private base = new Float32Array(COUNT * 3);
  private speed = new Float32Array(COUNT);
  private mat = new THREE.LineBasicMaterial({ color: 0xc4d4e2, transparent: true, opacity: 0, depthWrite: false });
  /** Mặt bằng nhà (x0, x1, z0, z1) — không có mưa bên trong */
  roof = { x0: 0, x1: 0, z0: 0, z1: 0 };

  constructor() {
    for (let i = 0; i < COUNT; i++) {
      this.base.set([Math.random() * BOX, Math.random() * HEIGHT, Math.random() * BOX], i * 3);
      this.speed[i] = 11 + Math.random() * 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.lines.renderOrder = 5;
  }

  /** k: cường độ 0..1 (số hạt & độ đậm). */
  update(dt: number, cam: THREE.Vector3, k: number): void {
    this.lines.visible = k > 0.02;
    if (!this.lines.visible) return;
    this.mat.opacity = 0.14 + 0.32 * k;
    const n = Math.max(1, Math.floor(COUNT * k));
    const r = this.roof;
    const wind = 0.9;
    for (let i = 0; i < n; i++) {
      const b = i * 3;
      this.base[b + 1] -= this.speed[i] * dt;
      if (this.base[b + 1] < 0) this.base[b + 1] += HEIGHT;
      // vị trí thế giới: cuộn quanh camera theo từng trục
      const x = cam.x + ((((this.base[b] - cam.x) % BOX) + BOX) % BOX) - BOX / 2;
      const z = cam.z + ((((this.base[b + 2] - cam.z) % BOX) + BOX) % BOX) - BOX / 2;
      const y = cam.y - 4 + this.base[b + 1];
      const o = i * 6;
      const hidden = x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
      const len = hidden || y < 0 ? 0 : 0.5 + k * 0.4;
      this.pos[o] = x;
      this.pos[o + 1] = y;
      this.pos[o + 2] = z;
      this.pos[o + 3] = x + wind * len * 0.12;
      this.pos[o + 4] = y + len;
      this.pos[o + 5] = z;
    }
    this.lines.geometry.setDrawRange(0, n * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.lines.geometry.dispose();
    this.mat.dispose();
    this.lines.removeFromParent();
  }
}
