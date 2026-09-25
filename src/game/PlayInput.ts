import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import type { World } from './World';

export interface PlayUiHooks {
  openPc(app?: string): void;
  openPrice(uid: string, slot?: number): void;
  isUiOpen(): boolean;
}

/** Phím & chuột khi đang đi lại trong cửa hàng; gợi ý phím dưới tâm ngắm. */
export class PlayInput {
  constructor(private w: World, private ui: PlayUiHooks) {}

  private get holding() {
    return this.w.held.box;
  }

  onKey(e: KeyboardEvent): void {
    const w = this.w;
    if (w.mode !== 'play' || this.ui.isUiOpen()) return;
    switch (e.code) {
      case 'KeyE': if (!e.repeat) this.interact(); break;
      case 'KeyF': {
        const t = w.interaction.target;
        if (this.holding) w.actions.toggleOpen();
        else if (t.kind === 'box' && t.uid) w.actions.toggleOpen(t.uid);
        break;
      }
      case 'KeyQ': w.actions.drop(); break;
      case 'Tab': e.preventDefault(); this.ui.openPc('pricing'); break;
      case 'KeyB': w.build.toggle(); break;
      case 'Digit1': case 'Digit2': case 'Digit3': w.s.time.setSpeed(Number(e.code.slice(-1))); break;
    }
  }

  interact(): void {
    const w = this.w;
    const t = w.interaction.target;
    const held = this.holding;
    if (t.kind === 'box' && t.uid) {
      if (held) w.toast('Tay đang cầm thùng — nhấn Q để thả xuống', 'error');
      else w.actions.pickUp(t.uid);
      return;
    }
    if (t.kind === 'sign') {
      const d = w.s.data;
      d.storeOpen = !d.storeOpen;
      w.s.bus.emit('store:toggled', { open: d.storeOpen });
      w.sound('click', w.sign.group.position.clone().setY(1.4));
      if (d.storeOpen) w.s.bus.emit('tutorial:done', { step: 'open' });
      return;
    }
    if (!t.uid) return;
    if (t.kind === 'tag' || t.kind === 'slot') {
      this.ui.openPrice(t.uid, t.slot);
      return;
    }
    const f = w.s.state.furniture(t.uid);
    if (!f) return;
    const def = getFurniture(f.type);
    switch (def.kind) {
      case 'display':
        if (!held) this.ui.openPrice(f.uid);
        else w.toast(held.open ? 'Nhìn vào một ngăn kệ và click trái để xếp hàng' : 'Nhấn F để mở thùng trước', 'info');
        break;
      case 'computer': this.useComputer(f.uid); break;
      case 'checkout':
        if (held) w.toast('Hãy đặt thùng xuống (Q) trước khi vào quầy', 'error');
        else w.checkout.enter(f.uid);
        break;
      case 'trash':
        if (held) w.actions.trash(f.uid);
        break;
      case 'rack':
        if (held) w.actions.putOnRack(f.uid);
        else w.actions.takeFromRack(f.uid);
        break;
    }
  }

  /** Camera tween sát vào màn hình máy tính rồi mới mở giao diện PC. */
  useComputer(uid: string, app?: string): void {
    const w = this.w;
    const v = w.furniture.get(uid);
    if (!v || w.mode !== 'play') return;
    w.mode = 'pc';
    w.player.cameraOverride = true;
    w.input.exitLock();
    const h = v.def.size.h;
    w.tween.go(v.toWorld(new THREE.Vector3(0, h + 0.3, -0.42)), v.toWorld(new THREE.Vector3(0, h + 0.29, 0.1)), FEEL.cameraTweenS, () => this.ui.openPc(app));
    w.s.bus.emit('tutorial:done', { step: 'pc' });
  }

  /** Quay camera về mắt người chơi (sau khi đóng máy tính). */
  returnCamera(done?: () => void): void {
    const w = this.w;
    const eye = new THREE.Vector3(w.player.x, w.player.eye, w.player.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.player.pitch, w.player.yaw, 0, 'YXZ'));
    w.tween.goTo(eye, q, FEEL.cameraTweenS * 0.8, () => {
      w.player.cameraOverride = false;
      w.mode = 'play';
      done?.();
    });
  }

  hints(): string[] {
    const w = this.w;
    const t = w.interaction.target;
    const held = this.holding;
    const out: string[] = [];
    switch (t.kind) {
      case 'box': {
        const b = t.uid ? w.s.state.box(t.uid) : undefined;
        if (b) out.push(held ? 'Tay đang bận' : `<kbd>E</kbd> Nhặt thùng ${getProduct(b.productId).name} ×${b.qty}`);
        if (b && !held) out.push(`<kbd>F</kbd> ${b.open ? 'Đóng' : 'Mở'} thùng`);
        break;
      }
      case 'sign': out.push(`<kbd>E</kbd> ${w.s.data.storeOpen ? 'Đóng cửa' : 'Mở cửa'}`); break;
      case 'tag': out.push('<kbd>E</kbd> Đặt giá (súng dán giá)'); break;
      case 'slot':
        if (held && held.open) out.push('<kbd>Chuột trái</kbd> Xếp hàng (giữ để xếp liên tục)', '<kbd>Chuột phải</kbd> Lấy lại vào thùng');
        else if (held) out.push('<kbd>F</kbd> Mở thùng để xếp hàng');
        out.push('<kbd>E</kbd> Đặt giá');
        break;
      case 'furniture': {
        const f = t.uid ? w.s.state.furniture(t.uid) : undefined;
        if (!f) break;
        const def = getFurniture(f.type);
        if (def.kind === 'computer') out.push('<kbd>E</kbd> Dùng máy tính');
        if (def.kind === 'checkout') out.push(held ? 'Đặt thùng xuống trước (Q)' : '<kbd>E</kbd> Vào quầy thu ngân');
        if (def.kind === 'trash' && held) out.push(held.qty === 0 ? '<kbd>E</kbd> Gập & vứt thùng rỗng' : 'Thùng còn hàng!');
        if (def.kind === 'rack') out.push(held ? '<kbd>E</kbd> Cất thùng lên kệ kho' : f.boxes.length ? '<kbd>E</kbd> Lấy thùng' : 'Kệ kho trống');
        if (def.kind === 'display' && !held) out.push(`<kbd>E</kbd> Đặt giá ${def.name}`);
        break;
      }
    }
    if (held) out.push(`<span class="muted">${getProduct(held.productId).name} ×${held.qty} · <kbd>F</kbd> ${held.open ? 'đóng' : 'mở'} · <kbd>Q</kbd> thả</span>`);
    return out;
  }
}
