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
const NIGHT = new THREE.Color(0x04060d);
/** Ánh trăng xanh lạnh ban đêm (mặt trời thay màu & cường độ) */
const MOON = new THREE.Color(0x7d8fc4);
const MOON_INTENSITY = 0.12;

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
    return { sky: c.copy(DUSK).lerp(NIGHT, t), sun: Math.max(MOON_INTENSITY, 1 - t), sunColor: new THREE.Color(0xffa060).lerp(MOON, t), night: 0.3 + t * 0.7 };
  }
  // trời đêm: gần như đen, chỉ có ánh trăng rất nhẹ — sáng là nhờ đèn đường / biển hiệu / cửa hàng
  return { sky: c.copy(NIGHT), sun: MOON_INTENSITY, sunColor: MOON.clone(), night: 1 };
}

/**
 * Đèn: 1 đèn trần đổ bóng dạng spot chỉ phủ cửa hàng (cường độ theo số đèn trần đang bật — không rọi ra phố),
 * bán cầu làm ánh sáng nền, mặt trời / ánh trăng ngoài trời (không đổ bóng) đổi theo giờ.
 * Đèn cục bộ của từng bóng nằm ở StoreLighting.
 */
export class Lighting {
  readonly ceiling: THREE.SpotLight;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  night = 0;

  constructor(private scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xfffaf0, 0x8a8070, 0.55);
    scene.add(this.hemi);
    // decay 0: không suy giảm theo khoảng cách → trong nón sáng đều như đèn định hướng cũ
    this.ceiling = new THREE.SpotLight(0xfff5e8, 1.1, 0, Math.PI / 4, 0.35, 0);
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
    // nón sáng vừa phủ cửa hàng (+ kho phía sau) từ trên cao, mép mềm — ngoài phố không bị rọi
    const h = 16;
    this.ceiling.position.set(cx, h, cz - 1);
    this.ceiling.target.position.set(cx, 0, cz - 1);
    const r = Math.hypot(W / 2, D / 2 + 3) + 0.5;
    this.ceiling.angle = Math.atan(r / h);
    this.ceiling.penumbra = 0.15;
    const cam = this.ceiling.shadow.camera;
    cam.near = h - 5;
    cam.far = h + 2;
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
    // ánh sáng nền & môi trường áp cho cả phố → không cộng theo đèn trong nhà (trong nhà đã có đèn trần + đèn từng bóng)
    this.hemi.intensity = 0.03 + day * 0.42 + interior * 0.04;
    this.hemi.color.set(0xfffaf0).lerp(new THREE.Color(0x5a6a9a), s.night * 0.8);
    this.hemi.groundColor.set(0x8a8070).lerp(new THREE.Color(0x151518), s.night);
    this.ceiling.intensity = 1.35 * interior;
    this.scene.environmentIntensity = ENV_INTENSITY * (0.05 + day * 0.6 + interior * 0.12);
  }
}
