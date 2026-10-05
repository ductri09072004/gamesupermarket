import * as THREE from 'three';
import { FEEL } from '../config/feel';
import { getFurniture } from '../config/furniture';
import { getProduct } from '../config/products';
import { vehicleDef } from '../config/vehicles';
import { cargoUsed } from '../systems/VehicleSystem';
import type { World } from './World';
import { altarHint, lightIncense } from './Altar';

/** Thời gian giữ chuột trái lên nội thất để dời chỗ (ms) */
const HOLD_MOVE_MS = 2000;

/** Gợi ý nút tương tác chính */
export const CLICK = '<kbd>Chuột trái</kbd>';

export interface PlayUiHooks {
  openPc(app?: string): void;
  openPrice(uid: string, slot?: number): void;
  isUiOpen(): boolean;
  toggleMap(): void;
  /** Tiến độ giữ chuột để dời nội thất (0..1; null = ẩn vòng) */
  holdProgress(p: number | null): void;
}

/** Phím & chuột khi đang đi lại trong cửa hàng; gợi ý phím dưới tâm ngắm. */
export class PlayInput {
  private hold: { t0: number; uid: string; fired: boolean; lost: number } | null = null;

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
      else if (e.code === 'KeyT') w.s.time.toggleFast();
      return;
    }
    switch (e.code) {
      case 'KeyE': if (!e.repeat) this.interact(); break;
      case 'KeyC': {
        const t = w.interaction.target;
        w.actions.setOpen(false, this.holding ? undefined : t.kind === 'box' ? t.uid ?? undefined : undefined);
        break;
      }
      case 'KeyG': w.actions.drop(); break;
      case 'KeyR': w.actions.throwBox(); break;
      case 'KeyF': if (!e.repeat) this.enterVehicle(); break;
      case 'Tab': e.preventDefault(); this.ui.openPc('pricing'); break;
      case 'KeyM': this.ui.toggleMap(); break;
      case 'KeyT': w.s.time.toggleFast(); break;
    }
  }

  /** Mục tiêu đang nhìn là nội thất / kệ / ngăn / nhãn giá (giữ chuột 2 giây để dời chỗ). */
  private movable(): string | null {
    const t = this.w.interaction.target;
    return t.uid && (t.kind === 'furniture' || t.kind === 'slot' || t.kind === 'tag') ? t.uid : null;
  }

  /** Bắt đầu đếm giữ chuột trên nội thất đang nhìn (tay không cầm thùng). Trả về true nếu có đếm. */
  private beginHold(): boolean {
    const w = this.w;
    if (w.mode !== 'play' || this.ui.isUiOpen() || w.fp.active || this.holding) return false;
    const uid = this.movable();
    if (!uid) return false;
    this.hold = { t0: performance.now(), uid, fired: false, lost: 0 };
    return true;
  }

  /** Nhấn chuột trái (đã khoá chuột): nội thất thì chờ nhả chuột (click ngắn = dùng, giữ 2 giây = dời chỗ); còn lại tác dụng ngay. */
  onPrimaryDown(): void {
    if (!this.beginHold()) this.onPrimaryClick();
  }

  /** Nhấn chuột trái ở chế độ kéo-để-nhìn (chưa khoá chuột): click xử lý lúc nhả, ở đây chỉ bắt đầu đếm giữ. */
  onPrimaryDownDrag(): void {
    this.beginHold();
  }

  /**
   * Nhả chuột trái. locked: click đã tác dụng lúc nhấn trừ khi đang đếm giữ; kéo-để-nhìn: click tác dụng ở đây nếu chưa kéo chuột.
   */
  onPrimaryUp(locked: boolean, dragged = false): void {
    const h = this.hold;
    this.hold = null;
    this.ui.holdProgress(null);
    if (h) {
      if (!h.fired && !dragged) this.onPrimaryClick();
      return;
    }
    if (!locked && !dragged) this.onPrimaryClick();
  }

  /** Mỗi khung hình: đếm thời gian giữ chuột; đủ 2 giây thì bắt đầu dời nội thất đang nhìn. */
  updateHold(dt: number): void {
    const h = this.hold;
    if (!h || h.fired) return;
    const cancel = () => {
      this.hold = null;
      this.ui.holdProgress(null);
    };
    if (this.w.mode !== 'play' || this.ui.isUiOpen() || this.w.input.dragged) return cancel();
    // ngắm lướt qua khe giữa các ngăn kệ vài khung hình thì vẫn tính; nhìn sang vật khác / lệch lâu thì huỷ
    const cur = this.movable();
    if (cur === h.uid) h.lost = 0;
    else if (cur !== null || (h.lost += dt) > 0.4) return cancel();
    const p = (performance.now() - h.t0) / HOLD_MOVE_MS;
    if (p >= 1) {
      h.fired = true;
      this.ui.holdProgress(null);
      if (this.holding) this.w.toast('Đặt thùng xuống (G) trước khi dời kệ', 'error');
      else this.w.fp.startMove(h.uid);
    } else if (p > 0.05) this.ui.holdProgress(p);
  }

  /** Chuột trái = tương tác. Đang cầm thùng đóng → mở thùng; cầm thùng mở nhìn ngăn kệ → để World xếp hàng. */
  onPrimaryClick(): void {
    const w = this.w;
    if (w.mode !== 'play' || this.ui.isUiOpen()) return;
    if (w.fp.active) {
      w.fp.place();
      return;
    }
    const t = w.interaction.target;
    const held = this.holding;
    if (held && !held.open && !this.heldHasTarget()) {
      w.actions.setOpen(true);
      return;
    }
    if (t.kind === 'none' || (t.kind === 'slot' && held?.open)) return;
    this.interact();
  }

  /** Nhìn vào chỗ cần dùng thùng đang cầm (xe, kệ kho, thùng rác, quầy) → click làm việc đó thay vì mở thùng. */
  private heldHasTarget(): boolean {
    const w = this.w;
    const t = w.interaction.target;
    if (t.kind === 'vehicle') return true;
    if (t.kind !== 'furniture' || !t.uid) return false;
    const f = w.s.state.furniture(t.uid);
    return !!f && ['rack', 'trash', 'checkout'].includes(getFurniture(f.type).kind);
  }

  interact(): void {
    const w = this.w;
    const t = w.interaction.target;
    const held = this.holding;
    if (t.kind === 'box' && t.uid) {
      if (held) w.toast('Tay đang cầm thùng — nhấn G để đặt xuống', 'error');
      else w.actions.pickUp(t.uid);
      return;
    }
    if (t.kind === 'vehicle' && t.uid) {
      if (held) this.loadVehicle(t.uid);
      else this.unloadVehicle();
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
      if (held) w.toast('Tay đang cầm thùng hàng — nhấn G để đặt xuống trước', 'error');
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
        else w.toast(held.open ? 'Nhìn vào một ngăn kệ và click trái để xếp hàng' : 'Bấm chuột trái để mở thùng trước', 'info');
        break;
      case 'computer': this.useComputer(f.uid); break;
      case 'checkout':
        if (held) w.toast('Hãy đặt thùng xuống (G) trước khi vào quầy', 'error');
        else w.checkout.enter(f.uid);
        break;
      case 'selfcheckout':
        if (w.selfCheckout.assist(f.uid)) w.toast('🤝 Đã hướng dẫn khách — máy chạy tiếp', 'success');
        else w.toast('Máy đang hoạt động bình thường', 'info');
        break;
      case 'altar': lightIncense(w, f.uid); break;
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

  /** F: lên xe đang nhìn. */
  private enterVehicle(): void {
    const t = this.w.interaction.target;
    if (t.kind === 'vehicle' && t.uid) this.w.driving.enter(t.uid);
  }

  /** Chuột trái vào xe khi tay trống: lấy 1 thùng từ xe xuống tay. */
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
      w.toast('Đặt thùng xuống (G) trước khi dời kệ', 'error');
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
        if (b && !held && b.open) out.push('<kbd>C</kbd> Đóng thùng');
        break;
      }
      case 'sign': out.push(`${CLICK} ${w.s.data.storeOpen ? 'Đóng cửa' : 'Mở cửa'}`); break;
      case 'switch': out.push(`${CLICK} ${w.s.data.lightsOn ? 'Tắt' : 'Bật'} đèn cửa hàng`); break;
      case 'vehicle': {
        const v = t.uid ? w.s.vehicles.get(t.uid) : undefined;
        if (!v) break;
        const def = vehicleDef(v);
        const load = `${cargoUsed(v, w.s.data.boxes)}/${def.capacity} ${def.countBySize ? 'suất' : 'thùng'}`;
        out.push(held ? `${CLICK} Chất thùng lên ${def.name} (${load})` : v.cargo.length ? `${CLICK} Dỡ 1 thùng xuống tay (${load})` : `${def.name} · chưa chở thùng nào`);
        out.push(`<kbd>F</kbd> Lái ${def.name}`);
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
        else if (held) out.push(`${CLICK} Mở thùng để xếp hàng`);
        out.push(held?.open ? '<kbd>E</kbd> Đặt giá' : `${CLICK} Đặt giá`);
        break;
      case 'furniture': {
        const f = t.uid ? w.s.state.furniture(t.uid) : undefined;
        if (!f) break;
        const def = getFurniture(f.type);
        if (def.kind === 'computer') out.push(`${CLICK} Dùng máy tính`);
        if (def.kind === 'checkout') out.push(held ? 'Đặt thùng xuống trước (G)' : `${CLICK} Vào quầy thu ngân`);
        if (def.kind === 'selfcheckout') out.push(w.selfCheckout.hint(f.uid));
        if (def.kind === 'altar') out.push(altarHint(w, CLICK));
        if (def.kind === 'lamp') out.push(`${def.icon} ${def.name} · ${w.s.data.lightsOn ? 'đang bật' : 'đang tắt'}`);
        if (def.kind === 'trash' && held) out.push(held.qty === 0 ? `${CLICK} Gập & vứt thùng rỗng` : 'Thùng còn hàng!');
        if (def.kind === 'rack') out.push(held ? `${CLICK} Cất thùng lên kệ kho` : f.boxes.length ? `${CLICK} Lấy thùng` : 'Kệ kho trống');
        if (def.kind === 'display' && !held) out.push(`${CLICK} Đặt giá ${def.name}`);
        break;
      }
    }
    if (!held && this.movable()) out.push('<span class="muted"><kbd>Giữ chuột trái</kbd> 2 giây: dời vị trí</span>');
    if (held) out.push(`<span class="muted">${getProduct(held.productId).name} ×${held.qty} · ${held.open ? '<kbd>C</kbd> đóng' : `${CLICK} mở`} · <kbd>G</kbd> đặt · <kbd>R</kbd> quăng</span>`);
    return out;
  }
}
