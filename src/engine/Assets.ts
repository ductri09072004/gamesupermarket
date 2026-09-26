import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { h, uiRoot } from '../ui/dom';
import { loadPbrTextures, type TextureEntry } from '../world/Materials';
import { registerCharacter } from '../entities/CharacterModels';
import { registerBuildingAtlas, registerCityModel } from '../world/CityModels';
import { registerProp } from './Props';

interface Manifest {
  models?: string[];
  /** HDRI môi trường, ví dụ "hdri/brown_photostudio_02_1k.hdr" */
  hdri?: string;
  /** Bộ texture PBR theo slot vật liệu (floor, wall, concrete...) */
  textures?: Record<string, TextureEntry>;
  /** Nhân vật rig, ví dụ "characters/Casual_Male.glb" (tên file = tên model) */
  characters?: string[];
  /** Model thành phố "city/<Tên>.glb" và atlas màu nhà "textures/buildings/Texture_<Màu>.png" */
  city?: string[];
  cityTextures?: string[];
  /** Đồ vật "props/<tên>.glb" (máy tính tiền, đèn, xe tải...) */
  props?: string[];
}

/**
 * Nạp & cache model/texture. Đọc public/assets/manifest.json để biết file nào có thật
 * (tránh lỗi 404 trên console). Thiếu file → dùng model sinh bằng code.
 */
export class Assets {
  private models = new Map<string, THREE.Group>();
  private manifest: Manifest = {};
  private screen: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private label: HTMLElement | null = null;

  showLoading(): void {
    this.bar = h('div', { class: 'load-fill' });
    this.label = h('div', { class: 'load-label', text: 'Đang tải... 0%' });
    this.screen = h('div', { class: 'loading' }, [
      h('div', { class: 'load-logo', text: '🏪' }),
      h('div', { class: 'load-title', text: 'Mini Mart Tycoon 3D' }),
      h('div', { class: 'load-bar' }, [this.bar]),
      this.label,
    ]);
    uiRoot().append(this.screen);
  }

  progress(p: number, text?: string): void {
    const pct = Math.round(p * 100);
    if (this.bar) this.bar.style.width = `${pct}%`;
    if (this.label) this.label.textContent = `${text ?? 'Đang tải...'} ${pct}%`;
  }

  hideLoading(): void {
    const s = this.screen;
    this.screen = null;
    if (!s) return;
    s.classList.add('hide');
    setTimeout(() => s.remove(), 400);
  }

  /** Chạy các bước tải tuần tự, cập nhật thanh %. */
  async run(tasks: Array<[string, () => Promise<void> | void]>): Promise<void> {
    for (let i = 0; i < tasks.length; i++) {
      const [name, fn] = tasks[i];
      this.progress(i / tasks.length, name);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await fn();
    }
    this.progress(1, 'Sẵn sàng');
  }

  async loadManifest(): Promise<void> {
    try {
      const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
      if (res.ok) this.manifest = (await res.json()) as Manifest;
    } catch {
      this.manifest = {};
    }
    const loader = new GLTFLoader();
    for (const path of this.manifest.models ?? []) {
      try {
        const gltf = await loader.loadAsync(`assets/models/${path}`);
        this.models.set(path.split('/').pop()!, gltf.scene);
      } catch {
        console.warn(`[Assets] Không nạp được model ${path}, dùng placeholder.`);
      }
    }
    if (this.manifest.textures) await loadPbrTextures(this.manifest.textures);
    for (const path of this.manifest.characters ?? []) {
      try {
        const gltf = await loader.loadAsync(`assets/models/${path}`);
        registerCharacter(path.split('/').pop()!.replace(/\.(glb|gltf|json)$/, ''), gltf);
      } catch {
        console.warn(`[Assets] Không nạp được nhân vật ${path}, dùng người khối.`);
      }
    }
    await this.loadCity(loader);
    await Promise.all((this.manifest.props ?? []).map(async (path) => {
      try {
        registerProp(path.split('/').pop()!.replace(/\.(glb|gltf)$/, ''), (await loader.loadAsync(`assets/models/${path}`)).scene);
      } catch {
        console.warn(`[Assets] Không nạp được ${path}, dùng model dựng bằng code.`);
      }
    }));
  }

  private async loadCity(loader: GLTFLoader): Promise<void> {
    const base = (p: string) => p.split('/').pop()!.replace(/\.(glb|gltf|json|png)$/, '');
    await Promise.all((this.manifest.city ?? []).map(async (path) => {
      try {
        registerCityModel(base(path), (await loader.loadAsync(`assets/models/${path}`)).scene);
      } catch {
        console.warn(`[Assets] Không nạp được ${path}, dùng hình khối thay thế.`);
      }
    }));
    const tl = new THREE.TextureLoader();
    await Promise.all((this.manifest.cityTextures ?? []).map(async (path) => {
      try {
        registerBuildingAtlas(base(path).replace('Texture_', ''), await tl.loadAsync(`assets/${path}`));
      } catch {
        console.warn(`[Assets] Không nạp được ${path}`);
      }
    }));
  }

  /** Đường dẫn HDRI (tương đối trang) nếu manifest có. */
  get hdri(): string | null {
    return this.manifest.hdri ? `assets/${this.manifest.hdri}` : null;
  }

  /** Model GLB đã nạp (clone) hoặc null. */
  model(file: string): THREE.Group | null {
    const m = this.models.get(file);
    return m ? m.clone(true) : null;
  }
}

/**
 * Chuẩn hoá model: scale về kích thước thật (w, h, d), gốc ở giữa đáy, mặt trước hướng -Z.
 * `frontYaw` xoay thêm nếu model gốc quay mặt hướng khác.
 */
export function normalizeModel(obj: THREE.Object3D, size: { w: number; d: number; h: number }, frontYaw = 0): THREE.Group {
  const wrap = new THREE.Group();
  obj.rotation.y += frontYaw;
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const dim = box.getSize(new THREE.Vector3());
  const sx = dim.x > 0 ? size.w / dim.x : 1;
  const sy = dim.y > 0 ? size.h / dim.y : 1;
  const sz = dim.z > 0 ? size.d / dim.z : 1;
  obj.scale.multiply(new THREE.Vector3(sx, sy, sz));
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  wrap.add(obj);
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return wrap;
}
