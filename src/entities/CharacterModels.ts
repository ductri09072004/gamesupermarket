import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_HEIGHT } from '../config/characters';

/** Registry model nhân vật đã nạp. Mọi file dùng chung khung xương → clip lấy từ file nào có animation. */
const scenes = new Map<string, THREE.Group>();
const clips = new Map<string, THREE.AnimationClip>();
let scale = 1;

export function registerCharacter(name: string, gltf: GLTF): void {
  scenes.set(name, gltf.scene);
  for (const c of gltf.animations) clips.set(c.name, c);
  if (scenes.size === 1 || name === 'Casual_Male') {
    // tỉ lệ chung tính từ model không đội mũ (cùng khung xương nên áp cho mọi model)
    gltf.scene.updateMatrixWorld(true);
    const h = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y;
    if (h > 0) scale = CHARACTER_HEIGHT / h;
  }
}

export function characterScene(name: string | undefined): THREE.Group | null {
  return (name && scenes.get(name)) || null;
}

export function characterClip(name: string): THREE.AnimationClip | null {
  return clips.get(name) ?? null;
}

export function characterScale(): number {
  return scale;
}

export function hasCharacters(): boolean {
  return scenes.size > 0 && clips.size > 0;
}
