import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeCityResources } from '../src/world/CityResources';
import { retainCityGeometry, retainCityMaterial, retainCityTexture } from '../src/world/CityModels';

describe('city resource lifetime', () => {
  it('releases instance buffers and generated geometry once, preserving shared assets', () => {
    const shared = new THREE.BoxGeometry(), assetMat = new THREE.MeshStandardMaterial();
    retainCityGeometry(shared); retainCityMaterial(assetMat);
    const own = new THREE.BoxGeometry(), ownMat = new THREE.MeshStandardMaterial();
    const group = new THREE.Group();
    const inst = new THREE.InstancedMesh(shared, assetMat, 2);
    group.add(inst, new THREE.Mesh(own, ownMat), new THREE.Mesh(own, ownMat));
    const releaseShared = vi.spyOn(shared, 'dispose'), releaseAsset = vi.spyOn(assetMat, 'dispose');
    const releaseOwn = vi.spyOn(own, 'dispose'), releaseMat = vi.spyOn(ownMat, 'dispose'), releaseInst = vi.spyOn(inst, 'dispose');
    disposeCityResources(group);
    expect(releaseInst).toHaveBeenCalledOnce();
    expect(releaseOwn).toHaveBeenCalledOnce(); expect(releaseMat).toHaveBeenCalledOnce();
    expect(releaseShared).not.toHaveBeenCalled(); expect(releaseAsset).not.toHaveBeenCalled();
  });
  it('releases procedural textures once while keeping cached signs/PBR/asset maps', () => {
    const generated = new THREE.Texture(), shared = new THREE.Texture();
    retainCityTexture(shared);
    const mat = new THREE.MeshStandardMaterial({ map: shared, normalMap: generated, emissiveMap: generated });
    const root = new THREE.Group(); root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
    const ownDispose = vi.spyOn(generated, 'dispose'), sharedDispose = vi.spyOn(shared, 'dispose');
    disposeCityResources(root, [generated]);
    expect(ownDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
  });

});
