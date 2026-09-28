import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { normalizeModel } from '../engine/Assets';
import { cityModel } from '../world/CityModels';
import { block, std } from './FurnitureModels';

/** Bàn thờ Thần Tài – Ông Địa: model (CC-BY, xem CREDITS) + bát nhang có khói khi đang thắp. */
export interface AltarParts {
  group: THREE.Group;
  /** Gọi mỗi khung: burning = nhang còn cháy */
  update(dt: number, burning: boolean): void;
}

let smokeTex: THREE.Texture | null = null;
function smokeTexture(): THREE.Texture {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(150,150,155,0.7)');
  gr.addColorStop(1, 'rgba(150,150,155,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}

/** Mặt trước phía dưới của model (nơi đặt bát nhang): đỉnh cao nhất trong dải sát mặt trước, dưới 1.2m. */
function incenseSpot(model: THREE.Object3D, def: FurnitureDef): THREE.Vector3 {
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let y = 0.5;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.z < -def.size.d / 2 + 0.12 && v.y < 1.2 && Math.abs(v.x) < 0.3) y = Math.max(y, v.y);
    }
  });
  return new THREE.Vector3(0, y, -def.size.d / 2 + 0.08);
}

export function buildAltar(def: FurnitureDef): AltarParts {
  const g = new THREE.Group();
  const src = cityModel('vn_altar');
  let model: THREE.Object3D;
  if (src) {
    const c = src.clone(true);
    c.rotation.y = Math.PI; // model thành phố quay mặt +Z → nội thất quay mặt -Z
    model = normalizeModel(c, def.size);
  } else {
    // thiếu model: tủ thờ đỏ + mái nhỏ
    model = new THREE.Group();
    model.add(block(std(0x8b1a1a, 0.5), -def.size.w / 2, def.size.w / 2, 0, 0.9, -def.size.d / 2, def.size.d / 2));
    model.add(block(std(0xb91c1c, 0.4), -def.size.w / 2 + 0.1, def.size.w / 2 - 0.1, 0.9, 1.5, -def.size.d / 2 + 0.05, def.size.d / 2));
  }
  g.add(model);
  // bát nhang + 3 nén nhang
  const at = incenseSpot(model, def);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.06, 14), std(0xc9a227, 0.35, 0.7));
  bowl.position.copy(at).add(new THREE.Vector3(0, 0.03, 0));
  g.add(bowl);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff4a10, emissiveIntensity: 0 });
  const stickMat = std(0xa3242b, 0.7);
  const tips: THREE.Vector3[] = [];
  for (const dx of [-0.025, 0, 0.025]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 5), stickMat);
    stick.position.set(at.x + dx, at.y + 0.13, at.z);
    stick.rotation.z = dx * 3;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), tipMat);
    tip.position.set(at.x + dx - dx * 0.3, at.y + 0.23, at.z);
    tips.push(tip.position.clone());
    g.add(stick, tip);
  }
  // khói: vài sprite mờ bay lên, lắc nhẹ, tan dần (lặp)
  const puffs: Array<{ s: THREE.Sprite; t: number; base: THREE.Vector3 }> = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    g.add(s);
    puffs.push({ s, t: i / 9, base: tips[i % tips.length] });
  }
  return {
    group: g,
    update(dt, burning) {
      tipMat.emissiveIntensity = burning ? 1.6 + Math.sin(performance.now() / 180) * 0.4 : 0;
      for (const p of puffs) {
        p.s.visible = burning;
        if (!burning) continue;
        p.t = (p.t + dt / 4) % 1;
        const t = p.t;
        p.s.position.set(p.base.x + Math.sin(t * 9 + p.base.x * 40) * 0.05 * t, p.base.y + t * 0.9, p.base.z - t * 0.05);
        p.s.scale.setScalar(0.06 + t * 0.3);
        (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * t) * 0.75;
      }
    },
  };
}
