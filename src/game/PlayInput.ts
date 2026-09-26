import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import { getVehicle } from '../config/vehicles';
import { cargoUsed } from '../systems/VehicleSystem';
import type { World } from './World';

/** Gợi ý nút tương tác chính */
export const CLICK = '<kbd>Chuột trái</kbd>';

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
    if (w.mode === 'drive' && !this.ui.isUiOpen()) {
      w.driving.onKey(e);
      return;
    }
    if (w.mode !== 'play' || this.ui.isUiOpen()) return;
    if (w.fp.active) {
      // đang bê nội thất: chỉ xoay / huỷ / đổi tốc độ
      if (e.code === 'KeyR') w.fp.rotate(1);
      else if (e.code === 'KeyQ') w.fp.cancel();
      else if (e.code.startsWith('Digit')) w.s.time.setSpeed(Number(e.code.slice(-1)));
      return;
    }
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
      case 'KeyM': this.moveTarget(); break;
      case 'KeyG': this.unloadVehicle(); break;
      case 'Digit1': case 'Digit2': case 'Digit3': w.s.time.setSpeed(Number(e.code.slice(-1))); break;
    }
  }

  /** Chuột trái = tương tác (E vẫn dùng được). Đang cầm thùng mở nhìn ngăn kệ → để World xếp hàng. */
  onPrimaryClick(): void {
    const w = this.w;
    if (w.mode !== 'play' || this.ui.isUiOpen()) return;
    if (w.fp.active) {
      w.fp.place();
      return;
    }
    const t = w.interaction.target;
    if (t.kind === 'none' || (t.kind === 'slot' && this.holding?.open)) return;
    this.interact();
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
    if (t.kind === 'vehicle' && t.uid) {
      if (held) this.loadVehicle(t.uid);
      else w.driving.enter(t.uid);
      return;
    }
    if (t.kind === 'kiosk') {
      w.mode = 'pc';
      w.player.cameraOverride = true;
      w.input.exitLock();
      this.ui.openPc('wholesale');
      return;
    }
    if (t.kind === 'crate' && t.uid) {
      const crate = w.s.data.crates.find((k) => k.uid === t.uid);
      if (!crate) return;
      if (held) w.toast('Tay đang cầm thùng hàng — nhấn Q để thả xuống trước', 'error');
      else w.fp.startCrate(crate);
      return;
    }
    if (t.kind === 'dirt' && t.uid) {
      w.mess.cleanDirt(t.uid);
      return;
    }
    if (t.kind === 'loose' && t.uid) {
      w.mess.playerPickLoose(t.uid);
      return;
    }
    if (t.kind === 'thief' && t.uid) {
      const thief = w.security.byId(t.uid);
      if (thief) w.security.catchThief(thief, 'player');
      return;
    }
    if (t.kind === 'switch') {
      w.toast(w.lights.toggle() ? '💡 Đã bật đèn cửa hàng' : '🌑 Đã tắt đèn cửa hàng', 'info');
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
      case 'selfcheckout':
        if (w.selfCheckout.assist(f.uid)) w.toast('🤝 Đã hướng dẫn khách — máy chạy tiếp', 'success');
        else w.toast('Máy đang hoạt động bình thường', 'info');
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

  private loadVehicle(uid: string): void {
    const w = this.w;
    const box = this.holding;
    if (!box) return;
    const r = w.s.vehicles.load(uid, box);
    if (!r.ok) {
      w.toast(r.reason ?? 'Không chất được', 'error');
      w.sound('error');
      return;
    }
    w.held.hold(null);
    w.player.carrying = false;
    const v = w.s.vehicles.get(uid)!;
    w.sound('place', new THREE.Vector3(v.x, 1, v.z));
  }

  /** G: lấy 1 thùng từ xe đang nhìn xuống tay. */
  private unloadVehicle(): void {
    const w = this.w;
    const t = w.interaction.target;
    if (t.kind !== 'vehicle' || !t.uid) return;
    if (this.holding) {
      w.toast('Tay đang cầm thùng', 'error');
      return;
    }
    const box = w.s.vehicles.unload(t.uid);
    if (!box) {
      w.toast('Xe không chở thùng nào', 'info');
      return;
    }
    w.actions.pickUp(box.uid);
  }

  /** Dời nội thất đang nhìn (kệ có hàng vẫn dời được — hàng đi theo kệ). */
  moveTarget(): void {
    const w = this.w;
    const t = w.interaction.target;
    if (!t.uid || (t.kind !== 'furniture' && t.kind !== 'slot' && t.kind !== 'tag')) return;
    if (this.holding) {
      w.toast('Đặt thùng xuống (Q) trước khi dời kệ', 'error');
      return;
    }
    w.fp.startMove(t.uid);
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
    if (w.fp.active) return w.fp.hints();
    const t = w.interaction.target;
    const held = this.holding;
    const out: string[] = [];
    switch (t.kind) {
      case 'box': {
        const b = t.uid ? w.s.state.box(t.uid) : undefined;
        if (b) out.push(held ? 'Tay đang bận' : `${CLICK} Nhặt thùng ${getProduct(b.productId).name} ×${b.qty}`);
        if (b && !held) out.push(`<kbd>F</kbd> ${b.open ? 'Đóng' : 'Mở'} thùng`);
        break;
      }
      case 'sign': out.push(`${CLICK} ${w.s.data.storeOpen ? 'Đóng cửa' : 'Mở cửa'}`); break;
      case 'switch': out.push(`${CLICK} ${w.s.data.lightsOn ? 'Tắt' : 'Bật'} đèn cửa hàng`); break;
      case 'vehicle': {
        const v = t.uid ? w.s.vehicles.get(t.uid) : undefined;
        if (!v) break;
        const def = getVehicle(v.type);
        const load = `${cargoUsed(v, w.s.data.boxes)}/${def.capacity} ${def.countBySize ? 'suất' : 'thùng'}`;
        out.push(held ? `${CLICK} Chất thùng lên ${def.name} (${load})` : `${CLICK} Lái ${def.name}`);
        if (!held && v.cargo.length) out.push(`<kbd>G</kbd> Dỡ 1 thùng (${load})`);
        break;
      }
      case 'kiosk': out.push(`${CLICK} Mua hàng sỉ (lấy ngay tại bãi)`); break;
      case 'dirt': {
        const d = w.s.data.dirt.find((x) => x.uid === t.uid);
        if (d) out.push(`${CLICK} ${d.kind === 'litter' ? 'Nhặt rác' : d.kind === 'spill' ? 'Lau vết bẩn' : 'Lau kính'}`);
        break;
      }
      case 'loose': {
        const it = w.s.data.loose.find((x) => x.uid === t.uid);
        if (it) out.push(`${CLICK} Nhặt ${getProduct(it.productId).name} về kệ`);
        break;
      }
      case 'thief': out.push(`${CLICK} 🚨 Tóm kẻ trộm!`); break;
      case 'crate': {
        const k = w.s.data.crates.find((x) => x.uid === t.uid);
        if (k) out.push(held ? 'Tay đang bận' : `${CLICK} Bê thùng ${getFurniture(k.type).icon} ${getFurniture(k.type).name} đi lắp đặt`);
        break;
      }
      case 'tag': out.push(`${CLICK} Đặt giá (súng dán giá)`); break;
      case 'slot':
        if (held && held.open) out.push('<kbd>Chuột trái</kbd> Xếp hàng (giữ để xếp liên tục)', '<kbd>Chuột phải</kbd> Lấy lại vào thùng');
        else if (held) out.push('<kbd>F</kbd> Mở thùng để xếp hàng');
        out.push(held?.open ? '<kbd>E</kbd> Đặt giá' : `${CLICK} Đặt giá`);
        break;
      case 'furniture': {
        const f = t.uid ? w.s.state.furniture(t.uid) : undefined;
        if (!f) break;
        const def = getFurniture(f.type);
        if (def.kind === 'computer') out.push(`${CLICK} Dùng máy tính`);
        if (def.kind === 'checkout') out.push(held ? 'Đặt thùng xuống trước (Q)' : `${CLICK} Vào quầy thu ngân`);
        if (def.kind === 'selfcheckout') out.push(w.selfCheckout.hint(f.uid));
        if (def.kind === 'lamp') out.push(`${def.icon} ${def.name} · ${w.s.data.lightsOn ? 'đang bật' : 'đang tắt'}`);
        if (def.kind === 'trash' && held) out.push(held.qty === 0 ? `${CLICK} Gập & vứt thùng rỗng` : 'Thùng còn hàng!');
        if (def.kind === 'rack') out.push(held ? `${CLICK} Cất thùng lên kệ kho` : f.boxes.length ? `${CLICK} Lấy thùng` : 'Kệ kho trống');
        if (def.kind === 'display' && !held) out.push(`${CLICK} Đặt giá ${def.name}`);
        break;
      }
    }
    if (!held && t.uid && (t.kind === 'furniture' || t.kind === 'slot' || t.kind === 'tag')) out.push('<span class="muted"><kbd>M</kbd> Dời vị trí</span>');
    if (held) out.push(`<span class="muted">${getProduct(held.productId).name} ×${held.qty} · <kbd>F</kbd> ${held.open ? 'đóng' : 'mở'} · <kbd>Q</kbd> thả</span>`);
    return out;
  }
}
