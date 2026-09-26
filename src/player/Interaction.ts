import * as THREE from 'three';
import { REACH } from '../config/constants';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { Services } from '../core/Services';
import type { FurnitureView } from '../entities/Shelf';
import { canStockSlot } from '../systems/InventorySystem';
import { itemLayout, itemPosition, slotBox } from '../systems/SlotLayout';
import { packaging } from '../products/PackagingFactory';

export type TargetKind = 'slot' | 'tag' | 'furniture' | 'box' | 'sign' | 'switch' | 'vehicle' | 'kiosk' | 'dirt' | 'loose' | 'thief' | 'crate' | 'none';

export interface Target {
  kind: TargetKind;
  uid: string | null;
  slot: number;
  object: THREE.Object3D | null;
  point: THREE.Vector3 | null;
  distance: number;
}

const NONE: Target = { kind: 'none', uid: null, slot: -1, object: null, point: null, distance: Infinity };

/** Raycast từ tâm màn hình; tìm vật tương tác trong tầm với. */
export class Interaction {
  private ray = new THREE.Raycaster();
  target: Target = NONE;
  private frame: THREE.LineSegments;
  private ghost: THREE.Mesh | null = null;
  private ghostKey = '';
  private ghostMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  roots: THREE.Object3D[] = [];
  enabled = true;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private s: Services) {
    this.ray.far = REACH + 0.6;
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.frame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    this.frame.visible = false;
    scene.add(this.frame);
  }

  private resolve(hit: THREE.Intersection): Target | null {
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const u = o.userData as { kind?: string; uid?: string; slot?: number; owner?: string };
      if (u.kind === 'slot' || u.kind === 'tag') return { kind: u.kind, uid: u.uid!, slot: u.slot!, object: hit.object, point: hit.point, distance: hit.distance };
      if (u.kind === 'furniture') return { kind: 'furniture', uid: u.uid!, slot: -1, object: hit.object, point: hit.point, distance: hit.distance };
      if (u.kind === 'box') return { kind: 'box', uid: u.uid!, slot: -1, object: o, point: hit.point, distance: hit.distance };
      if (u.kind === 'sign') return { kind: 'sign', uid: null, slot: -1, object: o, point: hit.point, distance: hit.distance };
      if (u.kind === 'switch') return { kind: 'switch', uid: null, slot: -1, object: o.parent ?? o, point: hit.point, distance: hit.distance };
      if (u.kind === 'vehicle') return { kind: 'vehicle', uid: u.uid!, slot: -1, object: o, point: hit.point, distance: hit.distance };
      if (u.kind === 'kiosk') return { kind: 'kiosk', uid: null, slot: -1, object: o, point: hit.point, distance: hit.distance };
      if (u.kind === 'dirt' || u.kind === 'loose' || u.kind === 'thief' || u.kind === 'crate') return { kind: u.kind, uid: u.uid!, slot: -1, object: o, point: hit.point, distance: hit.distance };
      if (u.owner) return { kind: 'furniture', uid: u.owner, slot: -1, object: hit.object, point: hit.point, distance: hit.distance };
      o = o.parent;
    }
    return null;
  }

  /** Raycast từ camera qua điểm màn hình (NDC). Mặc định tâm màn hình. */
  pick(ndc = new THREE.Vector2(0, 0), far = REACH): Target {
    this.camera.updateMatrixWorld();
    for (const r of this.roots) r.updateMatrixWorld();
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.far = far + 0.6;
    const hits = this.ray.intersectObjects(this.roots, true);
    let first: Target | null = null;
    for (const h of hits) {
      const t = this.resolve(h);
      if (!t) continue;
      if (!first) {
        if (t.distance > far) return NONE;
        first = t;
        if (t.kind === 'tag') return t;
        continue;
      }
      // ưu tiên nhãn giá / slot nằm ngay sau (thanh ray, mép kệ che một chút)
      if (t.distance - first.distance > 0.35) break;
      if (t.kind === 'tag' || (t.kind === 'slot' && first.kind !== 'slot')) return t;
    }
    return first ?? NONE;
  }

  update(heldProduct: string | null, heldOpen: boolean, views: (uid: string) => FurnitureView | undefined): void {
    this.target = this.enabled ? this.pick() : NONE;
    const t = this.target;
    this.frame.visible = false;
    if (this.ghost) this.ghost.visible = false;
    if (!this.enabled || t.kind !== 'slot' || !t.uid || !heldProduct || !heldOpen) return;
    const v = views(t.uid);
    const f = this.s.state.furniture(t.uid);
    if (!v || !f) return;
    const def = getFurniture(f.type);
    const b = slotBox(def, t.slot);
    const ok = canStockSlot(f, t.slot, heldProduct).ok;
    this.frame.visible = true;
    (this.frame.material as THREE.LineBasicMaterial).color.set(ok ? 0xffffff : 0xff4d4d);
    const c = new THREE.Vector3(b.x0 + b.width / 2, b.y + b.height / 2, b.zFront + b.depth / 2).applyMatrix4(v.root.matrix);
    this.frame.position.copy(c);
    this.frame.quaternion.setFromRotationMatrix(v.root.matrix);
    this.frame.scale.set(b.width, b.height, b.depth);
    if (!ok) return;
    const p = getProduct(heldProduct);
    const slot = f.slots[t.slot];
    const next = slot.productId === heldProduct ? slot.qty : 0;
    if (next >= itemLayout(def, p).capacity) return;
    if (this.ghostKey !== heldProduct) {
      this.ghost?.removeFromParent();
      this.ghost = new THREE.Mesh(packaging(heldProduct).geometry, this.ghostMat);
      this.scene.add(this.ghost);
      this.ghostKey = heldProduct;
    }
    const lp = itemPosition(def, t.slot, p, next);
    this.ghost!.position.set(lp.x, lp.y, lp.z).applyMatrix4(v.root.matrix);
    this.ghost!.quaternion.setFromRotationMatrix(v.root.matrix);
    this.ghost!.visible = true;
  }

  /** Vật cần viền sáng. */
  outlineTargets(views: (uid: string) => FurnitureView | undefined, boxModel: (uid: string) => THREE.Object3D | undefined): THREE.Object3D[] {
    const t = this.target;
    if (t.kind === 'none') return [];
    if (t.kind === 'box' && t.uid) {
      const b = boxModel(t.uid);
      return b ? [b] : [];
    }
    if ((t.kind === 'sign' || t.kind === 'switch' || t.kind === 'vehicle' || t.kind === 'kiosk' || t.kind === 'dirt' || t.kind === 'loose' || t.kind === 'thief' || t.kind === 'crate') && t.object) return [t.object];
    if (t.kind === 'tag' && t.object) return [t.object];
    if (t.kind === 'slot' && this.frame.visible) return [];
    const v = t.uid ? views(t.uid) : undefined;
    return v ? [v.model] : [];
  }

  hide(): void {
    this.frame.visible = false;
    if (this.ghost) this.ghost.visible = false;
  }
}
