import * as THREE from 'three';
import { SCOOTER_FILTERS } from '../config/city';
import { BIKE_MODELS, NPC_CAR_MODELS } from '../config/fleet';
import type { Rng } from '../core/Random';
import { scooterMaterial } from '../world/CityInstances';
import { cityModel } from '../world/CityModels';

export type VehicleKind = 'car' | 'moto' | 'bus';

const tmpColor = new THREE.Color();

function clone(name: string, shadow: boolean): THREE.Object3D | null {
  const src = cityModel(name);
  if (!src) return null;
  const o = src.clone(true);
  o.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = shadow; });
  return o;
}

/** Ô tô cổ ngẫu nhiên (đầu xe -Z) kèm nửa bề ngang / nửa chiều dài thân va chạm; thiếu model thì hộp màu. */
export function carModel(rng: Rng): { obj: THREE.Object3D; hw: number; hl: number } {
  const k = NPC_CAR_MODELS[Math.floor(rng() * NPC_CAR_MODELS.length)];
  const o = clone(k.model, true);
  if (o) {
    if (k.flip) o.rotation.y = Math.PI;
    const g = new THREE.Group();
    g.add(o);
    g.userData.model = k.model;
    return { obj: g, hw: (k.size[0] / 2) * 0.95, hl: k.size[2] / 2 };
  }
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 4.2),
    new THREE.MeshStandardMaterial({ color: tmpColor.setHSL(rng(), 0.5, 0.5).getHex(), roughness: 0.4, metalness: 0.4 }),
  );
  body.position.y = 0.7;
  body.castShadow = true;
  const g = new THREE.Group();
  g.add(body);
  return { obj: g, hw: 0.92, hl: 2.05 };
}

/** Xe buýt Hà Nội (model CC-BY quay mặt +Z → xoay lại cho đầu xe về -Z như các xe khác). */
export function busModel(): THREE.Object3D {
  const g = new THREE.Group();
  const o = clone('vn_bus', false);
  if (o) {
    o.rotation.y = Math.PI;
    g.add(o);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 9.4), new THREE.MeshStandardMaterial({ color: 0x2d9c5a, roughness: 0.5 }));
    body.position.y = 1.5;
    g.add(body);
  }
  return g;
}

/** Xe máy chạy trên phố: chỉ có xe, không có người lái (cho nhẹ và đỡ rối mắt). */
export function motoModel(rng: Rng): { obj: THREE.Object3D } {
  const g = new THREE.Group();
  const kind = BIKE_MODELS[Math.floor(rng() * BIKE_MODELS.length)];
  const bike = clone(kind.model, false) ?? clone('vn_scooter', false);
  if (bike) {
    const variant = Math.floor(rng() * SCOOTER_FILTERS.length);
    bike.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => scooterMaterial(x, variant)) : scooterMaterial(mesh.material, variant);
    });
    bike.rotation.y = kind.flip ? Math.PI : 0;
    g.add(bike);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.7), new THREE.MeshStandardMaterial({ color: 0x333a44 }));
    box.position.y = 0.45;
    g.add(box);
  }
  return { obj: g };
}
