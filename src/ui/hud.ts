import { formatVnd } from '../core/Random';
import { CLOSE_MINUTE, DEV_MONEY_BONUS, MAX_REPUTATION, OPEN_MINUTE, VND_PER_UNIT } from '../config/constants';
import type { Services } from '../core/Services';
import { xpNeeded } from '../systems/ProgressionSystem';
import { formatClock } from '../systems/TimeSystem';
import { h, uiRoot } from './dom';
import { icon } from './icons';

export interface HudActions {
  onMenu(): void;
  onEndDay(): void;
}

/**
 * HUD: một bảng trạng thái bên trái (tiền, ngày + giờ + trạng thái cửa hàng, cấp + danh tiếng); góc phải là bản đồ nhỏ
 * (không còn nút trên màn hình: Esc = menu, T = tua nhanh). Âm thanh, lưu, xây dựng nằm trong menu.
 */
export class Hud {
  private root: HTMLElement;
  private intEl = h('span', { class: 'mn-int' });
  private decEl = h('span', { class: 'mn-dec' });
  private moneyEl: HTMLElement;
  private dayEl = h('span', { class: 'hud-day' });
  private clockEl = h('span', { class: 'hud-clock' });
  private weatherEl = h('span', { class: 'hud-weather', text: '', title: 'Thời tiết' });
  private statusEl = h('span', { class: 'hud-status' });
  private dayFill = h('i');
  private lvlEl = h('span', { class: 'lvl-num' });
  private xpFill = h('i');
  private xpWrap: HTMLElement;
  private stars = h('span', { class: 'hud-stars' });
  private endBtn: HTMLButtonElement;
  private shownMoney: number;
  private raf = 0;
  private offs: Array<() => void> = [];

  constructor(private s: Services, actions: HudActions) {
    const d = s.data;
    this.shownMoney = d.money;
    this.moneyEl = h('div', { class: 'hud-money' }, [this.intEl, this.decEl]);
    this.setMoney(d.money);
    this.xpWrap = h('div', { class: 'hud-xp' }, [this.xpFill]);
    this.endBtn = h('button', { class: 'hud-endday', html: `${icon('moon', 15)}<span>Kết thúc ngày</span><kbd>Enter</kbd>`, onClick: actions.onEndDay });
    this.endBtn.style.display = 'none';
    this.root = h('div', { class: 'hud' }, [
      h('section', { class: 'hud-panel hud-main' }, [
        this.moneyEl,
        h('div', { class: 'hud-meta' }, [this.dayEl, this.clockEl, this.weatherEl, this.statusEl]),
        h('div', { class: 'hud-daybar', title: 'Tiến độ trong ngày' }, [this.dayFill]),
        h('div', { class: 'hud-level' }, [
          h('span', { class: 'lvl-badge', html: 'Cấp ' }, [this.lvlEl]),
          this.xpWrap,
          this.stars,
        ]),
      ]),
      h('div', { class: 'hud-side' }, [
        d.devMode ? h('button', { class: 'hud-dev', text: 'DEV  +100 triệu đ', onClick: () => s.economy.addMoney(DEV_MONEY_BONUS, 'Developer') }) : null,
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
      bus.on('store:toggled', () => this.renderTime()),
      bus.on('day:canEnd', ({ canEnd }) => { this.endBtn.style.display = canEnd ? 'flex' : 'none'; }),
      bus.on('weather:changed', ({ icon: ic, rain, flood }) => {
        this.weatherEl.textContent = ic;
        this.weatherEl.title = flood > 0.03 ? 'Đường ngập' : rain > 0.05 ? 'Trời mưa' : 'Thời tiết';
      }),
      bus.on('day:started', () => { this.renderTime(); this.endBtn.style.display = 'none'; }),
    );
    this.renderTime();
    this.renderSpeed();
    this.renderLevel();
    this.renderStars();
  }

  private setMoney(v: number): void {
    this.intEl.textContent = (v < 0 ? '-' : '') + formatVnd(v);
    this.decEl.textContent = 'đ';
    this.intEl.style.fontSize = Math.abs(v) * VND_PER_UNIT >= 1e8 ? '17px' : '';
  }

  private animateMoney(target: number, delta: number): void {
    cancelAnimationFrame(this.raf);
    const from = this.shownMoney;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 500);
      this.shownMoney = from + (target - from) * (1 - Math.pow(1 - t, 3));
      this.setMoney(this.shownMoney);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.moneyEl.classList.remove('up', 'down');
    void this.moneyEl.offsetWidth;
    this.moneyEl.classList.add(delta >= 0 ? 'up' : 'down');
    this.moneyEl.classList.toggle('negative', target < 0);
  }

  private renderTime(): void {
    const d = this.s.data;
    const late = this.s.time.isAfterClose();
    this.dayEl.textContent = `Ngày ${d.day}`;
    this.clockEl.textContent = formatClock(d.minutes);
    this.clockEl.classList.toggle('late', late);
    this.clockEl.classList.toggle('idle', !d.storeOpen);
    const state = !d.storeOpen ? 'closed' : late ? 'late' : 'open';
    this.statusEl.className = `hud-status ${state}`;
    this.statusEl.textContent = { closed: 'Đóng cửa', late: 'Hết giờ', open: 'Mở cửa' }[state];
    this.statusEl.title = d.storeOpen ? '' : 'Đồng hồ chỉ chạy khi cửa hàng mở cửa';
    const frac = (d.minutes - OPEN_MINUTE) / (CLOSE_MINUTE - OPEN_MINUTE);
    this.dayFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  private renderSpeed(): void {
    this.clockEl.classList.toggle('paused', this.s.time.paused);
  }

  private renderLevel(): void {
    const d = this.s.data;
    this.lvlEl.textContent = String(d.level);
    this.xpFill.style.width = `${Math.min(100, (d.xp / xpNeeded(d.level)) * 100)}%`;
    this.xpWrap.title = `Kinh nghiệm ${Math.floor(d.xp)} / ${xpNeeded(d.level)}`;
  }

  private renderStars(): void {
    const r = this.s.data.reputation;
    const full = Math.round(r * 2) / 2;
    let html = '';
    for (let i = 1; i <= MAX_REPUTATION; i++) html += `<span class="${full >= i ? 'on' : full >= i - 0.5 ? 'half' : ''}">${icon('star', 10)}</span>`;
    this.stars.innerHTML = html;
    this.stars.title = `Danh tiếng ${r.toFixed(2)} / 5`;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.offs.forEach((o) => o());
    this.root.remove();
  }
}
