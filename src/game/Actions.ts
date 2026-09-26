import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getFurniture } from '../config/furniture';
import type { BoxData } from '../core/GameState';
import { BOX_D, BOX_H, BoxModel } from '../entities/Box';
import { productMesh } from '../products/PackagingFactory';
import { itemPosition } from '../systems/SlotLayout';
import { getProduct } from '../config/products';
import type { GameCtx } from './Ctx';

/** Hành động của người chơi với thùng hàng & kệ. */
export class Actions {
  private placeCooldown = 0;
  private pendingFlies = 0;

  constructor(private c: GameCtx) {}

  get heldBox(): BoxData | null {
    return this.c.held.box;
  }

  pickUp(uid: string): void {
    const c = this.c;
    const b = c.s.state.box(uid);
    if (!b || this.heldBox) return;
    if (b.location === 'rack' && b.holderId) {
      const rack = c.s.state.furniture(b.holderId);
      if (rack) c.s.inventory.takeFromRack(rack, b.uid);
    }
    b.location = 'held';
    b.holderId = 'player';
    c.held.hold(b);
    c.player.carrying = true;
    c.s.bus.emit('boxes:changed', {});
    c.sound('pop');
    c.s.bus.emit('tutorial:done', { step: 'pickup' });
  }

  /** Thả thùng: lên nóc thùng khác (snap) hoặc xuống sàn trước mặt. */
  drop(): void {
    const c = this.c;
    const b = this.heldBox;
    if (!b) return;
    const fwd = c.player.forward;
    let x = c.player.x + fwd.x * 0.75;
    let z = c.player.z + fwd.z * 0.75;
    const t = c.interaction.target;
    if (t.kind === 'box' && t.uid) {
      const other = c.s.state.box(t.uid);
      if (other && other.location === 'floor') {
        x = other.gx;
        z = other.gy;
      }
    }
    // không thả xuyên tường: lùi về gần người chơi nếu vị trí thả nằm trong vật cản
    const blocked = (px: number, pz: number) => c.furniture.colliders().concat(c.store.colliders())
      .some((a) => px + BOX_D / 2 > a.minX && px - BOX_D / 2 < a.maxX && pz + BOX_D / 2 > a.minZ && pz - BOX_D / 2 < a.maxZ);
    if (blocked(x, z)) {
      x = c.player.x + fwd.x * 0.35;
      z = c.player.z + fwd.z * 0.35;
    }
    b.location = 'floor';
    b.holderId = null;
    b.pose = undefined;
    b.gx = Math.round(x * 100) / 100;
    b.gy = Math.round(z * 100) / 100;
    c.held.hold(null);
    c.player.carrying = false;
    c.s.bus.emit('boxes:changed', {});
    // rơi thật từ tầm tay (hoặc thả lên nóc thùng đang nhìn)
    const onTop = t.kind === 'box' && t.uid ? c.boxes.stackTop(x, z, b.uid) : null;
    const from = new THREE.Vector3(x, onTop ? onTop.y + BOX_H / 2 + 0.05 : 1.0, z);
    c.physics.launch(b.uid, from, onTop ? new THREE.Vector3() : fwd.clone().setY(0).normalize());
    c.boxes.update(0);
    c.sound('thud', new THREE.Vector3(x, 0.1, z));
  }

  toggleOpen(uid?: string): void {
    const c = this.c;
    const b = uid ? c.s.state.box(uid) : this.heldBox;
    if (!b) return;
    b.open = !b.open;
    c.held.refresh();
    c.s.bus.emit('boxes:changed', {});
    c.sound('paper');
  }

