import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_HEIGHT, FEMALE_MODELS, SHARED_CLIPS, WALK_CLIP_SPEED } from '../config/characters';

/** Registry nhân vật: mỗi model mang clip riêng (Quaternius) hoặc dùng chung bộ clip Mixamo, kèm tỉ lệ riêng. */
interface Entry {
  scene: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
  scale: number;
  /** Tốc độ bước của clip Walk (m/s) theo bộ khung xương */
  walkSpeed: number;
}

const entries = new Map<string, Entry>();
let shared: { clips: THREE.AnimationClip[]; hipsY: number } | null = null;
const HIPS = 'mixamorig:Hips';

function hipsHeight(scene: THREE.Object3D): number {
  return scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(HIPS))?.position.y ?? 0;
}

/** Bản sao clip chung cho một nhân vật: quỹ đạo hông co theo chiều cao hông của người đó (chân không lún/hổng). */
function fitClips(hipsY: number): Map<string, THREE.AnimationClip> {
  const out = new Map<string, THREE.AnimationClip>();
  if (!shared) return out;
  const k = shared.hipsY > 0 && hipsY > 0 ? hipsY / shared.hipsY : 1;
  const hipsTrack = `${THREE.PropertyBinding.sanitizeNodeName(HIPS)}.position`;
  for (const clip of shared.clips) {
    const tracks = clip.tracks.map((t) => {
      if (t.name !== hipsTrack) return t;
      const c = t.clone();
      c.values = c.values.map((v) => v * k) as unknown as typeof c.values;
      return c;
    });
    out.set(clip.name, new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  return out;
}

export function registerCharacter(name: string, gltf: GLTF): void {
  gltf.scene.updateMatrixWorld(true);
  if (name === SHARED_CLIPS.file) {
    shared = { clips: gltf.animations, hipsY: hipsHeight(gltf.scene) };
    return;
  }
  // chiều cao lấy theo hộp bao ở tư thế gốc (tay dang ngang không ảnh hưởng trục Y)
  const h = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).y;
  const target = FEMALE_MODELS.has(name) ? CHARACTER_HEIGHT.female : CHARACTER_HEIGHT.male;
  const mixamo = name.startsWith(SHARED_CLIPS.prefix);
  const modular = !!gltf.scene.getObjectByName('WristR');
  const clips = new Map(gltf.animations.map((c) => [c.name, c]));
  if (mixamo) for (const [k, c] of fitClips(hipsHeight(gltf.scene))) if (!clips.has(k)) clips.set(k, c);
  entries.set(name, {
    scene: gltf.scene, clips, scale: h > 0 ? target / h : 1,
    walkSpeed: mixamo ? WALK_CLIP_SPEED.mixamo : modular ? WALK_CLIP_SPEED.modular : WALK_CLIP_SPEED.animated,
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
