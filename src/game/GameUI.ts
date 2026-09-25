import type { Settings } from '../core/GameState';
import type { Services } from '../core/Services';
import { Computer, type AppId } from '../ui/computer';
import { ClickToPlay, Crosshair } from '../ui/crosshair';
import { showDayReport } from '../ui/dayReport';
import { Hud } from '../ui/hud';
import { showGameOver, showPauseMenu } from '../ui/menu';
import { openPricePanel } from '../ui/pricePanel';
import { showSettings } from '../ui/settings';
import { mountToasts } from '../ui/toast';
import { Tutorial } from '../ui/tutorial';
import { uiRoot } from '../ui/dom';
import { PlayInput } from './PlayInput';
import type { World } from './World';

export interface GameHost {
  applySettings(st: Settings): void;
  quitToMenu(): void;
  toggleGallery(): void;
  toggleDebug(): void;
}

/** Giao diện DOM của 1 ván chơi + quản lý pointer lock / modal. */
export class GameUI {
  readonly hud: Hud;
  readonly pc: Computer;
  readonly crosshair = new Crosshair();
  readonly clickToPlay: ClickToPlay;
  readonly tutorial: Tutorial;
  readonly play: PlayInput;
  private modals = new Set<string>();
  private cleanups: Array<() => void> = [];
  private s: Services;