  /** Đặt 1 món từ thùng lên slot đang nhìn (món bay vào vị trí kế tiếp). */
  place(furnUid: string, slot: number): void {
    const c = this.c;
    const b = this.heldBox;
    const f = c.s.state.furniture(furnUid);
    if (!b || !f || this.placeCooldown > 0) return;
    const r = c.s.inventory.stock(b, f, slot);
    if (!r.ok) {
      c.toast(r.reason, 'error');
      c.sound('error');
      this.placeCooldown = 0.4;
      return;
    }
    this.placeCooldown = FEEL.placeRepeatS;
    const def = getFurniture(f.type);
    const p = getProduct(b.productId);
    const i = f.slots[slot].qty - 1;
    const view = c.furniture.get(f.uid)!;
    const lp = itemPosition(def, slot, p, i);
    const to = new THREE.Vector3(lp.x, lp.y, lp.z).applyMatrix4(view.root.matrix);
    const from = c.held.mouthWorld(c.camera);
    const mesh = productMesh(p.id);
    const q = new THREE.Quaternion().setFromRotationMatrix(view.root.matrix);
    mesh.quaternion.copy(c.camera.quaternion);
    c.products.hold(f.uid, slot, 1);
    this.pendingFlies++;
    c.effects.fly(mesh, from, to, {
      dur: FEEL.placeTweenS, arc: 0.06, quatTo: q, wobble: FEEL.placeWobble,
      onDone: () => {
        this.pendingFlies--;
        c.products.hold(f.uid, slot, -1);
      },
    });
    setTimeout(() => {
      c.sound('tock', to, 1 + (Math.random() * 2 - 1) * FEEL.placePitchJitter);
      view.shake();
    }, FEEL.placeTweenS * 1000);
    c.held.refresh();
    c.s.bus.emit('tutorial:done', { step: 'stock' });
  }

  /** Lấy lại 1 món từ slot về thùng (chuột phải). */
  takeBack(furnUid: string, slot: number): void {
    const c = this.c;
    const b = this.heldBox;
    const f = c.s.state.furniture(furnUid);
    if (!b || !f || this.placeCooldown > 0) return;
    const before = f.slots[slot]?.qty ?? 0;
    const productId = f.slots[slot]?.productId;
    const r = c.s.inventory.takeBack(b, f, slot);
    if (!r.ok || !productId) {
      if (!r.ok) c.toast(r.reason, 'error');
      c.sound('error');
      this.placeCooldown = 0.4;
      return;
    }
    this.placeCooldown = FEEL.placeRepeatS;
    const def = getFurniture(f.type);
    const view = c.furniture.get(f.uid)!;
    const lp = itemPosition(def, slot, getProduct(productId), before - 1);
    const from = new THREE.Vector3(lp.x, lp.y, lp.z).applyMatrix4(view.root.matrix);
    c.effects.fly(productMesh(productId), from, c.held.mouthWorld(c.camera), { dur: FEEL.placeTweenS * 1.3, arc: 0.1 });
    c.sound('tock', from, 0.85);
    c.held.refresh();
  }

  /** Gập thùng rỗng rồi vứt vào thùng rác. */
  trash(trashUid: string): void {
    const c = this.c;
    const b = this.heldBox;
    const t = c.s.state.furniture(trashUid);
    if (!b || !t) return;
    if (b.qty > 0) {
      c.toast('Thùng vẫn còn hàng, không thể vứt', 'error');
      c.sound('error');
      return;
    }
    const view = c.furniture.get(trashUid)!;
    const to = view.toWorld(new THREE.Vector3(0, 0.75, 0));
    const model = new BoxModel(b.productId);
    model.fold();
    model.group.scale.setScalar(0.6);
    c.effects.fly(model.group, c.held.mouthWorld(c.camera), to, {
      dur: 0.45, arc: 0.35, tick: (dt) => model.update(dt),
      onDone: () => c.sound('thud', to, 1.3),
    });
    c.s.inventory.removeBox(b.uid);
    c.held.hold(null);
    c.player.carrying = false;
    c.sound('fold');
  }

  putOnRack(rackUid: string): void {
    const c = this.c;
    const b = this.heldBox;
    const rack = c.s.state.furniture(rackUid);
    if (!b || !rack) return;
    const r = c.s.inventory.putOnRack(b, rack);
    if (!r.ok) {
      c.toast(r.reason, 'error');
      return;
    }
    c.held.hold(null);
    c.player.carrying = false;
    c.sound('thud');
  }

  takeFromRack(rackUid: string): void {
    const rack = this.c.s.state.furniture(rackUid);
    const uid = rack?.boxes[rack.boxes.length - 1];
    if (uid) this.pickUp(uid);
  }

  update(dt: number): void {
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
  }

  get flying(): number {
    return this.pendingFlies;
  }
}

