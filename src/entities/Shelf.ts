import * as THREE from 'three';
import { getFurniture, type FurnitureDef } from '../config/furniture';
import { getProduct } from '../config/products';
import type { FurnitureData } from '../core/GameState';
import type { Assets } from '../engine/Assets';
import { normalizeModel } from '../engine/Assets';
import { FEEL } from '../config/feel';
import { slotBox } from '../systems/SlotLayout';
import { furnitureMatrix } from '../world/Placement';
import { buildCounter, type CounterParts } from './CheckoutCounter';
import { buildFurnitureModel } from './FurnitureModels';
import { drawLcd } from '../game/CheckoutProps';

export interface PriceInfo {
  price: number;
  market: number;
  cost: number;
}

const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const unit = new THREE.BoxGeometry(1, 1, 1);

/** Hiển thị 1 món nội thất: model, vùng raycast (cả khối + từng slot), nhãn giá 3D. */
export class FurnitureView {
  readonly def: FurnitureDef;
  readonly root = new THREE.Group();
  readonly model: THREE.Group;
  readonly hit: THREE.Mesh;
  readonly slotHits: THREE.Mesh[] = [];
  readonly tags: THREE.Mesh[] = [];
  private tagCanvases: HTMLCanvasElement[] = [];
  private tagKeys: string[] = [];
  counter: CounterParts | null = null;
  screen: THREE.Mesh | null = null;
  private shakeT = 0;
  private flips = new Map<number, number>();

  constructor(public data: FurnitureData, assets: Assets | null, private priceInfo: (productId: string) => PriceInfo) {
    this.def = getFurniture(data.type);
    const def = this.def;
    if (def.kind === 'checkout') {
      this.counter = buildCounter(def);
      this.model = this.counter.group;
      drawLcd(this.counter.lcd.canvas, ['MINI MART', 'Xin chào quý khách'], 0);
      this.counter.lcd.tex.needsUpdate = true;
    } else {
      const glb = assets?.model(def.model);
      if (glb) this.model = normalizeModel(glb, def.size);
      else {
        const b = buildFurnitureModel(def);
        this.model = b.group;
        this.screen = b.screen ?? null;
      }
    }
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o.userData.kind)) o.userData.owner = data.uid;
    });
    this.root.add(this.model);
    this.hit = new THREE.Mesh(unit, hitMat);
    const bb = new THREE.Box3().setFromObject(this.model);
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    this.hit.scale.set(Math.max(size.x, 0.2), Math.max(size.y, 0.2), Math.max(size.z, 0.2));
    this.hit.position.copy(center);
    this.hit.userData = { kind: 'furniture', uid: data.uid };
    // kệ trưng bày: raycast vào từng slot / nhãn giá / model, không dùng hộp bao (sẽ che slot)
    if (def.kind !== 'display') this.root.add(this.hit);
    if (def.kind === 'display') this.buildSlots();
    this.refresh();
  }

  private buildSlots(): void {
    const def = this.def;
    for (let i = 0; i < def.slots; i++) {
      const b = slotBox(def, i);
      const hit = new THREE.Mesh(unit, hitMat);
      hit.scale.set(b.width, Math.max(0.05, b.height - 0.01), b.depth);
      hit.position.set(b.x0 + b.width / 2, b.y + b.height / 2, b.zFront + b.depth / 2);
      hit.userData = { kind: 'slot', uid: this.data.uid, slot: i };
      this.root.add(hit);
      this.slotHits.push(hit);
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      const freezer = def.storage === 'freezer';
      tag.position.set(b.x0 + b.width / 2, freezer ? def.size.h * 0.6 : b.y - 0.025, (freezer ? -def.size.d / 2 : b.zFront) - 0.012);
      tag.rotation.y = Math.PI;
      tag.userData = { kind: 'tag', uid: this.data.uid, slot: i };
      this.root.add(tag);
      this.tags.push(tag);
      this.tagCanvases.push(canvas);
      this.tagKeys.push('');
    }
  }

  /** Cập nhật vị trí (sau khi di chuyển) và nhãn giá. */
  refresh(): void {
    this.root.matrixAutoUpdate = false;
    this.root.matrix.copy(furnitureMatrix(this.data));
    this.root.updateMatrixWorld(true);
    this.updateTags();
  }

  updateTags(): void {
    this.data.slots.forEach((s, i) => {
      const tag = this.tags[i];
      if (!tag) return;
      if (!s.productId) {
        tag.visible = false;
        return;
      }
      tag.visible = true;
      const info = this.priceInfo(s.productId);
      const key = `${s.productId}:${info.price}:${info.market}:${s.qty > 0}`;
      if (key === this.tagKeys[i]) return;
      const changed = this.tagKeys[i] !== '' && this.tagKeys[i].split(':')[1] !== String(info.price);
      this.tagKeys[i] = key;
      const loss = info.price < info.cost;
      const high = info.price > info.market * 1.2;
      const g = this.tagCanvases[i].getContext('2d')!;
      g.fillStyle = loss ? '#e63946' : high ? '#ffd166' : '#ffffff';
      g.fillRect(0, 0, 128, 64);
      g.fillStyle = loss ? '#ffffff' : '#1f2937';
      g.font = '900 34px "Nunito", Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`$${info.price.toFixed(2)}`, 64, 26);
      g.font = '700 14px "Nunito", Arial';
      g.fillText(getProduct(s.productId).name, 64, 52);
      g.fillStyle = '#2a9d8f';
      g.fillRect(0, 0, 6, 64);
      ((tag.material as THREE.MeshStandardMaterial).map as THREE.CanvasTexture).needsUpdate = true;
      if (changed) this.flips.set(i, 0);
    });
  }

  shake(): void {
    this.shakeT = 0.18;
  }

  /** Hiệu ứng rung kệ & lật nhãn giá. */
  update(dt: number): void {
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.model.position.x = Math.sin(this.shakeT * 90) * 0.004 * (this.shakeT / 0.18);
    }
    for (const [i, t] of this.flips) {
      const nt = t + dt;
      const k = Math.min(1, nt / FEEL.flipTagS);
      this.tags[i].rotation.x = Math.sin(k * Math.PI) * Math.PI * (1 - k) * 2;
      if (k >= 1) {
        this.tags[i].rotation.x = 0;
        this.flips.delete(i);
      } else this.flips.set(i, nt);
    }
    if (this.counter) this.counter.beltTex.offset.x -= dt * 0.15;
  }

  /** Điểm cục bộ → world. */
  toWorld(v: THREE.Vector3): THREE.Vector3 {
    return v.clone().applyMatrix4(this.root.matrix);
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.tags.forEach((t) => {
      const m = t.material as THREE.MeshStandardMaterial;
      m.map?.dispose();
      m.dispose();
    });
  }
}
