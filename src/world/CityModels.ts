import * as THREE from 'three';

/** Registry model thành phố (GLB đã chuẩn hoá: gốc giữa đáy, kích thước thật) + atlas màu nhà. */
const models = new Map<string, THREE.Group>();
const atlases = new Map<string, THREE.Texture>();

export function registerCityModel(name: string, scene: THREE.Group): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.receiveShadow = true;
  });
  models.set(name, scene);
}

export function registerBuildingAtlas(name: string, tex: THREE.Texture): void {
  // atlas 32×32: mỗi ô là 1 màu phẳng → lọc Nearest để màu không loang sang ô bên cạnh
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  // UV lấy từ FBX gốc (quy ước flipY = true), không phải UV chuẩn glTF
  atlases.set(name, tex);
}

export function cityModel(name: string): THREE.Group | null {
  return models.get(name) ?? null;
}

export function buildingAtlas(name: string): THREE.Texture | null {
  return atlases.get(name) ?? null;
}
