import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CityCulling } from '../src/world/CityCulling';

describe('static city instance culling', () => {
  it('restores original transforms/colours when the camera turns, preserving geometry and full bounds', () => {
    const root = new THREE.Group(); root.position.set(5, 0, 0);
    const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 2);
    mesh.userData.cityStatic = true;
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -10));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, 10));
    mesh.setColorAt(0, new THREE.Color('red')); mesh.setColorAt(1, new THREE.Color('blue'));
    root.add(mesh);
    const culling = new CityCulling(); culling.collect(root);
    const bounds = mesh.boundingSphere!.clone();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.set(5, 0, 0);
    camera.lookAt(5, 0, -10); culling.update(camera);
    expect(mesh.count).toBe(1);
    const matrix = new THREE.Matrix4(), colour = new THREE.Color();
    mesh.getMatrixAt(0, matrix); expect(matrix.elements[14]).toBe(-10);
    mesh.getColorAt(0, colour); expect(colour.getHexString()).toBe('ff0000');
    camera.lookAt(5, 0, 10); culling.update(camera);
    expect(mesh.count).toBe(1);
    mesh.getMatrixAt(0, matrix); expect(matrix.elements[14]).toBe(10);
    mesh.getColorAt(0, colour); expect(colour.getHexString()).toBe('0000ff');
    expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material);
    expect(mesh.boundingSphere!.equals(bounds)).toBe(true);
    camera.lookAt(5, 10, 0); culling.update(camera); expect(mesh.count).toBe(0);
    camera.lookAt(5, 0, -10); culling.update(camera); expect(mesh.count).toBe(1);
    culling.clear(); camera.lookAt(5, 0, 10); culling.update(camera);
    mesh.getMatrixAt(0, matrix); expect(matrix.elements[14]).toBe(-10);
  });
  it('leaves dynamic signal instance colours and counts untouched', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 10));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, 12));
    mesh.setColorAt(0, new THREE.Color('red'));
    const root = new THREE.Group(); root.add(mesh);
    const culling = new CityCulling(); culling.collect(root);
    mesh.setColorAt(0, new THREE.Color('green'));
    culling.update(new THREE.PerspectiveCamera());
    expect(mesh.count).toBe(2);
    const colour = new THREE.Color(); mesh.getColorAt(0, colour);
    expect(colour.getHexString()).toBe('008000');
  });
});
