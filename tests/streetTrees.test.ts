import { describe, expect, it } from 'vitest';
import { TREES } from '../src/config/city';
import { cityLayout } from '../src/world/CityLayout';
import * as THREE from 'three';
import { buildStreetTreeInstances } from '../src/world/StreetTreeInstances';
import { setActiveQuality } from '../src/config/quality';

describe('street tree assets', () => {
  it('mixes all three approved models without moving the trunk collider', () => {
    const layout = cityLayout(6, 8);
    const trees = layout.placements.filter(p => p.kind === 'tree');
    expect(new Set(trees.map(p => p.model))).toEqual(new Set(TREES));
    for (const tree of trees) {
      expect(layout.colliders.some(c => c.tag === 'tree' && c.minX <= tree.x && c.maxX >= tree.x && c.minZ <= tree.z && c.maxZ >= tree.z)).toBe(true);
    }
  });
  it('switches to fewer leaf cards at distance while sharing materials and placement', () => {
    setActiveQuality('medium');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -1,2,0, 1,2,0, 1,4,0, -1,4,0,
      -1,3,1, 1,3,1, 1,5,1, -1,5,1,
    ], 3));
    geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
    const material = new THREE.MeshStandardMaterial();
    material.name = 'tree_leaves';
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, material));
    const group = new THREE.Group();
    buildStreetTreeInstances(scene, [{ kind:'tree',model:'tree_small_02',x:12,z:18,rot:0,variant:0 }], group);
    group.updateMatrixWorld(true);
    const lod = group.children[0] as THREE.LOD;
    const near = lod.levels[0].object.children[0] as THREE.InstancedMesh;
    const far = lod.levels[1].object.children[0] as THREE.InstancedMesh;
    expect(far.geometry.index!.count).toBe(near.geometry.index!.count / 2);
    expect(far.material).toBe(near.material);
    const matrix = new THREE.Matrix4();
    near.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).add(lod.position)).toEqual(new THREE.Vector3(12,0,18));
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(12,0,18); camera.updateMatrixWorld(); lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(0);
    camera.position.z += 60; camera.updateMatrixWorld(); lod.update(camera);
    expect(lod.getCurrentLevel()).toBe(1);
  });
});
