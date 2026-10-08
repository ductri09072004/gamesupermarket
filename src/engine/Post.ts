import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_PROFILES } from '../config/quality';
import type { Quality } from '../core/GameState';
import { FEEL } from '../config/feel';

/** Skip sprites and transparent decals in the AO normal buffer. */
class GameGTAOPass extends GTAOPass {
  _overrideVisibility(): void {
    const cache = (this as unknown as { _visibilityCache: THREE.Object3D[] })._visibilityCache;
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      const skip = (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite
        || (!!mat && !Array.isArray(mat) && mat.transparent && !mat.depthWrite);
      if (skip) { o.visible = false; cache.push(o); }
    });
  }
}

/** Allocate only active effects, preserving each quality preset's rendering. */
export class Post {
  readonly outline = { selectedObjects: [] as THREE.Object3D[] };
  private composer: EffectComposer | null = null;
  private outlinePass: OutlinePass | null = null;
  private quality: Quality = 'lite';
  private pixelRatio = 1;
  private width = 1;
  private height = 1;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private heldScene: THREE.Scene,
    private camera: THREE.PerspectiveCamera, private heldCamera: THREE.PerspectiveCamera) {
    const size = renderer.getSize(new THREE.Vector2());
    this.width = size.x; this.height = size.y;
  }

  get renderTarget(): THREE.WebGLRenderTarget | null { return this.composer?.readBuffer ?? null; }

  private clearPipeline(): void {
    if (this.composer) {
      for (const pass of this.composer.passes) pass.dispose();
      this.composer.dispose();
    }
    this.composer = null;
    this.outlinePass = null;
  }

  setQuality(q: Quality): void {
    if (this.quality === q && this.composer) return;
    this.clearPipeline();
    this.quality = q;
    const p = QUALITY_PROFILES[q];
    const size = new THREE.Vector2(this.width, this.height);
    const composer = this.composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (p.gtao) {
      const ao = new GameGTAOPass(this.scene, this.camera, size.x, size.y);
      ao.blendIntensity = 1;
      ao.updateGtaoMaterial({ radius: 0.35 });
      composer.addPass(ao);
    }
    {
      const outline = this.outlinePass = new OutlinePass(size, this.scene, this.camera);
      outline.edgeStrength = 4; outline.edgeThickness = 1.2;
      outline.visibleEdgeColor.set(FEEL.outlineColor); outline.hiddenEdgeColor.set(0x777777);
      composer.addPass(outline);
    }
    const held = new RenderPass(this.heldScene, this.heldCamera);
    held.clear = false; held.clearDepth = true;
    composer.addPass(held);
    if (p.bloom) composer.addPass(new UnrealBloomPass(size, 0.3, 0.35, 1.6));
    composer.addPass(new OutputPass());
    if (p.smaa) composer.addPass(new SMAAPass());
    if (p.fxaa) composer.addPass(new FXAAPass());
    this.setSize(this.width, this.height, this.pixelRatio);
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.width = w; this.height = h; this.pixelRatio = pixelRatio;
    this.composer?.setPixelRatio(pixelRatio);
    this.composer?.setSize(w, h);
  }

  render(dt: number): void {
    const targets = this.outline.selectedObjects;
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = targets;
      this.outlinePass.enabled = targets.length > 0;
    }
    this.composer?.render(dt);
  }
}
