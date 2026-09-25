import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEFAULT_FOV } from '../config/constants';
import type { Quality } from '../core/GameState';
import { Post } from './Post';

const QUALITY: Record<Quality, { pixelRatio: number; shadow: number }> = {
  low: { pixelRatio: 1, shadow: 512 },
  medium: { pixelRatio: 1.5, shadow: 1024 },
  high: { pixelRatio: 2, shadow: 2048 },
};

/** WebGLRenderer + camera chính + scene riêng cho vật đang cầm (không xuyên tường). */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly heldScene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly heldCamera: THREE.PerspectiveCamera;
  readonly post: Post;
  quality: Quality = 'medium';
  private shadowLights: THREE.DirectionalLight[] = [];

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.05, 200);
    this.heldCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.01, 10);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.35;
    this.heldScene.environment = env;
    this.heldScene.environmentIntensity = 0.7;
    this.heldScene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0.5, 2, 1);
    this.heldScene.add(key);
    this.post = new Post(this.renderer, this.scene, this.heldScene, this.camera, this.heldCamera);
    window.addEventListener('resize', this.resize);
    this.setQuality('medium');
  }

  /** Thay môi trường sinh bằng code bằng HDRI thật (PMREM). */
  setEnvironment(env: THREE.Texture, intensity = 0.55): void {
    this.scene.environment = env;
    this.scene.environmentIntensity = intensity;
    this.heldScene.environment = env;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  registerShadowLight(l: THREE.DirectionalLight): void {
    this.shadowLights.push(l);
    this.applyShadowSize();
  }

  private applyShadowSize(): void {
    const s = QUALITY[this.quality].shadow;
    for (const l of this.shadowLights) {
      if (l.shadow.mapSize.x === s) continue;
      l.shadow.mapSize.set(s, s);
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.post.setQuality(q);
    this.applyShadowSize();
    this.resize();
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.heldCamera.fov = fov;
    this.heldCamera.updateProjectionMatrix();
  }

  resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].pixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, pr);
    for (const c of [this.camera, this.heldCamera]) {
      c.aspect = w / h;
      c.updateProjectionMatrix();
    }
  };

  render(dt: number): void {
    this.heldCamera.quaternion.copy(this.camera.quaternion);
    this.heldCamera.position.set(0, 0, 0);
    this.post.render(dt);
  }

  get info(): THREE.WebGLInfo {
    return this.renderer.info;
  }
}
