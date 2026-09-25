import * as THREE from 'three';
import { getProduct } from '../config/products';
import { textCanvas } from '../products/LabelTexture';
import { packaging } from '../products/PackagingFactory';

export const BOX_W = 0.46;
export const BOX_H = 0.3;
export const BOX_D = 0.36;

const cardboard = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.92 });
const cardboardIn = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95, side: THREE.DoubleSide });
const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe8d7b0, roughness: 0.4, transparent: true, opacity: 0.9 });
const labelMats = new Map<string, THREE.MeshStandardMaterial>();

function labelMat(productId: string): THREE.MeshStandardMaterial {
  let m = labelMats.get(productId);
  if (m) return m;
  const p = getProduct(productId);
  const tex = textCanvas(256, 160, (g) => {
    g.fillStyle = '#c89b6d';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#ffffff';
    g.fillRect(14, 14, 228, 132);
    g.fillStyle = p.label.bg;
    g.fillRect(14, 14, 228, 34);
    g.fillStyle = p.label.text;
    g.font = '900 22px "Nunito", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(p.brand.toUpperCase(), 128, 32);
    g.fillStyle = '#1f2937';
    g.font = '48px serif';
    g.fillText(p.icon, 60, 96);
    g.font = '800 22px "Nunito", Arial';
    g.textAlign = 'left';
    g.fillText(p.name, 96, 84);
    g.font = '900 30px "Nunito", Arial';
    g.fillText(`× ${p.unitsPerBox}`, 96, 118);
    g.strokeStyle = '#1f2937';
    g.lineWidth = 2;
    g.strokeRect(14, 14, 228, 132);
  });
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  labelMats.set(productId, m);
  return m;
}

const unit = new THREE.BoxGeometry(1, 1, 1);

/** Thùng carton: 5 mặt + 4 nắp có bản lề, băng keo, nhãn in, hàng bên trong khi mở. */
export class BoxModel {
  readonly group = new THREE.Group();
  private flaps: THREE.Object3D[] = [];
  private contents = new THREE.Group();
  private tape: THREE.Mesh;
  private label: THREE.Mesh[] = [];
  private openT = 0;
  private openTarget = 0;
  private folded = false;
  private contentKey = '';

  constructor(public productId: string) {
    const t = 0.006;
    const W = BOX_W;
    const H = BOX_H;
    const D = BOX_D;
    const face = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const m = new THREE.Mesh(unit, [cardboard, cardboard, cardboard, cardboard, cardboard, cardboard]);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    face(0, t / 2, 0, W, t, D);
    const front = face(0, H / 2, -D / 2 + t / 2, W, H, t);
    const back = face(0, H / 2, D / 2 - t / 2, W, H, t);
    face(-W / 2 + t / 2, H / 2, 0, t, H, D);
    face(W / 2 - t / 2, H / 2, 0, t, H, D);
    for (const f of [front, back]) {
      const lm = labelMat(productId);
      f.material = [cardboard, cardboard, cardboard, cardboard, lm, lm];
      this.label.push(f);
    }
    const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * t, H - t, D - 2 * t), cardboardIn);
    inner.position.y = H / 2 + t / 2;
    inner.scale.set(0.999, 0.999, 0.999);
    (inner.material as THREE.Material).side = THREE.BackSide;
    this.group.add(inner);
    // nắp: dài theo X (2 nắp trước/sau), ngắn theo Z (2 nắp trái/phải)
    const mk = (px: number, pz: number, sx: number, sz: number, axis: 'x' | 'z', sign: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, H, pz);
      const m = new THREE.Mesh(unit, cardboard);
      m.scale.set(sx, t, sz);
      m.position.set(axis === 'z' ? 0 : (sign * sx) / 2, t / 2, axis === 'z' ? (sign * sz) / 2 : 0);
      m.castShadow = true;
      pivot.add(m);
      pivot.userData = { axis, sign };
      this.group.add(pivot);
      this.flaps.push(pivot);
    };
    mk(0, -D / 2, W, D / 2, 'z', 1);
    mk(0, D / 2, W, D / 2, 'z', -1);
    mk(-W / 2, 0, W / 2, D * 0.96, 'x', 1);
    mk(W / 2, 0, W / 2, D * 0.96, 'x', -1);
    this.tape = new THREE.Mesh(unit, tapeMat);
    this.tape.scale.set(0.07, 0.002, D + 0.02);
    this.tape.position.y = H + t + 0.001;
    this.group.add(this.tape, this.contents);
    this.group.traverse((o) => { o.userData.boxModel = true; });
    this.applyOpen();
  }

  setOpen(open: boolean, instant = false): void {
    this.openTarget = open ? 1 : 0;
    if (instant) {
      this.openT = this.openTarget;
      this.applyOpen();
    }
  }

  get isOpenVisual(): boolean {
    return this.openT > 0.5;
  }

  private applyOpen(): void {
    const k = this.openT;
    this.flaps.forEach((p, i) => {
      const { axis, sign } = p.userData as { axis: 'x' | 'z'; sign: number };
      const a = -sign * k * (i < 2 ? 2.1 : 1.95);
      if (axis === 'z') p.rotation.x = -a;
      else p.rotation.z = a;
    });
    this.tape.visible = k < 0.05;
    this.contents.visible = k > 0.3;
  }

  /** Hiển thị hàng bên trong (tối đa vừa lưới trong thùng). */
  setContents(productId: string, qty: number): void {
    const key = `${productId}:${qty}`;
    if (key === this.contentKey) return;
    this.contentKey = key;
    this.contents.clear();
    if (productId !== this.productId) {
      this.productId = productId;
      const lm = labelMat(productId);
      for (const f of this.label) f.material = [cardboard, cardboard, cardboard, cardboard, lm, lm];
    }
    if (qty <= 0) return;
    const p = getProduct(productId);
    const pk = packaging(productId);
    const [pw, ph, pd] = p.size;
    const iw = BOX_W - 0.03;
    const idp = BOX_D - 0.03;
    const s = Math.min(1, (BOX_H - 0.02) / ph, iw / pw, idp / pd);
    const cols = Math.max(1, Math.floor(iw / (pw * s)));
    const rows = Math.max(1, Math.floor(idp / (pd * s)));
    const n = Math.min(qty, cols * rows);
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const m = new THREE.Mesh(pk.geometry, pk.materials);
      m.scale.setScalar(s);
      m.position.set(-iw / 2 + (c + 0.5) * (iw / cols), 0.008 + Math.max(0, BOX_H - 0.02 - ph * s) * 0.6, -idp / 2 + (r + 0.5) * (idp / rows));
      this.contents.add(m);
    }
  }

  /** Gập thùng rỗng (trước khi vứt). */
  fold(): void {
    this.folded = true;
  }

  update(dt: number): void {
    if (this.openT !== this.openTarget) {
      const d = Math.sign(this.openTarget - this.openT) * dt * 5;
      this.openT = Math.abs(this.openTarget - this.openT) < Math.abs(d) ? this.openTarget : this.openT + d;
      this.applyOpen();
    }
    if (this.folded && this.group.scale.y > 0.06) {
      this.group.scale.y = Math.max(0.05, this.group.scale.y - dt * 4);
      this.group.scale.x = Math.min(1.35, this.group.scale.x + dt * 1.2);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}
