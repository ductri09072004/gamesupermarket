import * as THREE from 'three';
import { CEILING_HEIGHT, WALL_THICKNESS } from '../config/constants';
import { textCanvas } from '../products/LabelTexture';

/** Biển hiệu cửa hàng (đường, vỉa hè, nhà, cây, đèn đường nằm trong City). */
export class Exterior {
  readonly group = new THREE.Group();
  private signMat: THREE.MeshStandardMaterial | null = null;

  build(W: number, D: number): void {
    this.group.clear();
    // biển hiệu cửa hàng trên mặt tiền
    const signTex = textCanvas(1024, 160, (g) => {
      g.fillStyle = '#1f7a6d';
      g.fillRect(0, 0, 1024, 160);
      g.fillStyle = '#ffffff';
      g.font = '900 96px "Nunito", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('MINI MART', 512, 72);
      g.font = '700 30px "Nunito", Arial, sans-serif';
      g.fillStyle = '#ffd166';
      g.fillText('MỞ CỬA 8:00 – 22:00', 512, 136);
    });
    this.signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.15 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), this.signMat);
    sign.position.set(Math.min(W / 2, 6), (CEILING_HEIGHT + 2.45) / 2 + 0.05, D + WALL_THICKNESS + 0.01);
    this.group.add(sign);
  }

  /** night: 0 (ngày) → 1 (đêm). */
  setNight(night: number): void {
    if (this.signMat) this.signMat.emissiveIntensity = 0.15 + night * 1.4;
  }
}
