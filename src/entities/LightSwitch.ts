import * as THREE from 'three';

/** Công tắc đèn gắn tường cạnh cửa (mặt quay +X, vào trong cửa hàng). Nhìn vào + E để bật/tắt. */
export class LightSwitch {
  readonly group = new THREE.Group();
  private rocker: THREE.Mesh;
  private ledMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 });

  constructor() {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.09), new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.35 }));
    this.rocker = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.045), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    this.rocker.position.x = 0.01;
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.008), this.ledMat);
    led.position.set(0.008, 0.052, 0);
    // biển nhỏ phía trên
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2b2d42';
    g.fillRect(0, 0, 128, 48);
    g.fillStyle = '#ffd166';
    g.font = '900 26px "Nunito", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('💡 ĐÈN', 64, 26);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    label.rotation.y = Math.PI / 2;
    label.position.set(0.007, 0.13, 0);
    // vùng bắt tia vô hình rộng hơn công tắc thật → dễ ngắm
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.05;
    this.group.add(plate, this.rocker, led, label, hit);
    this.group.traverse((o) => { o.userData.kind = 'switch'; });
  }

  /** Đặt trên tường trái (x = 0), gần cửa ra vào. */
  place(storeH: number): void {
    this.group.position.set(0.012, 1.3, storeH - 2.2);
  }

  set(on: boolean): void {
    this.rocker.rotation.z = on ? -0.25 : 0.25;
    this.ledMat.emissiveIntensity = on ? 1.5 : 0.1;
    this.ledMat.color.set(on ? 0x22c55e : 0x7f1d1d);
    this.ledMat.emissive.set(on ? 0x22c55e : 0x7f1d1d);
  }
}
