import * as THREE from 'three';
import { TREE_LOD_DISTANCE } from '../config/city';
import { activeQuality } from '../config/quality';
import type { Placement } from './CityLayout';
import { retainCityGeometry } from './CityModels';

const distantLeaves = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Half the leaf cards at distance, enlarged slightly to preserve canopy coverage. */
function farLeaves(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = distantLeaves.get(source);
  if (cached) return cached;
  const geometry = source.clone();
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const indices: number[] = [];
  const original = source.index!;
  for (let card = 0; card < positions.count / 4; card += 2) {
    const center = new THREE.Vector3();
    for (let v = 0; v < 4; v++) center.add(new THREE.Vector3().fromBufferAttribute(positions, card * 4 + v));
    center.multiplyScalar(0.25);
    for (let v = 0; v < 4; v++) {
      const i = card * 4 + v;
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).sub(center).multiplyScalar(1.35).add(center);
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    for (let i = 0; i < 6; i++) indices.push(original.getX(card * 6 + i));
  }
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  retainCityGeometry(geometry);
  distantLeaves.set(source, geometry);
  return geometry;
}

/** One LOD per instanced model/chunk; both levels share textures and materials. */
export function buildStreetTreeInstances(scene: THREE.Group, placements: Placement[], group: THREE.Group): void {
  const center = new THREE.Vector3();
  for (const p of placements) center.add(new THREE.Vector3(p.x, 0, p.z));
  center.divideScalar(placements.length);
  const lod = new THREE.LOD();
  lod.position.copy(center);
  const near = new THREE.Group(), far = new THREE.Group();
  const place = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const leaves = [mesh.material].flat().some(m => m.name.includes('leaves'));
    for (const [target, geometry] of [[near, mesh.geometry], [far, leaves ? farLeaves(mesh.geometry) : mesh.geometry]] as const) {
      const inst = new THREE.InstancedMesh(geometry, mesh.material, placements.length);
      inst.userData.cityStatic = true;
      placements.forEach((p, i) => {
        rotation.setFromAxisAngle(up, p.rot);
        place.compose(new THREE.Vector3(p.x - center.x, p.y ?? 0, p.z - center.z), rotation, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, matrix.multiplyMatrices(place, mesh.matrixWorld));
      });
      inst.receiveShadow = true;
      inst.computeBoundingSphere();
      target.add(inst);
    }
  });
  if (activeQuality().cityRadius === Infinity) {
    lod.addLevel(near, 0);
    lod.addLevel(far, TREE_LOD_DISTANCE, 0.15);
  } else lod.addLevel(far, 0); // Siêu nhẹ uses fewer leaves even close to the player.
  group.add(lod);
}
