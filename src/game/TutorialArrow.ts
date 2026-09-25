import * as THREE from 'three';

/** Mũi tên 3D nhấp nhô chỉ tới vật cần tương tác (tutorial ngày 1). */
export class TutorialArrow {
  readonly group = new THREE.Group();
  private t = 0;

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.9, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 16), mat);
    head.rotation.x = Math.PI;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 12), mat);
    shaft.position.y = 0.24;
    this.group.add(head, shaft);
    this.group.visible = false;
  }

  point(target: THREE.Vector3 | null, dt: number): void {
    this.group.visible = !!target;
    if (!target) return;
    this.t += dt;
    this.group.position.set(target.x, target.y + 0.35 + Math.abs(Math.sin(this.t * 3)) * 0.15, target.z);
    this.group.rotation.y += dt * 2;
  }
}
