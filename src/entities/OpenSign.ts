import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

function face(open: boolean): THREE.CanvasTexture {
  return textCanvas(256, 128, (g) => {
    g.fillStyle = open ? '#2a9d8f' : '#e63946';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(8, 8, 240, 112);
    g.fillStyle = '#ffffff';
    g.font = '900 52px "Nunito", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(open ? 'MỞ CỬA' : 'ĐÓNG', 128, 66);
  });
}

/** Biển Mở/Đóng cửa treo trên cột cạnh cửa ra vào; lật khi đổi trạng thái. */
export class OpenSign {
  readonly group = new THREE.Group();
  private board: THREE.Mesh;
  private openTex = face(true);
  private closedTex = face(false);
  private flipT = 1;
  private mat: THREE.MeshStandardMaterial;

  constructor() {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.6, roughness: 0.4 }));
    pole.position.y = 0.75;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), pole.material);
    base.position.y = 0.02;
    this.mat = new THREE.MeshStandardMaterial({ map: this.closedTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: this.closedTex, emissiveIntensity: 0.25 });
    this.board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.23, 0.02), this.mat);
    this.board.position.y = 1.45;
    this.group.add(pole, base, this.board);
    this.group.traverse((o) => { o.userData.kind = 'sign'; });
  }

  set(open: boolean, animate = true): void {
    const tex = open ? this.openTex : this.closedTex;
    this.mat.map = tex;
    this.mat.emissiveMap = tex;
    this.mat.needsUpdate = true;
    if (animate) this.flipT = 0;
  }

  setNight(n: number): void {
    this.mat.emissiveIntensity = 0.25 + n * 0.8;
  }

  update(dt: number): void {
    if (this.flipT >= 1) return;
    this.flipT = Math.min(1, this.flipT + dt / 0.35);
    this.board.rotation.y = (1 - this.flipT) * Math.PI * 2;
  }
}
