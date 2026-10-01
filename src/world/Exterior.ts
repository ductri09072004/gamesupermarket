import * as THREE from 'three';
import { CEILING_HEIGHT, STORE_FRONT_Z, WALL_THICKNESS } from '../config/constants';
import { signMaterial } from './SignFactory';

/** Biển hiệu cửa hàng (đường, vỉa hè, nhà, cây, đèn đường nằm trong City). */
export class Exterior {
  readonly group = new THREE.Group();
  private signMat: THREE.MeshStandardMaterial | null = null;

  build(W: number): void {
    this.group.clear();
    // hộp đèn mica lồi khỏi mặt tiền: khung nhôm + mặt biển sáng, chữ TẠP HOÁ ĐẦU HẺM kèm dòng phụ
    this.signMat = signMaterial({
      text: 'TẠP HOÁ ĐẦU HẺM', sub: 'Hàng Việt chất lượng cao · Mở cửa 8:00 – 22:00', style: 'lightbox',
      bg: '#1f7a6d', ink: '#1f7a6d', accent: '#e07a1f', w: 1024, h: 176, seed: 42, wear: 0.3,
    });
    const frame = new THREE.MeshStandardMaterial({ color: 0x8b9199, roughness: 0.4, metalness: 0.7 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.74, 0.16), [frame, frame, frame, frame, this.signMat, frame]);
    box.position.set(Math.min(W / 2, 6), (CEILING_HEIGHT + 2.45) / 2 + 0.05, STORE_FRONT_Z + WALL_THICKNESS + 0.09);
    box.castShadow = true;
    this.group.add(box);
  }

  /** night: 0 (ngày) → 1 (đêm). */
  setNight(night: number): void {
    if (this.signMat) this.signMat.emissiveIntensity = 0.35 + night * 1.6;
  }
}
