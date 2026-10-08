import * as THREE from 'three';
import { cityModel, retainCityMaterial } from '../world/CityModels';
import { disposeCityResources } from '../world/CityResources';

/** Đồ nghề của người bán rong đi bộ: nón lá + đòn gánh vắt vai với hai thúng hàng (gốc = chân người, mặt người -Z). */
export interface VendorGear {
  group: THREE.Group;
  /** t: giây; walking: đang đi (đòn gánh nhún theo nhịp bước, đứng thì chỉ đung đưa nhẹ) */
  animate(t: number, walking: boolean): void;
  dispose(): void;
}

const wicker = new THREE.MeshStandardMaterial({ color: 0xb98b4b, roughness: 0.9, side: THREE.DoubleSide });
const bamboo = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.7 });
const rope = new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.9 });
for (const material of [wicker, bamboo, rope]) retainCityMaterial(material);
const GOODS = [0xe4572e, 0xf3a712, 0x59a14f, 0xe9c46a];

function basket(side: number, hex: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(side * 0.62, 0, 0);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.17, 14, 1, true), wicker);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14), wicker);
  bottom.position.y = -0.08;
  const heap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }));
  heap.position.y = -0.03;
  heap.scale.y = 0.55;
  g.add(body, bottom, heap);
  // 2 dây kéo thúng lên đòn gánh
  for (const dx of [-0.15, 0.15]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 4), rope);
    r.position.set(dx * 0.6, 0.31, 0);
    r.rotation.z = -dx * 0.5;
    g.add(r);
  }
  return g;
}

export function buildVendorGear(seed: number): VendorGear {
  const group = new THREE.Group();
  // đòn gánh nằm ngang qua vai (vuông góc hướng đi), thúng treo hai đầu
  const pole = new THREE.Group();
  pole.position.y = 1.32;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 6).rotateZ(Math.PI / 2), bamboo);
  pole.add(bar);
  const left = basket(-1, GOODS[seed % GOODS.length]);
  const right = basket(1, GOODS[(seed + 1) % GOODS.length]);
  left.position.y = right.position.y = -0.63;
  pole.add(left, right);
  group.add(pole);
  // nón lá trên đầu (model CC-BY; thiếu thì hình nón vàng)
  const src = cityModel('vn_non_la');
  const hat = src ? src.clone(true) : new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0xe8d9a0, roughness: 0.9 }));
  hat.position.set(0, 1.6, -0.02);
  hat.rotation.x = 0.1;
  group.add(hat);
  return {
    group,
    dispose() { disposeCityResources(group); group.removeFromParent(); },
    animate(t, walking) {
      const f = walking ? 1 : 0.25;
      pole.position.y = 1.32 + Math.sin(t * 10) * 0.018 * f;
      pole.rotation.z = Math.sin(t * 5) * 0.05 * f;
      left.rotation.z = right.rotation.z = -pole.rotation.z * 0.6;
    },
  };
}