  constructor(private w: World, private host: GameHost) {
    const s = w.s;
    this.s = s;
    this.play = new PlayInput(w, {
      openPc: (app) => this.openPc(app as AppId | undefined),
      openPrice: (uid, slot) => this.openPrice(uid, slot),
      isUiOpen: () => this.isUiOpen(),
    });
    this.hud = new Hud(s, {
      onSave: () => this.save(),
      onMenu: () => this.openPause(),
      onEndDay: () => this.endDay(),
      onToggleMute: () => this.updateSettings(() => { s.data.settings.muted = !s.data.settings.muted; }),
      onToggleMusic: () => this.updateSettings(() => { s.data.settings.music = !s.data.settings.music; }),
      onBuild: () => w.build.toggle(),
    });
    this.pc = new Computer(s, () => {
      this.setModal('pc', false);
      if (w.mode === 'pc') this.play.returnCamera(() => this.relock());
    });
    this.tutorial = new Tutorial(s);
    this.clickToPlay = new ClickToPlay(() => this.relock());
    this.cleanups.push(
      mountToasts(s.bus),
      s.bus.on('ui:openPc', ({ app }) => this.openPc(app as AppId | undefined)),
      s.bus.on('day:closing', () => s.bus.emit('toast', { message: '🌙 22:00 — hết giờ bán. Tiễn khách cuối rồi nhấn N để kết thúc ngày.', kind: 'info' })),
      s.bus.on('game:over', () => showGameOver(s.data.day, () => host.quitToMenu())),
      s.bus.on('build:mode', ({ active }) => {
        uiRoot().classList.toggle('mode-focus', active);
        if (!active) setTimeout(() => this.relock(), 700);
      }),
      s.bus.on('checkout:mode', ({ active }) => {
        uiRoot().classList.toggle('mode-focus', active);
        if (!active) setTimeout(() => this.relock(), 500);
      }),
    );
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', onKey);
    w.input.keys.onKey((e) => { if (!e.defaultPrevented) this.play.onKey(e); });
    w.input.onMouseDown((e) => {
      if (w.mode === 'play' && !this.isUiOpen() && !w.input.locked && !w.input.dragLook && (e.target as HTMLElement).tagName === 'CANVAS') this.relock();
    });
    w.input.onLock((locked) => {
      if (locked) this.clickToPlay.hide();
      else if (w.mode === 'play' && !this.isUiOpen() && !w.input.dragLook) this.openPause();
    });
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));
    if (s.data.day === 1 && !s.data.tutorial.welcome) {
      s.data.tutorial.welcome = true;
      s.bus.emit('toast', { message: '👋 Chào mừng tới Mini Mart! Làm theo hướng dẫn góc phải — mũi tên vàng chỉ chỗ cần tới.', kind: 'info' });
    }
    this.clickToPlay.show();
  }

  isUiOpen(): boolean {
    return this.modals.size > 0;
  }

  setModal(name: string, open: boolean): void {
    if (open) {
      this.modals.add(name);
      this.s.time.pause(name);
      this.w.input.exitLock();
    } else {
      this.modals.delete(name);
      this.s.time.resume(name);
    }
    this.w.input.uiMode = this.modals.size > 0;
    this.s.bus.emit('ui:modal', { name, open });
  }

  /** Khoá chuột lại để chơi; trình duyệt từ chối → chế độ kéo-để-nhìn. */
  relock(): void {
    if (this.isUiOpen() || this.w.mode !== 'play') return;
    this.clickToPlay.hide();
    void this.w.input.requestLock().then((ok) => {
      if (!ok && !this.w.input.dragLook) this.clickToPlay.show();
    });
  }

  private updateSettings(fn: () => void): void {
    fn();
    this.host.applySettings(this.s.data.settings);
    this.s.bus.emit('settings:changed', {});
  }

  private save(): void {
    this.w.saveSnapshot();
    if (this.s.save()) this.s.bus.emit('toast', { message: '💾 Đã lưu game', kind: 'success' });
  }

  openPc(app?: AppId): void {
    const w = this.w;
    if (w.mode === 'checkout') return;
    if (w.mode === 'build' && app !== 'furniture') w.build.exit();
    if (!this.pc.isOpen) this.setModal('pc', true);
    this.pc.open(app ?? undefined);
  }

  openPrice(uid: string, slot?: number): void {
    if (this.modals.has('price')) return;
    this.setModal('price', true);
    openPricePanel(this.s, uid, slot, () => {
      this.setModal('price', false);
      this.relock();
    });
  }

  openPause(): void {
    if (this.modals.has('pause')) return;
    this.setModal('pause', true);
    const canEnd = this.s.day.canEndDay();
    showPauseMenu({
      canEndDay: canEnd,
      onEndDay: () => { this.setModal('pause', false); this.endDay(); },
      onResume: () => { this.setModal('pause', false); this.relock(); },
      onSave: () => this.save(),
      onSettings: () => showSettings(this.s.data.settings, () => this.updateSettings(() => {}), () => { this.setModal('pause', false); this.relock(); }),
      onQuit: () => { this.setModal('pause', false); this.save(); this.host.quitToMenu(); },
    });
  }

  endDay(): void {
    const s = this.s;
    const w = this.w;
    if (!s.day.canEndDay() || this.modals.has('report')) return;
    if (w.checkout.active) w.checkout.exit();
    if (w.build.active) w.build.exit();
    this.setModal('report', true);
    w.saveSnapshot();
    const report = s.day.endDay();
    s.bus.emit('sound', { name: 'levelup' });
    showDayReport(report, () => {
      this.setModal('report', false);
      if (report.gameOver) return;
      s.day.startNextDay();
      w.customers.clear();
      s.bus.emit('toast', { message: `☀️ Ngày ${s.data.day} bắt đầu! Nhớ mở cửa hàng.`, kind: 'info' });
      this.relock();
    });
  }

  private onKey(e: KeyboardEvent): void {
    const w = this.w;
    if (e.code === 'F3') { e.preventDefault(); this.host.toggleDebug(); return; }
    if (e.code === 'F4') { e.preventDefault(); this.host.toggleGallery(); return; }
    if (e.code === 'KeyN' && w.mode === 'play' && !this.isUiOpen() && this.s.day.canEndDay()) { this.endDay(); return; }
    if (w.build.active && !this.isUiOpen() && w.build.onKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.code !== 'Escape' || e.defaultPrevented) return;
    if (this.pc.isOpen) { this.pc.close(); return; }
    if (this.isUiOpen() || w.mode !== 'play') return;
    this.openPause();
  }

  update(): void {
    const w = this.w;
    const show = w.mode === 'play' && !this.isUiOpen();
    this.crosshair.setVisible(show);
    if (show) this.crosshair.set(this.play.hints(), w.interaction.target.kind !== 'none');
  }

  destroy(): void {
    uiRoot().classList.remove('mode-focus');
    this.cleanups.forEach((c) => c());
    this.hud.destroy();
    this.pc.close();
    this.tutorial.destroy();
    this.crosshair.destroy();
    this.clickToPlay.destroy();
  }
}
