import { MAX_REPUTATION } from '../config/constants';
import type { Services } from '../core/Services';
import { xpNeeded } from '../systems/ProgressionSystem';
import { formatClock } from '../systems/TimeSystem';
import { h, money, uiRoot } from './dom';

export interface HudActions {
  onSave(): void;
  onMenu(): void;
  onEndDay(): void;
  onToggleMute(): void;
  onToggleMusic(): void;
  onBuild(): void;
}

/** HUD góc trên: tiền, ngày, giờ, XP/level, danh tiếng, tốc độ, âm thanh. */
export class Hud {
  private root: HTMLElement;
  private moneyEl: HTMLElement;
  private dayEl: HTMLElement;
  private clockEl: HTMLElement;
  private lvlEl: HTMLElement;
  private xpBar: HTMLElement;
  private stars: HTMLElement;
  private speedBtns: HTMLButtonElement[] = [];
  private muteBtn: HTMLButtonElement;
  private musicBtn: HTMLButtonElement;
  private endBtn: HTMLButtonElement;
  private storeEl: HTMLElement;
  private custEl: HTMLElement;
  private shownMoney: number;
  private raf = 0;
  private offs: Array<() => void> = [];

  constructor(private s: Services, actions: HudActions) {
    const d = s.data;
    this.shownMoney = d.money;
    this.moneyEl = h('div', { class: 'hud-money', text: money(d.money) });
    this.dayEl = h('span', { class: 'hud-day' });
    this.clockEl = h('span', { class: 'hud-clock' });
    this.lvlEl = h('span', { class: 'hud-level' });
    this.xpBar = h('div', { class: 'xp-fill' });
    this.stars = h('div', { class: 'hud-stars' });
    this.storeEl = h('span', { class: 'hud-store' });
    this.custEl = h('span', { class: 'hud-cust', text: '👥 0' });
    this.speedBtns = [1, 2, 3].map((n) => h('button', {
      class: 'speed-btn', text: `${n}x`, title: `Tốc độ ${n}x (phím ${n})`, onClick: () => s.time.setSpeed(n),
    }));
    this.muteBtn = h('button', { class: 'icon-btn', title: 'Tắt/bật âm thanh', onClick: actions.onToggleMute });
    this.musicBtn = h('button', { class: 'icon-btn', title: 'Nhạc nền', onClick: actions.onToggleMusic });
    this.endBtn = h('button', { class: 'btn end-day', text: '🌙 Kết thúc ngày (N)', onClick: actions.onEndDay });
    this.endBtn.style.display = 'none';
    this.root = h('div', { class: 'hud' }, [
      h('div', { class: 'hud-card' }, [this.moneyEl, h('div', { class: 'hud-sub' }, [this.custEl, this.storeEl])]),
      h('div', { class: 'hud-card' }, [
        h('div', { class: 'hud-row' }, [this.dayEl, this.clockEl]),
        h('div', { class: 'hud-row' }, this.speedBtns),
      ]),
      h('div', { class: 'hud-card' }, [
        h('div', { class: 'hud-row' }, [this.lvlEl, this.stars]),
        h('div', { class: 'xp-bar' }, [this.xpBar]),
      ]),
      h('div', { class: 'hud-card hud-tools' }, [
        this.muteBtn, this.musicBtn,
        h('button', { class: 'icon-btn', text: '🔨', title: 'Xây dựng (B)', onClick: actions.onBuild }),
        h('button', { class: 'icon-btn', text: '💾', title: 'Lưu game', onClick: actions.onSave }),
        h('button', { class: 'icon-btn', text: '☰', title: 'Menu', onClick: actions.onMenu }),
      ]),
      this.endBtn,
    ]);
    uiRoot().append(this.root);
    const bus = s.bus;
    this.offs.push(
      bus.on('money:changed', ({ money: m, delta }) => this.animateMoney(m, delta)),
      bus.on('time:changed', () => this.renderTime()),
      bus.on('time:speed', () => this.renderSpeed()),
      bus.on('time:paused', () => this.renderSpeed()),
      bus.on('xp:changed', () => this.renderLevel()),
      bus.on('reputation:changed', () => this.renderStars()),
      bus.on('store:toggled', () => this.renderStore()),
      bus.on('day:canEnd', ({ canEnd }) => { this.endBtn.style.display = canEnd ? 'block' : 'none'; }),
      bus.on('customer:count', ({ count }) => { this.custEl.textContent = `👥 ${count}`; }),
      bus.on('settings:changed', () => this.renderAudio()),
      bus.on('day:started', () => { this.renderTime(); this.endBtn.style.display = 'none'; }),
    );
    this.renderTime();
    this.renderSpeed();
    this.renderLevel();
    this.renderStars();
    this.renderStore();
    this.renderAudio();
  }

  private animateMoney(target: number, delta: number): void {
    cancelAnimationFrame(this.raf);
    const from = this.shownMoney;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      this.shownMoney = from + (target - from) * (1 - Math.pow(1 - t, 3));
      this.moneyEl.textContent = money(this.shownMoney);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.moneyEl.classList.remove('up', 'down');
    void this.moneyEl.offsetWidth;
    this.moneyEl.classList.add(delta >= 0 ? 'up' : 'down');
    this.moneyEl.classList.toggle('negative', target < 0);
  }

  private renderTime(): void {
    this.dayEl.textContent = `📅 Ngày ${this.s.data.day}`;
    this.clockEl.textContent = `🕒 ${formatClock(this.s.data.minutes)}`;
    this.clockEl.classList.toggle('late', this.s.time.isAfterClose());
  }

  private renderSpeed(): void {
    const sp = this.s.time.speed;
    this.speedBtns.forEach((b, i) => {
      b.classList.toggle('active', sp === i + 1);
      b.disabled = this.s.time.isSpeedLocked;
    });
    this.clockEl.classList.toggle('paused', this.s.time.paused);
  }

  private renderLevel(): void {
    const d = this.s.data;
    this.lvlEl.textContent = `⭐ Cấp ${d.level}`;
    this.xpBar.style.width = `${Math.min(100, (d.xp / xpNeeded(d.level)) * 100)}%`;
    this.xpBar.parentElement!.title = `XP ${Math.floor(d.xp)} / ${xpNeeded(d.level)}`;
  }

  private renderStars(): void {
    const r = this.s.data.reputation;
    const full = Math.round(r * 2) / 2;
    let html = '';
    for (let i = 1; i <= MAX_REPUTATION; i++) html += `<span class="${full >= i ? 'on' : full >= i - 0.5 ? 'half' : ''}">★</span>`;
    this.stars.innerHTML = html;
    this.stars.title = `Danh tiếng ${r.toFixed(2)} / 5`;
  }

  private renderStore(): void {
    const open = this.s.data.storeOpen;
    this.storeEl.textContent = open ? '🟢 Mở cửa' : '🔴 Đóng cửa';
  }

  private renderAudio(): void {
    const st = this.s.data.settings;
    this.muteBtn.textContent = st.muted ? '🔇' : '🔊';
    this.musicBtn.textContent = '🎵';
    this.musicBtn.classList.toggle('off', !st.music);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.offs.forEach((o) => o());
    this.root.remove();
  }
}
