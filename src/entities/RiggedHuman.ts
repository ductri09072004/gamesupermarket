import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CLIPS, RECOLOR_MODELS, WALK_CLIP_SPEED } from '../config/characters';
import { contactShadow } from '../world/ContactShadow';
import { characterClip, characterScale, characterScene, hasCharacters } from './CharacterModels';
import { Human, type HumanBody, type HumanLook } from './Human';

const PICK_S = 0.9;
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const matCache = new Map<string, THREE.Material>();

/** Vật liệu theo khách: chỉ clone phần đổi màu (da, tóc, áo, quần), cache theo màu để khách trùng màu dùng chung. */
function recolor(model: string, mat: THREE.Material, look: HumanLook): THREE.Material {
  const name = mat.name;
  let color: number | null = null;
  if (name === 'Skin') color = look.skin;
  else if (name === 'Hair') color = look.hair;
  else if (RECOLOR_MODELS.has(model) && name === 'Shirt') color = look.shirt;
  else if (RECOLOR_MODELS.has(model) && name === 'Pants') color = look.pants;
  const key = `${model}:${name}:${color ?? 'base'}`;
  let m = matCache.get(key);
  if (!m) {
    const c = mat.clone() as THREE.MeshStandardMaterial;
    if (color !== null) c.color.setHex(color);
    c.roughness = name === 'Hair' ? 0.6 : 0.85;
    c.metalness = 0;
    // file gốc để doubleSided → mặt sau cũng vào shadow map và tự đổ bóng lốm đốm (shadow acne)
    c.side = name === 'Hair' ? THREE.DoubleSide : THREE.FrontSide;
    c.shadowSide = THREE.BackSide;
    m = c;
    matCache.set(key, m);
  }
  return m;
}

/**
 * Người rig (model Quaternius) với AnimationMixer: Idle ↔ Walk trộn theo tốc độ, Walk_Carry khi bê thùng,
 * PickUp khi lấy hàng. Cùng API với Human để Walker/Customer/Staff không phải đổi.
 */
export class RiggedHuman implements HumanBody {
  readonly root = new THREE.Group();
  readonly handL = new THREE.Group();
  readonly handR = new THREE.Group();
  speed = 0;
  animate = true;
  animInterval = 0;
  private animAcc = 0;
  holding = false;
  private mixer: THREE.AnimationMixer;
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private carry: THREE.AnimationAction;
  private pick: THREE.AnimationAction | null;
  private carrying = false;
  private pickT = 0;

  constructor(model: string, look: HumanLook) {
    const body = cloneSkinned(characterScene(model)!) as THREE.Group;
    body.scale.setScalar(characterScale());
    body.rotation.y = Math.PI; // model Quaternius quay mặt +Z, quy ước game là -Z
    body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // bounding của SkinnedMesh không theo animation
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => recolor(model, m, look)) : recolor(model, mesh.material, look);
    });
    this.root.add(body, contactShadow(0.62, 0.62, 0.5, true));
    body.updateMatrixWorld(true);
    // gắn tay vào xương nắm tay; bù tỉ lệ để đồ cầm (giỏ, túi) giữ kích thước thật
    for (const [hand, bone] of [[this.handL, 'Fist.L'], [this.handR, 'Fist.R']] as const) {
      // GLTFLoader làm sạch tên node (bỏ '.'), "Fist.L" → "FistL"
      const b = body.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(bone));
      if (!b) continue;
      const ws = b.getWorldScale(new THREE.Vector3());
      hand.scale.setScalar(1 / ws.x);
      b.add(hand);
    }
    this.mixer = new THREE.AnimationMixer(body);
    const act = (name: string) => {
      const a = this.mixer.clipAction(characterClip(name)!);
      a.play();
      a.setEffectiveWeight(0);
      return a;
    };
    this.idle = act(CLIPS.idle);
    this.walk = act(CLIPS.walk);
    this.carry = act(CLIPS.carry);
    const pickClip = characterClip(CLIPS.pick);
    this.pick = pickClip ? this.mixer.clipAction(pickClip) : null;
    this.pick?.setLoop(THREE.LoopOnce, 1);
    this.idle.time = Math.random() * this.idle.getClip().duration;
    this.mixer.update(0);
  }

  reach(): void {
    if (!this.pick) return;
    this.pickT = PICK_S;
    this.pick.reset();
    this.pick.timeScale = this.pick.getClip().duration / PICK_S;
    this.pick.setEffectiveWeight(1).fadeIn(0.12).play();
  }

  update(frameDt: number): void {
    if (!this.animate) return;
    this.animAcc += frameDt;
    if (this.animAcc < this.animInterval) return;
    const dt = this.animAcc;
    this.animAcc = 0;
    const w = THREE.MathUtils.clamp(this.speed / 0.5, 0, 1);
    let p = 0;
    if (this.pickT > 0) {
      this.pickT = Math.max(0, this.pickT - dt);
      p = Math.min(1, this.pickT / 0.15, (PICK_S - this.pickT) / 0.12);
      if (this.pickT === 0) this.pick?.stop();
    }
    const walkAct = this.carrying ? this.carry : this.walk;
    const other = this.carrying ? this.walk : this.carry;
    walkAct.setEffectiveWeight(w * (1 - p));
    walkAct.timeScale = Math.max(0.5, this.speed / WALK_CLIP_SPEED);
    other.setEffectiveWeight(0);
    this.idle.setEffectiveWeight((1 - w) * (1 - p));
    this.pick?.setEffectiveWeight(p);
    this.mixer.update(dt);
    this.alignHands();
  }

  /** Đồ cầm (giỏ, túi) giữ thẳng đứng theo thân người thay vì xoay theo trục xương nắm tay. */
  private alignHands(): void {
    this.root.getWorldQuaternion(qb);
    for (const hand of [this.handL, this.handR]) {
      if (!hand.parent) continue;
      hand.parent.getWorldQuaternion(qa);
      hand.quaternion.copy(qa.invert().multiply(qb));
    }
  }

  setCarrying(on: boolean): void {
    this.carrying = on;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}

/** Tạo người rig nếu model đã nạp, ngược lại người khối. */
export function createHuman(look: HumanLook): HumanBody {
  if (look.model && hasCharacters() && characterScene(look.model)) return new RiggedHuman(look.model, look);
  return new Human(look);
}
