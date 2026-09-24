import Phaser from 'phaser';
import { getServices, type Services } from '../core/Services';
import { applyAudioSettings, quitToMenu } from '../core/GameSession';
import { Computer, type AppId } from '../ui/computer';
import { showDayReport } from '../ui/dayReport';
import { Hud } from '../ui/hud';
import { showGameOver, showPauseMenu, showSettings } from '../ui/menu';
import { openPricePanel } from '../ui/pricePanel';
import { mountToasts } from '../ui/toast';
import { Tutorial } from '../ui/tutorial';
import type { GameScene } from './GameScene';

/** Scene chạy song song: quản lý UI DOM (HUD, máy tính, báo cáo, menu). */
export class UIScene extends Phaser.Scene {
  private s!: Services;
  private hud!: Hud;
  private pc!: Computer;
  private tutorial!: Tutorial;
  private cleanups: Array<() => void> = [];
  private modals = new Set<string>();

  constructor() {
    super('UI');
  }

  private get gameScene(): GameScene {
    return this.scene.get('Game') as GameScene;
  }

  private setModal(name: string, open: boolean): void {
    if (open) {
      this.modals.add(name);
      this.s.time.pause(name);
    } else {
      this.modals.delete(name);
      this.s.time.resume(name);
    }
    this.s.bus.emit('ui:modal', { name, open });
  }

  create(): void {
    this.s = getServices();
    const s = this.s;
    this.hud = new Hud(s, {
      onSave: () => s.bus.emit('game:save', {}),
      onMenu: () => this.openPause(),
      onEndDay: () => this.endDay(),
      onToggleMute: () => this.updateSettings(() => { s.data.settings.muted = !s.data.settings.muted; }),
      onToggleMusic: () => this.updateSettings(() => { s.data.settings.music = !s.data.settings.music; }),
      onBuild: () => this.gameScene.build.toggle(),
    });
    this.pc = new Computer(s, () => this.setModal('pc', false));
    this.tutorial = new Tutorial(s);
    this.cleanups.push(
      mountToasts(s.bus),
      s.bus.on('ui:openPc', ({ app }) => this.openPc(app as AppId | undefined)),
      s.bus.on('ui:openPrice', ({ furnitureUid }) => {
        if (!furnitureUid || this.modals.has('price')) return;
        this.setModal('price', true);
        openPricePanel(s, furnitureUid, () => this.setModal('price', false));
      }),
      s.bus.on('day:closing', () => s.bus.emit('toast', { message: '🌙 22:00 — hết giờ bán. Tiễn khách cuối rồi kết thúc ngày.', kind: 'info' })),
      s.bus.on('game:over', () => showGameOver(s.data.day, () => quitToMenu(this.game))),
    );
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', onKey);
    this.cleanups.push(() => window.removeEventListener('keydown', onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (s.data.day === 1 && !s.data.tutorial.welcome) {
      s.data.tutorial.welcome = true;
      s.bus.emit('toast', { message: '👋 Chào mừng tới Mini Mart! Hãy làm theo hướng dẫn góc phải.', kind: 'info' });
    }
  }

  private updateSettings(fn: () => void): void {
    fn();
    applyAudioSettings(this.s.data.settings);
    this.s.bus.emit('settings:changed', {});
  }

  private openPc(app?: AppId): void {
    if (this.gameScene.checkout.active) return;
    if (this.gameScene.build.active && app !== 'furniture') this.gameScene.build.exit();
    if (!this.pc.isOpen) this.setModal('pc', true);
    this.pc.open(app ?? undefined);
  }

  private openPause(): void {
    if (this.modals.has('pause')) return;
    this.setModal('pause', true);
    showPauseMenu({
      onResume: () => this.setModal('pause', false),
      onSave: () => this.s.bus.emit('game:save', {}),
      onSettings: () => {
        showSettings(this.s.data.settings, () => this.updateSettings(() => {}), () => this.setModal('pause', false));
      },
      onQuit: () => {
        this.setModal('pause', false);
        this.s.bus.emit('game:save', {});
        quitToMenu(this.game);
      },
    });
  }

  private endDay(): void {
    const s = this.s;
    if (!s.day.canEndDay() || this.modals.has('report')) return;
    const g = this.gameScene;
    if (g.checkout.active) g.checkout.exit();
    if (g.build.active) g.build.exit();
    this.setModal('report', true);
    const report = s.day.endDay();
    s.bus.emit('sound', { name: 'levelup' });
    showDayReport(report, () => {
      this.setModal('report', false);
      if (report.gameOver) return;
      s.day.startNextDay();
      g.resetForNewDay();
      s.bus.emit('toast', { message: `☀️ Ngày ${s.data.day} bắt đầu! Nhớ mở cửa hàng.`, kind: 'info' });
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code !== 'Escape' || e.defaultPrevented) return;
    if (this.pc.isOpen) {
      this.pc.close();
      return;
    }
    const g = this.gameScene;
    if (this.modals.size > 0 || g.checkout.active || g.build.active) return;
    this.openPause();
  }

  private cleanup(): void {
    this.cleanups.forEach((c) => c());
    this.hud.destroy();
    this.pc.close();
    this.tutorial.destroy();
  }
}
