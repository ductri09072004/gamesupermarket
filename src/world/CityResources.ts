import * as THREE from 'three';
import { sharedCityGeometry, sharedCityMaterial, sharedCityTexture } from './CityModels';

/** Release rebuilt city buffers, while preserving assets and cached LOD/materials shared with the next build. */
export function disposeCityResources(root: THREE.Object3D, extraTextures: readonly THREE.Texture[] = []): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(extraTextures);
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).dispose();
    if (!sharedCityGeometry(mesh.geometry)) geometries.add(mesh.geometry);
    for (const material of [mesh.material].flat()) if (!sharedCityMaterial(material)) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture && !sharedCityTexture(value)) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) if (!sharedCityTexture(texture)) texture.dispose();
}
