import * as THREE from 'three';
import { PRODUCTS } from '../config/products';
import { h, uiRoot } from '../ui/dom';
import { eanFromId } from './Ean13';
import { productMesh } from './PackagingFactory';

/** Trang xem sản phẩm (F4): bục xoay, đèn studio, mũi tên chuyển sản phẩm. */
export class Gallery {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  private pedestal = new THREE.Group();
  private current: THREE.Mesh | null = null;
  private index = 0;
  private ui: HTMLElement | null = null;
  private info: HTMLElement | null = null;
  active = false;
  private onKey = (e: KeyboardEvent) => {
    if (!this.active) return;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.show(this.index + 1);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.show(this.index - 1);
  };

  constructor(env: THREE.Texture | null) {
    this.scene.background = new THREE.Color(0x2b2d42);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.8;
    const key = new THREE.SpotLight(0xffffff, 30, 10, 0.5, 0.4);
    key.position.set(1.2, 2, -1.5);
    const rim = new THREE.DirectionalLight(0x9ec5ff, 1.5);
    rim.position.set(-2, 1.5, 2);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.3));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 48), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 }));
    base.position.y = -0.03;
    this.pedestal.add(base);
    this.scene.add(this.pedestal);
    this.camera.position.set(0, 0.22, -0.75);
    this.camera.lookAt(0, 0.1, 0);
    window.addEventListener('keydown', this.onKey);
  }

  open(): void {
    this.active = true;
    this.info = h('div', { class: 'gal-info' });
    this.ui = h('div', { class: 'gallery-ui' }, [
      h('button', { class: 'btn big', text: '◀', onClick: () => this.show(this.index - 1) }),
      this.info,
      h('button', { class: 'btn big', text: '▶', onClick: () => this.show(this.index + 1) }),
      h('button', { class: 'btn small gal-close', text: 'Đóng (F4)', onClick: () => this.onClose() }),
    ]);
    uiRoot().append(this.ui);
    uiRoot().classList.add('gallery-open');
    this.show(this.index);
  }

  onClose: () => void = () => {};

  close(): void {
    this.active = false;
    this.ui?.remove();
    this.ui = null;
    uiRoot().classList.remove('gallery-open');
  }

  show(i: number): void {
    this.index = (i + PRODUCTS.length) % PRODUCTS.length;
    const p = PRODUCTS[this.index];
    this.current?.removeFromParent();
    this.current = productMesh(p.id);
    const s = 0.22 / Math.max(...p.size);
    this.current.scale.setScalar(s);
    this.pedestal.add(this.current);
    if (this.info) {
      this.info.innerHTML = `<b>${p.brand}</b> — ${p.name} <span class="muted">(${p.volumeText})</span><br>
        <span class="muted small">${p.shape} · ${p.size.map((v) => `${Math.round(v * 100)}cm`).join(' × ')} · EAN ${eanFromId(p.id)} · ${this.index + 1}/${PRODUCTS.length}</span>`;
    }
  }

  render(renderer: THREE.WebGLRenderer, dt: number): void {
    this.pedestal.rotation.y += dt * 0.6;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    renderer.render(this.scene, this.camera);
  }
}
