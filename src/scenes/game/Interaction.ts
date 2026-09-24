import type Phaser from 'phaser';
import { INTERACT_RANGE, STOCK_REPEAT_MS } from '../../config/constants';
import { getFurniture } from '../../config/furniture';
import { getProduct } from '../../config/products';
import type { BoxData, FurnitureData } from '../../core/GameState';
import type { Keyboard } from '../../core/Input';
import type { Services } from '../../core/Services';
import type { Player } from '../../entities/Player';
import { DEPTH_UI } from '../../iso/DepthSort';
import { counterTiles, distanceToCells, footprintCells } from '../../iso/Footprint';
import { gridToScreen } from '../../iso/IsoMath';
import type { BoxManager } from './BoxManager';
import type { FurnitureManager } from './FurnitureManager';

interface Candidate {
  label: string;
  dist: number;
  dot: number;
  act?: () => void;
  repeat?: boolean;
  shiftLabel?: string;
  shiftAct?: () => void;
  key: string;
}

export interface InteractionHooks {
  enterCheckout(counterUid: string): void;
}

/** Tương tác với vật gần nhất phía trước người chơi (E / Shift+E / Q / F). */
export class Interaction {
  private prompt: Phaser.GameObjects.Text;
  private repeatTimer = 0;
  private repeatKey: string | null = null;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    private s: Services,
    private player: Player,
    private furniture: FurnitureManager,
    private boxes: BoxManager,
    private keys: Keyboard,
    private hooks: InteractionHooks,
  ) {
    this.prompt = scene.add.text(0, 0, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '12px', color: '#ffffff', backgroundColor: '#3d3551e6',
      padding: { x: 6, y: 3 }, align: 'center', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(DEPTH_UI).setResolution(2).setVisible(false);
  }

  private toast(message: string): void {
    this.s.bus.emit('toast', { message, kind: 'error' });
    this.s.bus.emit('sound', { name: 'error' });
  }

  private tutorial(step: string): void {
    this.s.bus.emit('tutorial:done', { step });
  }

  private candidates(): Candidate[] {
    const p = this.player;
    const out: Candidate[] = [];
    const held = p.heldBox;
    const dirTo = (x: number, y: number) => {
      const dx = x - p.gx;
      const dy = y - p.gy;
      const len = Math.hypot(dx, dy);
      return len < 0.05 ? 1 : (dx * p.facing.gx + dy * p.facing.gy) / len;
    };
    if (!held) {
      for (const b of this.s.data.boxes) {
        if (b.location !== 'floor') continue;
        const dist = Math.hypot(b.gx - p.gx, b.gy - p.gy);
        if (dist > INTERACT_RANGE) continue;
        const name = getProduct(b.productId).name;
        out.push({
          key: b.uid, dist, dot: dirTo(b.gx, b.gy), label: `[E] Nhặt thùng ${name} ×${b.qty}`,
          act: () => this.pickUp(b),
        });
      }
    }
    for (const f of this.s.data.furniture) {
      const def = getFurniture(f.type);
      const cells = footprintCells(def, f.gx, f.gy, f.rot);
      const { dist, cell } = distanceToCells(p.gx, p.gy, cells);
      if (dist > INTERACT_RANGE) continue;
      const c = this.furnitureCandidate(f, held);
      if (c) out.push({ ...c, key: f.uid, dist, dot: dirTo(cell.gx + 0.5, cell.gy + 0.5) });
    }
    const sign = this.s.grid.signTile;
    const sd = Math.hypot(sign.gx + 0.5 - p.gx, sign.gy + 0.2 - p.gy);
    if (sd <= INTERACT_RANGE) {
      out.push({
        key: 'sign', dist: sd, dot: dirTo(sign.gx + 0.5, sign.gy), label: this.s.data.storeOpen ? '[E] Đóng cửa' : '[E] Mở cửa',
        act: () => this.toggleStore(),
      });
    }
    return out;
  }

  private furnitureCandidate(f: FurnitureData, held: BoxData | null): Omit<Candidate, 'dist' | 'dot' | 'key'> | null {
    const def = getFurniture(f.type);
    switch (def.kind) {
      case 'display':
        if (!held) return { label: `[E] Đặt giá ${def.name}`, act: () => this.s.bus.emit('ui:openPrice', { furnitureUid: f.uid }) };
        if (!held.open) return { label: '[F] Mở thùng để xếp hàng', act: () => this.toast('Thùng đang đóng — nhấn F để mở') };
        return {
          label: held.qty > 0 ? `[E] Xếp hàng (giữ E) · còn ${held.qty}` : 'Thùng rỗng',
          act: held.qty > 0 ? () => this.stock(f) : () => this.toast('Thùng đã hết hàng — vứt vào thùng rác'),
          repeat: held.qty > 0,
          shiftLabel: '[Shift+E] Lấy lại vào thùng',
          shiftAct: () => this.takeBack(f),
        };
      case 'trash':
        if (!held) return null;
        return held.qty === 0
          ? { label: '[E] Vứt thùng rỗng', act: () => this.trash(held) }
          : { label: 'Thùng còn hàng!', act: () => this.toast('Thùng vẫn còn hàng, không thể vứt') };
      case 'computer':
        return { label: '[E] Dùng máy tính', act: () => { this.s.bus.emit('ui:openPc', {}); this.tutorial('pc'); } };
      case 'checkout': {
        const st = counterTiles(f.gx, f.gy, f.rot).staff;
        const d = Math.hypot(st.gx + 0.5 - this.player.gx, st.gy + 0.5 - this.player.gy);
        if (d > INTERACT_RANGE) return null;
        if (held) return { label: 'Đặt thùng xuống trước (Q)', act: () => this.toast('Hãy đặt thùng xuống (Q) trước khi vào quầy') };
        return { label: '[E] Vào quầy thu ngân', act: () => this.hooks.enterCheckout(f.uid) };
      }
      case 'rack':
        if (held) return { label: '[E] Cất thùng lên kệ kho', act: () => this.putOnRack(f, held) };
        if (f.boxes.length > 0) return { label: '[E] Lấy thùng từ kệ kho', act: () => this.takeFromRack(f) };
        return null;
    }
  }

  // ---------- hành động ----------
  pickUp(b: BoxData): void {
    b.location = 'held';
    b.holderId = 'player';
    this.player.hold(b);
    this.s.bus.emit('boxes:changed', {});
    this.s.bus.emit('sound', { name: 'pop' });
    this.tutorial('pickup');
  }

  drop(): void {
    const b = this.player.heldBox;
    if (!b) return;
    const fp = this.player.frontPoint(0.8);
    let tx = Math.floor(fp.gx);
    let ty = Math.floor(fp.gy);
    if (!this.s.grid.isWalkable(tx, ty)) {
      tx = Math.floor(this.player.gx);
      ty = Math.floor(this.player.gy);
    }
    b.location = 'floor';
    b.holderId = null;
    b.gx = tx + 0.5;
    b.gy = ty + 0.5;
    this.player.hold(null);
    this.s.bus.emit('boxes:changed', {});
    this.s.bus.emit('sound', { name: 'place' });
    this.boxes.update();
    this.boxes.get(b.uid)?.bounce();
  }

  toggleBox(): void {
    const held = this.player.heldBox;
    if (held) {
      held.open = !held.open;
      this.player.refreshHeld();
      this.s.bus.emit('sound', { name: 'click' });
      return;
    }
    const c = this.candidates().filter((x) => this.s.state.box(x.key)?.location === 'floor').sort((a, b) => a.dist - b.dist)[0];
    const box = c ? this.s.state.box(c.key) : undefined;
    if (box) {
      box.open = !box.open;
      this.s.bus.emit('boxes:changed', {});
      this.s.bus.emit('sound', { name: 'click' });
    }
  }

  private stock(f: FurnitureData): void {
    const b = this.player.heldBox;
    if (!b) return;
    const r = this.s.inventory.stock(b, f);
    if (!r.ok) {
      this.repeatKey = null;
      this.toast(r.reason);
      return;
    }
    this.furniture.get(f.uid)?.shake();
    this.player.refreshHeld();
    this.s.bus.emit('sound', { name: 'click' });
    this.tutorial('stock');
  }

  private takeBack(f: FurnitureData): void {
    const b = this.player.heldBox;
    if (!b) return;
    const r = this.s.inventory.takeBack(b, f);
    if (!r.ok) {
      this.toast(r.reason);
      return;
    }
    this.furniture.get(f.uid)?.shake();
    this.player.refreshHeld();
    this.s.bus.emit('sound', { name: 'click' });
  }

  private trash(b: BoxData): void {
    this.s.inventory.removeBox(b.uid);
    this.player.hold(null);
    this.s.bus.emit('sound', { name: 'whoosh' });
  }

  private putOnRack(rack: FurnitureData, b: BoxData): void {
    const r = this.s.inventory.putOnRack(b, rack);
    if (!r.ok) return this.toast(r.reason);
    this.player.hold(null);
    this.s.bus.emit('sound', { name: 'place' });
  }

  private takeFromRack(rack: FurnitureData): void {
    const b = this.s.inventory.takeFromRack(rack);
    if (b) this.pickUp(b);
  }

  toggleStore(): void {
    const d = this.s.data;
    d.storeOpen = !d.storeOpen;
    this.s.bus.emit('store:toggled', { open: d.storeOpen });
    this.s.bus.emit('sound', { name: 'door' });
    if (d.storeOpen) this.tutorial('open');
  }

  // ---------- vòng lặp ----------
  private best(): Candidate | null {
    let best: Candidate | null = null;
    let bestScore = Infinity;
    for (const c of this.candidates()) {
      if (c.dot < -0.3 && c.dist > 0.7) continue;
      const score = c.dist - c.dot * 0.6;
      if (score < bestScore) { best = c; bestScore = score; }
    }
    return best;
  }

  onKey(e: KeyboardEvent): void {
    if (!this.enabled) return;
    if (e.code === 'KeyE' && !e.repeat) {
      const c = this.best();
      if (!c) return;
      if (e.shiftKey && c.shiftAct) c.shiftAct();
      else if (c.act) c.act();
      this.repeatKey = c.repeat && !e.shiftKey ? c.key : null;
      this.repeatTimer = 250;
    } else if (e.code === 'KeyQ') {
      this.drop();
    } else if (e.code === 'KeyF') {
      this.toggleBox();
    }
  }

  update(dtMs: number): void {
    if (!this.enabled) {
      this.prompt.setVisible(false);
      return;
    }
    const c = this.best();
    // giữ E để xếp liên tục
    if (this.repeatKey && this.keys.isDown('KeyE')) {
      this.repeatTimer -= dtMs;
      if (this.repeatTimer <= 0) {
        this.repeatTimer = STOCK_REPEAT_MS;
        if (c && c.key === this.repeatKey && c.repeat && c.act) c.act();
        else this.repeatKey = null;
      }
    } else {
      this.repeatKey = null;
    }
    if (!c) {
      this.prompt.setVisible(false);
      return;
    }
    const lines = [c.label];
    if (c.shiftLabel) lines.push(c.shiftLabel);
    const p = gridToScreen(this.player.gx, this.player.gy);
    this.prompt.setText(lines.join('\n')).setPosition(p.x, p.y - 58).setVisible(true);
  }

  destroy(): void {
    this.prompt.destroy();
  }
}

