import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Quality } from '../core/GameState';
import { FEEL } from '../config/feel';

/**
 * GTAO bỏ qua thêm sprite (bong bóng, số tiền nổi) và mesh trong suốt không ghi depth (kính, bóng giả):
 * mặc định chúng bị vẽ vào G-buffer pháp tuyến như bề mặt đặc → AO làm chúng thành mảng đen.
 */
class GameGTAOPass extends GTAOPass {
  _overrideVisibility(): void {
    const cache = (this as unknown as { _visibilityCache: THREE.Object3D[] })._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      const skip = (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite
        || (!!mat && !Array.isArray(mat) && mat.transparent && !mat.depthWrite);
      if (skip) {
        o.visible = false;
        cache.push(o);
      }
    });
  }
}

/** EffectComposer: cảnh chính → (AO) → viền vật đang nhìn → vật đang cầm → bloom → AA → output. */
export class Post {
  readonly composer: EffectComposer;
  readonly outline: OutlinePass;
  private bloom: UnrealBloomPass;
  private smaa: SMAAPass;
  private fxaa: FXAAPass;
  private gtao: GTAOPass;
  private heldPass: RenderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, heldScene: THREE.Scene, camera: THREE.PerspectiveCamera, heldCamera: THREE.PerspectiveCamera) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GameGTAOPass(scene, camera, size.x, size.y);
    this.gtao.blendIntensity = 1;
    // bán kính ~ khoảng hở giữa các tầng kệ để lòng kệ, gầm quầy, góc tường tối lại
    this.gtao.updateGtaoMaterial({ radius: 0.35 });
    this.composer.addPass(this.gtao);
    this.outline = new OutlinePass(size.clone(), scene, camera);
    this.outline.edgeStrength = 4;
    this.outline.edgeThickness = 1.2;
    this.outline.edgeGlow = 0;
    this.outline.visibleEdgeColor.set(FEEL.outlineColor);
    this.outline.hiddenEdgeColor.set(0x777777);
    this.composer.addPass(this.outline);
    this.heldPass = new RenderPass(heldScene, heldCamera);
    this.heldPass.clear = false;
    this.heldPass.clearDepth = true;
    this.composer.addPass(this.heldPass);
    this.bloom = new UnrealBloomPass(size.clone(), 0.3, 0.35, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
    this.fxaa = new FXAAPass();
    this.composer.addPass(this.fxaa);
  }

  setQuality(q: Quality): void {
    this.gtao.enabled = q === 'high';
    this.bloom.enabled = q !== 'low';
    this.smaa.enabled = q !== 'low';
    this.fxaa.enabled = q === 'low';
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
