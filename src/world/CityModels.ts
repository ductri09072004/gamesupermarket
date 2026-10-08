import * as THREE from 'three';

/** Registry model thành phố (GLB đã chuẩn hoá: gốc giữa đáy, kích thước thật). */
const models = new Map<string, THREE.Group>();
const sharedGeometry = new WeakSet<THREE.BufferGeometry>();
const sharedMaterial = new WeakSet<THREE.Material>();
const sharedTextures = new WeakSet<THREE.Texture>();
export const retainCityTexture = (t: THREE.Texture): void => { sharedTextures.add(t); };
export const sharedCityTexture = (t: THREE.Texture): boolean => sharedTextures.has(t);
export const retainCityGeometry = (g: THREE.BufferGeometry): void => { sharedGeometry.add(g); };
export const retainCityMaterial = (m: THREE.Material): void => { sharedMaterial.add(m); };
export const sharedCityGeometry = (g: THREE.BufferGeometry): boolean => sharedGeometry.has(g);
export const sharedCityMaterial = (m: THREE.Material): boolean => sharedMaterial.has(m);

export function registerCityModel(name: string, scene: THREE.Group): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    retainCityGeometry(m.geometry);
    m.castShadow = false;
    m.receiveShadow = true;
    // Lá dùng alpha mask: giữ depth sorting đúng khi được instancing theo ô phố.
    for (const material of [m.material].flat()) {
      retainCityMaterial(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) retainCityTexture(value);
      if (material.alphaTest > 0) material.alphaToCoverage = true;
    }
  });
  models.set(name, scene);
}

export function cityModel(name: string): THREE.Group | null {
  return models.get(name) ?? null;
}
