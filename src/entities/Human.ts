import * as THREE from 'three';
import { contactShadow } from '../world/ContactShadow';

export interface HumanLook {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  apron?: number;
  female?: boolean;
}

export const SHIRTS = [0xef476f, 0x06d6a0, 0x118ab2, 0xffd166, 0x9b5de5, 0xf78c6b, 0x43aa8b, 0x577590, 0xe76f51, 0x8ecae6];
export const PANTS = [0x2b2d42, 0x3d405b, 0x6b705c, 0x264653, 0x5e548e, 0x1d3557];
export const SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
export const HAIRS = [0x2b2d42, 0x4a3728, 0x8d5524, 0xd4a373, 0x9a9a9a, 0x1a1a1a];

const geo = {
  torso: new THREE.CapsuleGeometry(0.17, 0.32, 4, 10),
  hips: new THREE.CapsuleGeometry(0.15, 0.08, 4, 10),
  head: new THREE.SphereGeometry(0.115, 16, 12),
  hair: new THREE.SphereGeometry(0.124, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  limb: new THREE.CapsuleGeometry(0.05, 0.3, 4, 8),
  leg: new THREE.CapsuleGeometry(0.065, 0.38, 4, 8),
  shoe: new THREE.BoxGeometry(0.1, 0.06, 0.2),
  eye: new THREE.SphereGeometry(0.014, 8, 6),
  apron: new THREE.BoxGeometry(0.3, 0.45, 0.02),
};
const matCache = new Map<number, THREE.MeshStandardMaterial>();
function m(color: number, rough = 0.7): THREE.MeshStandardMaterial {
  let x = matCache.get(color);
  if (!x) {
    x = new THREE.MeshStandardMaterial({ color, roughness: rough });
    matCache.set(color, x);
  }
  return x;
}

function mesh(g: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const me = new THREE.Mesh(g, mat);
  me.castShadow = true;
  return me;
}

/**
 * Người low-poly (cao ~1.7m), gốc ở chân, mặt hướng -Z. Animation đi / đứng / với tay bằng code.
 * Dùng chung geometry cho mọi nhân vật; vật liệu cache theo màu.
 */
export class Human {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private armL: THREE.Group;
  private armR: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private head: THREE.Group;
  readonly handR = new THREE.Group();
  readonly handL = new THREE.Group();
  private phase = Math.random() * 10;
  private reachT = 0;
  speed = 0;
  animate = true;
  holding = false;

  constructor(look: HumanLook) {
    const shirt = m(look.shirt);
    const skin = m(look.skin, 0.6);
    const pants = m(look.pants);
    const shoes = m(0x222222, 0.5);
    this.root.add(this.body, contactShadow(0.62, 0.62, 0.5, true));
    const hips = mesh(geo.hips, pants);
    hips.position.y = 0.92;
    const torso = mesh(geo.torso, shirt);
    torso.position.y = 1.2;
    torso.scale.set(1, 1, 0.75);
    this.body.add(hips, torso);
    if (look.apron !== undefined) {
      const ap = mesh(geo.apron, m(look.apron));
      ap.position.set(0, 1.08, -0.13);
      this.body.add(ap);
    }
    this.head = new THREE.Group();
    this.head.position.y = 1.56;
    const h = mesh(geo.head, skin);
    const hair = mesh(geo.hair, m(look.hair, 0.8));
    hair.position.set(0, 0.012, 0.012);
    hair.rotation.x = -0.35;
    if (look.female) hair.scale.set(1.08, 1.3, 1.1);
    const eyeMat = m(0x1a1a1a, 0.3);
    const e1 = mesh(geo.eye, eyeMat);
    const e2 = mesh(geo.eye, eyeMat);
    e1.position.set(-0.04, 0.01, -0.105);
    e2.position.set(0.04, 0.01, -0.105);
    this.head.add(h, hair, e1, e2);
    this.body.add(this.head);
    const limb = (x: number, y: number, g: THREE.BufferGeometry, mat: THREE.Material, len: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const l = mesh(g, mat);
      l.position.y = -len / 2;
      pivot.add(l);
      return pivot;
    };
    this.armL = limb(-0.23, 1.38, geo.limb, shirt, 0.4);
    this.armR = limb(0.23, 1.38, geo.limb, shirt, 0.4);
    for (const [arm, hand] of [[this.armL, this.handL], [this.armR, this.handR]] as const) {
      const hs = mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
      hs.position.y = -0.45;
      hand.position.y = -0.48;
      arm.add(hs, hand);
    }
    this.legL = limb(-0.09, 0.9, geo.leg, pants, 0.5);
    this.legR = limb(0.09, 0.9, geo.leg, pants, 0.5);
    for (const leg of [this.legL, this.legR]) {
      const s = mesh(geo.shoe, shoes);
      s.position.set(0, -0.86, -0.03);
      leg.add(s);
    }
    this.body.add(this.armL, this.armR, this.legL, this.legR);
  }

  /** Với tay lấy hàng (tay phải). */
  reach(): void {
    this.reachT = 0.7;
  }

  update(dt: number): void {
    if (!this.animate) return;
    const walking = this.speed > 0.05;
    this.phase += dt * (walking ? this.speed * 5.2 : 1.5);
    const s = Math.sin(this.phase);
    const amp = walking ? Math.min(0.6, this.speed * 0.45) : 0;
    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    this.armL.rotation.x = -s * amp * 0.8;
    this.armR.rotation.x = s * amp * 0.8;
    this.body.position.y = walking ? Math.abs(Math.cos(this.phase)) * 0.03 : Math.sin(this.phase) * 0.006;
    this.armL.rotation.z = 0.08;
    this.armR.rotation.z = -0.08;
    if (this.holding) {
      this.armL.rotation.x = -0.35;
      this.armL.rotation.z = 0.05;
    }
    if (this.reachT > 0) {
      this.reachT = Math.max(0, this.reachT - dt);
      const k = Math.sin((this.reachT / 0.7) * Math.PI);
      this.armR.rotation.x = -1.45 * k;
      this.head.rotation.x = 0.2 * k;
    } else this.head.rotation.x = 0;
  }

  /** Đặt dáng cầm thùng bằng 2 tay trước ngực. */
  setCarrying(on: boolean): void {
    if (!on) return;
    this.armL.rotation.set(-1.2, 0, 0.25);
    this.armR.rotation.set(-1.2, 0, -0.25);
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
