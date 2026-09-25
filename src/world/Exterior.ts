import * as THREE from 'three';
import { CEILING_HEIGHT, SIDEWALK_DEPTH, WALL_THICKNESS } from '../config/constants';
import { textCanvas } from '../products/LabelTexture';
import { asphaltTexture, concreteTexture, facadeTexture, grassTexture } from './Textures';

/** Vỉa hè, đường, cỏ, cây, nhà đối diện, đèn đường, biển hiệu cửa hàng. */
export class Exterior {
  readonly group = new THREE.Group();
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private signMat: THREE.MeshStandardMaterial | null = null;
  private lampLights: THREE.PointLight[] = [];

  build(W: number, D: number): void {
    this.group.clear();
    this.lampMats = [];
    this.windowMats = [];
    this.lampLights = [];
    const walk = concreteTexture('#cdc9c1');
    walk.repeat.set(80 / 1, SIDEWALK_DEPTH);
    const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(80, SIDEWALK_DEPTH), new THREE.MeshStandardMaterial({ map: walk, roughness: 0.85 }));
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(W / 2, 0.005, D + WALL_THICKNESS + SIDEWALK_DEPTH / 2);
    sidewalk.receiveShadow = true;
    const curb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.15, 0.25), new THREE.MeshStandardMaterial({ color: 0xa8a39a, roughness: 0.8 }));
    curb.position.set(W / 2, 0.07, D + WALL_THICKNESS + SIDEWALK_DEPTH);
    const asphalt = asphaltTexture();
    asphalt.repeat.set(20, 2);
    const roadZ = D + WALL_THICKNESS + SIDEWALK_DEPTH + 4;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 8), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(W / 2, -0.02, roadZ);
    road.receiveShadow = true;
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xf1e3a0, roughness: 0.6 });
    const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.15), dashMat, 30);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) {
      m.makeRotationX(-Math.PI / 2).setPosition(W / 2 - 40 + i * 2.8, -0.01, roadZ);
      dashes.setMatrixAt(i, m);
    }
    const grass = grassTexture();
    grass.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2, -0.03, D / 2);
    ground.receiveShadow = true;
    this.group.add(sidewalk, curb, road, dashes, ground);
    // nhà bên kia đường
    for (let i = 0; i < 7; i++) {
      const bw = 7 + (i % 3) * 2;
      const bh = 6 + ((i * 5) % 4) * 2;
      const tex = facadeTexture(i);
      tex.map.repeat.set(bw / 4, bh / 8);
      tex.emissive.repeat.copy(tex.map.repeat);
      const mat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
      this.windowMats.push(mat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 6), mat);
      b.position.set(W / 2 - 30 + i * 9.5, bh / 2, roadZ + 4 + 3.5);
      this.group.add(b);
    }
    // cây & đèn đường trên vỉa hè
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5b43, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3e, roughness: 0.8 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.6, roughness: 0.4 });
    const zWalk = D + WALL_THICKNESS + SIDEWALK_DEPTH - 0.45;
    for (let x = -14; x < W + 16; x += 7) {
      if (x > -1 && x < W + 1 && Math.abs(x - 3) < 3) continue;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 8), trunkMat);
      trunk.position.y = 1.1;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), leafMat);
      crown.position.y = 2.8;
      crown.castShadow = true;
      tree.add(trunk, crown);
      tree.position.set(x, 0, zWalk);
      this.group.add(tree);
    }
    for (let x = -10; x < W + 14; x += 11) {
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd9a0, emissiveIntensity: 0 });
      this.lampMats.push(lampMat);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8), poleMat);
      pole.position.set(x + 3.5, 2.25, zWalk);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), lampMat);
      head.position.set(x + 3.5, 4.5, zWalk - 0.2);
      const light = new THREE.PointLight(0xffd9a0, 0, 9, 1.6);
      light.position.set(x + 3.5, 4.3, zWalk - 0.2);
      this.lampLights.push(light);
      this.group.add(pole, head, light);
    }
    // biển hiệu cửa hàng trên mặt tiền
    const signTex = textCanvas(1024, 160, (g) => {
      g.fillStyle = '#1f7a6d';
      g.fillRect(0, 0, 1024, 160);
      g.fillStyle = '#ffffff';
      g.font = '900 96px "Nunito", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('MINI MART', 512, 72);
      g.font = '700 30px "Nunito", Arial, sans-serif';
      g.fillStyle = '#ffd166';
      g.fillText('MỞ CỬA 8:00 – 22:00', 512, 136);
    });
    this.signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.15 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), this.signMat);
    sign.position.set(Math.min(W / 2, 6), (CEILING_HEIGHT + 2.45) / 2 + 0.05, D + WALL_THICKNESS + 0.01);
    this.group.add(sign);
  }

  /** night: 0 (ngày) → 1 (đêm). */
  setNight(night: number): void {
    for (const mat of this.lampMats) mat.emissiveIntensity = night * 3;
    for (const l of this.lampLights) l.intensity = night * 6;
    for (const mat of this.windowMats) mat.emissiveIntensity = night * 1.2;
    if (this.signMat) this.signMat.emissiveIntensity = 0.15 + night * 1.4;
  }
}
