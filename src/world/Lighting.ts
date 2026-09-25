import * as THREE from 'three';
import { ENV_INTENSITY } from '../config/constants';
import { nightAt } from '../systems/LightingSystem';

interface Sky {
  sky: THREE.Color;
  sun: number;
  sunColor: THREE.Color;
  night: number;
}

const DAWN = new THREE.Color(0xf6c9a0);
const DAY = new THREE.Color(0x9fd3f2);
const DUSK = new THREE.Color(0xf4a974);
const NIGHT = new THREE.Color(0x141c33);

/** Màu trời & mặt trời theo giờ: bình minh hồng cam → trưa → vàng chiều → tối xanh. */
export function skyAt(hour: number): Sky {
  const c = new THREE.Color();
  if (hour < 9.5) {
    const t = Math.max(0, Math.min(1, (hour - 7.5) / 2));
    return { sky: c.copy(DAWN).lerp(DAY, t), sun: 1.2 + t, sunColor: new THREE.Color(0xffc890).lerp(new THREE.Color(0xfff4e0), t), night: nightAt(hour) };
  }
  if (hour < 16.5) return { sky: c.copy(DAY), sun: 2.2, sunColor: new THREE.Color(0xfff4e0), night: 0 };
  if (hour < 18.5) {
    const t = (hour - 16.5) / 2;
    return { sky: c.copy(DAY).lerp(DUSK, t), sun: 2.2 - t * 1.2, sunColor: new THREE.Color(0xfff4e0).lerp(new THREE.Color(0xffa060), t), night: t * 0.3 };
  }
  if (hour < 20) {
    const t = (hour - 18.5) / 1.5;
    return { sky: c.copy(DUSK).lerp(NIGHT, t), sun: 1 - t, sunColor: new THREE.Color(0xffa060), night: 0.3 + t * 0.7 };
  }
  return { sky: c.copy(NIGHT), sun: 0, sunColor: new THREE.Color(0x6070a0), night: 1 };
}

/**
 * Đèn: 1 đèn trần đổ bóng (cường độ theo số đèn trần đang bật), bán cầu làm ánh sáng nền,
 * mặt trời ngoài trời (không đổ bóng) đổi theo giờ. Đèn cục bộ của từng bóng nằm ở StoreLighting.
 */
export class Lighting {
  readonly ceiling: THREE.DirectionalLight;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  night = 0;

  constructor(private scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xfffaf0, 0x8a8070, 0.55);
    scene.add(this.hemi);
    this.ceiling = new THREE.DirectionalLight(0xfff5e8, 1.1);
    this.ceiling.castShadow = true;
    this.ceiling.shadow.bias = -0.0004;
    this.ceiling.shadow.normalBias = 0.02;
    this.ceiling.shadow.radius = 4;
    scene.add(this.ceiling, this.ceiling.target);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2);
    this.sun.position.set(-20, 30, 40);
    scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.Fog(DAY.clone(), 45, 120);
    scene.background = DAY.clone();
  }

  /** Cập nhật vùng bóng đổ theo kích thước cửa hàng. */
  fit(W: number, D: number): void {
    const cx = W / 2;
    const cz = D / 2;
    this.ceiling.position.set(cx + 1.5, 14, cz + 3);
    this.ceiling.target.position.set(cx, 0, cz);
    const cam = this.ceiling.shadow.camera;
    const r = Math.max(W, D) / 2 + 3;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 30;
    cam.updateProjectionMatrix();
    this.sun.target.position.set(cx, 0, D + 4);
  }

  dispose(): void {
    for (const l of [this.ceiling, this.ceiling.target, this.sun, this.sun.target, this.hemi]) l.removeFromParent();
    this.ceiling.shadow.map?.dispose();
  }

  /** interior: độ sáng do đèn trần (0 = tắt hết / không có đèn, 1 = phủ kín cửa hàng). */
  setHour(hour: number, interior = 1): void {
    const s = skyAt(hour);
    this.night = s.night;
    const day = 1 - s.night;
    (this.scene.background as THREE.Color).copy(s.sky);
    this.scene.fog?.color.copy(s.sky);
    this.sun.intensity = s.sun;
    this.sun.color.copy(s.sunColor);
    this.hemi.intensity = 0.06 + day * 0.39 + interior * 0.15;
    this.hemi.color.set(0xfffaf0).lerp(new THREE.Color(0x8090c0), s.night * 0.5);
    this.ceiling.intensity = 1.15 * interior;
    this.scene.environmentIntensity = ENV_INTENSITY * (0.14 + day * 0.5 + interior * 0.45);
  }
}
