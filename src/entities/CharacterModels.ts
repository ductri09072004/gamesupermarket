import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_HEIGHT, FEMALE_MODELS, WALK_CLIP_SPEED } from '../config/characters';

/** Registry nhân vật: mỗi model tự mang clip của nó (2 bộ khung xương khác nhau) và tỉ lệ riêng. */
interface Entry {
  scene: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
  scale: number;
  /** Tốc độ bước của clip Walk (m/s) theo bộ khung xương */
  walkSpeed: number;
}

const entries = new Map<string, Entry>();

export function registerCharacter(name: string, gltf: GLTF): void {
  gltf.scene.updateMatrixWorld(true);
  // chiều cao lấy theo hộp bao ở tư thế gốc (tay dang ngang không ảnh hưởng trục Y)
  const h = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y;
  const target = FEMALE_MODELS.has(name) ? CHARACTER_HEIGHT.female : CHARACTER_HEIGHT.male;
  const modular = !!gltf.scene.getObjectByName('WristR');
  entries.set(name, {
    scene: gltf.scene, clips: new Map(gltf.animations.map((c) => [c.name, c])), scale: h > 0 ? target / h : 1,
    walkSpeed: modular ? WALK_CLIP_SPEED.modular : WALK_CLIP_SPEED.animated,
  });
}

export function characterScene(name: string | undefined): THREE.Group | null {
  return (name && entries.get(name)?.scene) || null;
}

/** Clip của model (null nếu model không có clip đó). */
export function characterClip(model: string, clip: string): THREE.AnimationClip | null {
  return entries.get(model)?.clips.get(clip) ?? null;
}

export function characterScale(model: string): number {
  return entries.get(model)?.scale ?? 1;
}

export function characterWalkSpeed(model: string): number {
  return entries.get(model)?.walkSpeed ?? WALK_CLIP_SPEED.modular;
}

export function hasCharacters(): boolean {
  return entries.size > 0;
}
