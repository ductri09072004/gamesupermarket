import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Rect } from './CityLayout';

/** Bản đồ pháp tuyến gợn nước: tổng vài sóng sin chéo hướng, lặp liền mạch. */
function rippleNormal(size = 128): THREE.Texture {
  const h = new Float32Array(size * size);
  const waves = [[3, 1, 0.5], [-2, 4, 0.35], [5, -3, 0.25], [1, 6, 0.2]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [fx, fy, a] of waves) v += Math.sin(((x * fx + y * fy) / size) * Math.PI * 2 + fx) * a;
      h[y * size + x] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Mực nước hiển thị luôn thấp hơn mặt bó vỉa (0.06): mực thật 0.3 m → cao 0.05 so với mặt đường. */
const BASE_Y = -0.025;
const VISUAL_PER_M = 0.25;

/** Nước ngập trên mặt đường: 1 mặt phẳng trong suốt phủ mọi đoạn đường, dâng lên theo mực nước; gợn sóng cuộn chậm. */
export class CityWater {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private normal = rippleNormal();

  constructor(roads: Rect[]) {
    const geo = mergeGeometries(roads.map((r) => {
      const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2);
      g.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.7, pos.getZ(i) / 1.7);
      return g;
    }))!;
    this.normal.repeat.set(1, 1);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x6f6650, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.78, depthWrite: false,
      normalMap: this.normal, normalScale: new THREE.Vector2(0.14, 0.14), envMapIntensity: 1.6,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  /** level: mực nước thật (m); t: giờ thực (giây) cho gợn sóng. */
  update(level: number, t: number): void {
    this.mesh.visible = level > 0.004;
    if (!this.mesh.visible) return;
    this.mesh.position.y = BASE_Y + level * VISUAL_PER_M;
    this.normal.offset.set((t * 0.018) % 1, (t * 0.011) % 1);
    this.mat.opacity = Math.min(0.85, 0.35 + level * 3);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.normal.dispose();
    this.mesh.removeFromParent();
  }
}
