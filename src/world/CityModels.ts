import * as THREE from 'three';

/** Registry model thành phố (GLB đã chuẩn hoá: gốc giữa đáy, kích thước thật). */
const models = new Map<string, THREE.Group>();

export function registerCityModel(name: string, scene: THREE.Group): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.receiveShadow = true;
  });
  models.set(name, scene);
}

export function cityModel(name: string): THREE.Group | null {
  return models.get(name) ?? null;
}
