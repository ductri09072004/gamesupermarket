import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { RiggedHuman } from '../src/entities/RiggedHuman';

it('releases NPC bone textures without destroying shared character geometry/materials', () => {
  const skeleton = new THREE.Skeleton([new THREE.Bone()]); skeleton.computeBoneTexture();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  const root = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.skeleton = skeleton; root.add(mesh);
  }
  const scene = new THREE.Scene(); scene.add(root);
  const human = Object.create(RiggedHuman.prototype) as RiggedHuman;
  const mixer = new THREE.AnimationMixer(root);
  Object.assign(human, { root, mixer });
  const releaseTexture = vi.spyOn(skeleton.boneTexture!, 'dispose');
  const releaseSkeleton = vi.spyOn(skeleton, 'dispose');
  const releaseGeometry = vi.spyOn(geometry, 'dispose'), releaseMaterial = vi.spyOn(material, 'dispose');
  const uncache = vi.spyOn(mixer, 'uncacheRoot');
  human.dispose();
  expect(releaseTexture).toHaveBeenCalledOnce(); expect(releaseSkeleton).toHaveBeenCalledOnce();
  expect(skeleton.boneTexture).toBe(null); expect(uncache).toHaveBeenCalledWith(root);
  expect(releaseGeometry).not.toHaveBeenCalled(); expect(releaseMaterial).not.toHaveBeenCalled();
  expect(root.parent).toBe(null);
});
