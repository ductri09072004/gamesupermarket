import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  class Pass {
    enabled = true;
    dispose = vi.fn();
    visibleEdgeColor = { set: vi.fn() };
    hiddenEdgeColor = { set: vi.fn() };
    selectedObjects: unknown[] = [];
    updateGtaoMaterial = vi.fn();
  }
  class Composer {
    static instances: Composer[] = [];
    passes: Pass[] = [];
    readBuffer = {};
    dispose = vi.fn();
    render = vi.fn();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    constructor() { Composer.instances.push(this); }
    addPass(pass: Pass) { this.passes.push(pass); }
  }
  return { Pass, Composer, ao: vi.fn(), bloom: vi.fn(), smaa: vi.fn() };
});
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({ EffectComposer: fake.Composer }));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({ RenderPass: fake.Pass }));
vi.mock('three/addons/postprocessing/OutlinePass.js', () => ({ OutlinePass: fake.Pass }));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({ OutputPass: fake.Pass }));
vi.mock('three/addons/postprocessing/FXAAPass.js', () => ({ FXAAPass: fake.Pass }));
vi.mock('three/addons/postprocessing/GTAOPass.js', () => ({ GTAOPass: class extends fake.Pass { constructor() { super(); fake.ao(); } } }));
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({ UnrealBloomPass: class extends fake.Pass { constructor() { super(); fake.bloom(); } } }));
vi.mock('three/addons/postprocessing/SMAAPass.js', () => ({ SMAAPass: class extends fake.Pass { constructor() { super(); fake.smaa(); } } }));
import { Post } from '../src/engine/Post';

describe('postprocessing lifetime', () => {
  it('keeps SMAA and selection outlines in lite without allocating disabled AO/bloom', () => {
    vi.clearAllMocks();
    const renderer = { getSize: (v: THREE.Vector2) => v.set(800, 600) } as THREE.WebGLRenderer;
    const post = new Post(renderer, new THREE.Scene(), new THREE.Scene(), new THREE.PerspectiveCamera(), new THREE.PerspectiveCamera());
    post.setQuality('lite');
    const pipeline = fake.Composer.instances[fake.Composer.instances.length - 1];
    expect(fake.ao).not.toHaveBeenCalled(); expect(fake.bloom).not.toHaveBeenCalled();
    expect(fake.smaa).toHaveBeenCalledOnce();
    post.render(1 / 60);
    expect(pipeline.passes[1].enabled).toBe(false);
    const selected = new THREE.Object3D(); post.outline.selectedObjects = [selected];
    post.render(1 / 60);
    expect(pipeline.passes[1].enabled).toBe(true);
    expect(pipeline.passes[1].selectedObjects).toEqual([selected]);
    post.setQuality('high');
    expect(pipeline.dispose).toHaveBeenCalledOnce();
    for (const pass of pipeline.passes) expect(pass.dispose).toHaveBeenCalledOnce();
    expect(fake.ao).toHaveBeenCalledOnce(); expect(fake.bloom).toHaveBeenCalledOnce();
    const high = fake.Composer.instances[fake.Composer.instances.length - 1];
    post.setQuality('lite');
    expect(high.dispose).toHaveBeenCalledOnce();
    for (const pass of high.passes) expect(pass.dispose).toHaveBeenCalledOnce();
    const count = fake.Composer.instances.length;
    post.setQuality('lite');
    expect(fake.Composer.instances).toHaveLength(count);
  });
});
