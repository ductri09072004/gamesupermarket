import * as THREE from 'three';
import { signalColor, type TrafficSignal } from './TrafficSignals';

/** Đèn giao thông bằng hình khối, gộp instance và chỉ đổi màu bóng khi chuyển pha. */
export class TrafficSignalView {
  readonly group = new THREE.Group();
  private bulbs: THREE.InstancedMesh;
  private last: string[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(private signals: TrafficSignal[]) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x555b57, roughness: 0.7, metalness: 0.55 });
    const black = new THREE.MeshStandardMaterial({ color: 0x171c19, roughness: 0.85 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xa6a397, roughness: 0.95 });
    const lens = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.materials.push(steel, black, concrete, lens);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3(1, 1, 1);
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z = 0) => {
      this.geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, signals.length);
      signals.forEach((s, i) => {
        rotation.setFromAxisAngle(up, s.rot);
        matrix.compose(new THREE.Vector3(s.x + Math.sin(s.rot) * z, y, s.z + Math.cos(s.rot) * z), rotation, scale);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    part(new THREE.BoxGeometry(0.4, 0.16, 0.4), concrete, 0.08);
    part(new THREE.CylinderGeometry(0.065, 0.095, 3.4, 8), steel, 1.7);
    part(new THREE.BoxGeometry(0.52, 1.35, 0.27), black, 3.35, 0.06);
    // Mái che từng bóng và viền đen giúp đọc rõ màu dưới nắng.
    for (const y of [3.76, 3.35, 2.94]) {
      part(new THREE.BoxGeometry(0.46, 0.045, 0.4), black, y + 0.18, 0.23);
    }
    const geometry = new THREE.CircleGeometry(0.15, 16);
    this.geometries.push(geometry);
    this.bulbs = new THREE.InstancedMesh(geometry, lens, signals.length * 3);
    signals.forEach((s, i) => {
      rotation.setFromAxisAngle(up, s.rot);
      for (let k = 0; k < 3; k++) {
        matrix.compose(new THREE.Vector3(s.x + Math.sin(s.rot) * 0.205, 3.76 - k * 0.41, s.z + Math.cos(s.rot) * 0.205), rotation, scale);
        this.bulbs.setMatrixAt(i * 3 + k, matrix);
        this.bulbs.setColorAt(i * 3 + k, new THREE.Color(0x101813));
      }
    });
    this.group.add(this.bulbs);
    this.update(0);
  }

  update(time: number): void {
    const colors = ['red', 'amber', 'green'] as const;
    const on = [0xff3024, 0xffb91f, 0x24ff75];
    const off = [0x32100c, 0x30200a, 0x0b2815];
    let changed = false;
    this.signals.forEach((s, i) => {
      const color = signalColor(time, s.axis, s.offset);
      if (this.last[i] === color) return;
      this.last[i] = color;
      colors.forEach((c, k) => this.bulbs.setColorAt(i * 3 + k, new THREE.Color(c === color ? on[k] : off[k])));
      changed = true;
    });
    if (changed && this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
