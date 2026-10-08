import * as THREE from 'three';

interface Batch {
  mesh: THREE.InstancedMesh;
  matrices: Float32Array;
  colours: Float32Array | null;
  bounds: THREE.Box3[];
  shown: number[];
}

/** Keep original geometry/materials, submitting only static instances that can reach the camera. */
export class CityCulling {
  private batches: Batch[] = [];
  private previous = new THREE.Matrix4().makeScale(0, 0, 0);
  private projection = new THREE.Matrix4();
  private frustum = new THREE.Frustum();

  collect(root: THREE.Object3D): void {
    this.clear();
    root.updateMatrixWorld(true);
    root.traverse(o => {
      const mesh = o as THREE.InstancedMesh;
      if (!mesh.isInstancedMesh || !mesh.userData.cityStatic || mesh.count < 2) return;
      mesh.geometry.computeBoundingBox();
      const matrix = new THREE.Matrix4();
      const bounds: THREE.Box3[] = [];
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.premultiply(mesh.matrixWorld);
        bounds.push(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
      }
      // Preserve full bounds for coarse Three.js culling and interaction raycasts.
      mesh.computeBoundingSphere();
      this.batches.push({ mesh, matrices: new Float32Array(mesh.instanceMatrix.array),
        colours: mesh.instanceColor ? new Float32Array(mesh.instanceColor.array) : null, bounds, shown: [-1] });
    });
  }

  update(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (this.projection.equals(this.previous)) return;
    this.previous.copy(this.projection);
    this.frustum.setFromProjectionMatrix(this.projection);
    for (const batch of this.batches) {
      const shown: number[] = [];
      batch.bounds.forEach((bounds, i) => { if (this.frustum.intersectsBox(bounds)) shown.push(i); });
      if (shown.length === batch.shown.length && shown.every((v, i) => v === batch.shown[i])) continue;
      const { mesh, matrices, colours } = batch;
      shown.forEach((source, dest) => {
        (mesh.instanceMatrix.array as Float32Array).set(matrices.subarray(source * 16, source * 16 + 16), dest * 16);
        if (colours && mesh.instanceColor) (mesh.instanceColor.array as Float32Array).set(colours.subarray(source * 3, source * 3 + 3), dest * 3);
      });
      mesh.count = shown.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      batch.shown = shown;
    }
  }

  clear(): void {
    this.batches = [];
    this.previous.makeScale(0, 0, 0);
  }
}
