import * as THREE from 'three';
import type { Crosswalk } from './Crosswalks';
import { pedestrianGreen } from './TrafficSignals';

function personTexture(walk: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 80;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#080c0a';
  g.fillRect(0, 0, 64, 80);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(32, 15, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(32, 29); g.lineTo(32, 49);
  if (walk) {
    g.moveTo(32, 31); g.lineTo(18, 43); g.lineTo(12, 34);
    g.moveTo(32, 31); g.lineTo(45, 39); g.lineTo(52, 30);
    g.moveTo(32, 49); g.lineTo(18, 68); g.moveTo(32, 49); g.lineTo(46, 68);
  } else {
    g.moveTo(21, 32); g.lineTo(43, 32); g.moveTo(21, 32); g.lineTo(21, 48); g.moveTo(43, 32); g.lineTo(43, 48);
    g.moveTo(32, 49); g.lineTo(25, 68); g.moveTo(32, 49); g.lineTo(39, 68);
  }
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Hai đầu mỗi zebra có đèn hình người đứng đỏ / người đi xanh, cùng pha với xe. */
export class PedestrianSignalView {
  readonly group = new THREE.Group();
  private lenses: THREE.InstancedMesh[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private last: boolean[] = [];

  constructor(private crossings: Crosswalk[]) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x505954, roughness: 0.75, metalness: 0.4 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111813, roughness: 0.85 });
    this.materials.push(steel, black);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, front = 0) => {
      this.geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, crossings.length * 2);
      crossings.forEach((c, i) => {
        [c.from, c.to].forEach((p, side) => {
          const rot = c.axis === 'x' ? (side === 0 ? 0 : Math.PI) : (side === 0 ? Math.PI / 2 : -Math.PI / 2);
          rotation.setFromAxisAngle(up, rot);
          const x = p.x + (c.axis === 'x' ? 1.5 : 0) + Math.sin(rot) * front;
          const z = p.z + (c.axis === 'z' ? 1.5 : 0) + Math.cos(rot) * front;
          matrix.compose(new THREE.Vector3(x, y, z), rotation, one);
          mesh.setMatrixAt(i * 2 + side, matrix);
        });
      });
      mesh.castShadow = material instanceof THREE.MeshStandardMaterial;
      this.group.add(mesh);
      return mesh;
    };
    part(new THREE.CylinderGeometry(0.045, 0.075, 2.55, 6), steel, 1.275);
    part(new THREE.BoxGeometry(0.44, 0.9, 0.22), black, 2.16);
    for (let k = 0; k < 2; k++) {
      const texture = personTexture(k === 1);
      this.textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      this.materials.push(material);
      const mesh = part(new THREE.PlaneGeometry(0.32, 0.36), material, 2.38 - k * 0.44, 0.115);
      for (let i = 0; i < crossings.length * 2; i++) mesh.setColorAt(i, new THREE.Color(0x111111));
      this.lenses.push(mesh);
    }
    this.update(0);
  }

  update(time: number): void {
    let changed = false;
    this.crossings.forEach((c, i) => {
      const green = pedestrianGreen(time, c.offset);
      if (this.last[i] === green) return;
      this.last[i] = green;
      for (let side = 0; side < 2; side++) {
        this.lenses[0].setColorAt(i * 2 + side, new THREE.Color(green ? 0x240906 : 0xff3024));
        this.lenses[1].setColorAt(i * 2 + side, new THREE.Color(green ? 0x24ff75 : 0x062410));
      }
      changed = true;
    });
    if (changed) for (const m of this.lenses) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
