import type * as THREE from 'three';
import type { Services } from '../core/Services';
import type { SoundName } from '../core/EventBus';
import type { AudioEngine } from '../engine/Audio';
import type { Input } from '../engine/Input';
import type { Renderer } from '../engine/Renderer';
import type { PlayerController } from '../player/PlayerController';
import type { HeldItem } from '../player/HeldItem';
import type { Interaction } from '../player/Interaction';
import type { CameraTween } from '../player/CameraTween';
import type { ProductInstances } from '../products/ProductInstances';
import type { Store } from '../world/Store';
import type { BoxManager } from './BoxManager';
import type { Effects } from './Effects';
import type { FurnitureManager } from './FurnitureManager';

export type Mode = 'play' | 'pc' | 'checkout' | 'build' | 'modal' | 'gallery' | 'drive';

/** Tham chiếu dùng chung giữa các phần của ván chơi. */
export interface GameCtx {
  s: Services;
  r: Renderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  input: Input;
  audio: AudioEngine;
  store: Store;
  furniture: FurnitureManager;
  boxes: BoxManager;
  products: ProductInstances;
  effects: Effects;
  player: PlayerController;
  held: HeldItem;
  interaction: Interaction;
  tween: CameraTween;
  mode: Mode;
  toast(message: string, kind?: 'info' | 'error' | 'success'): void;
  sound(name: SoundName, pos?: THREE.Vector3, pitch?: number): void;
}
