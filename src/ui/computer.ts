import type { Services } from '../core/Services';
import { formatClock } from '../systems/TimeSystem';
import { clear, h, money, uiRoot } from './dom';
import { renderMarket, renderWholesale } from './apps/market';
import { renderGarage } from './apps/garageApp';
import { renderFurniture } from './apps/furnitureApp';
import { renderLicenses } from './apps/licensesApp';
import { renderExpansion } from './apps/expansionApp';
import { renderStaff } from './apps/staffApp';
import { renderBank } from './apps/bankApp';
import { renderPricing } from './apps/pricingApp';

export type AppId = 'market' | 'furniture' | 'licenses' | 'expansion' | 'staff' | 'bank' | 'pricing' | 'garage' | 'wholesale';

export interface AppContext {
  s: Services;
  rerender(): void;
  closePc(): void;
  openApp(id: AppId): void;
}

interface AppDef {
  id: AppId;
  name: string;
  icon: string;
  render(body: HTMLElement, ctx: AppContext): void;
  /** Không hiện icon trên desktop (chỉ mở từ nơi khác, vd. quầy kho sỉ) */
  hidden?: boolean;
}

const APPS: AppDef[] = [
  { id: 'market', name: 'Đặt hàng', icon: '🛒', render: renderMarket },
  { id: 'pricing', name: 'Bảng giá', icon: '🏷️', render: renderPricing },
  { id: 'furniture', name: 'Nội thất', icon: '🛋️', render: renderFurniture },
  { id: 'licenses', name: 'Giấy phép', icon: '📜', render: renderLicenses },
  { id: 'expansion', name: 'Mở rộng', icon: '🏗️', render: renderExpansion },
  { id: 'staff', name: 'Nhân sự', icon: '👥', render: renderStaff },
  { id: 'bank', name: 'Ngân hàng', icon: '🏦', render: renderBank },
  { id: 'garage', name: 'Nhà xe', icon: '🚗', render: renderGarage },
  { id: 'wholesale', name: 'Kho sỉ', icon: '🏭', render: renderWholesale, hidden: true },
];

/** Cờ bốn màu trên nút Start (vẽ bằng SVG, không dùng logo thật). */
const FLAG = '<svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><path d="M1 3.2c2-1 3.6-.3 5.2 0v4.3C4.6 7.2 3 6.5 1 7.5z" fill="#f25022"/><path d="M7 3.5c1.6.4 3.2 1.1 5.2.1v4.2c-2 1-3.6.3-5.2-.1z" fill="#7fba00"/><path d="M1 8.5c2-1 3.6-.3 5.2 0v4.3c-1.6-.3-3.2-1-5.2 0z" fill="#00a4ef"/><path d="M7 8.8c1.6.4 3.2 1.1 5.2.1v4.2c-2 1-3.6.3-5.2-.1z" fill="#ffb900"/></svg>';

/** Máy tính giả lập kiểu Windows XP: desktop, cửa sổ xanh Luna, thanh taskbar + menu Start. */
export class Computer {
  private root: HTMLElement | null = null;
  private winHost!: HTMLElement;
  private tasks!: HTMLElement;
  private startMenu!: HTMLElement;
  private current: AppId | null = null;
  private clock!: HTMLElement;
  private balance!: HTMLElement;
  private offs: Array<() => void> = [];

  constructor(private s: Services, private onClose: () => void) {}

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(app?: AppId): void {
    if (!this.root) {
      this.winHost = h('div', { class: 'pc-windows' });
      this.tasks = h('div', { class: 'pc-tasks' });
      this.clock = h('span', { class: 'pc-clock' });
      this.balance = h('span', { class: 'pc-balance' });
      this.startMenu = this.buildStartMenu();
      const icons = h('div', { class: 'pc-icons' }, APPS.filter((a) => !a.hidden).map((a) => h('button', {
        class: 'pc-icon', onClick: () => this.openApp(a.id),
      }, [h('div', { class: 'pc-icon-img', text: a.icon }), h('div', { class: 'pc-icon-name', text: a.name })])));
      const start = h('button', {
        class: 'pc-start', html: `${FLAG}<span>start</span>`,
        onClick: (e) => { e.stopPropagation(); this.startMenu.classList.toggle('open'); },
      });
      this.root = h('div', { class: 'pc-overlay' }, [
        h('div', { class: 'pc-screen' }, [
          h('div', { class: 'pc-desktop' }, [icons, this.winHost]),
          this.startMenu,
          h('div', { class: 'pc-taskbar' }, [start, this.tasks, h('div', { class: 'pc-tray' }, [this.balance, this.clock])]),
        ]),
      ]);
      this.root.addEventListener('click', () => this.startMenu.classList.remove('open'));
      uiRoot().append(this.root);
      requestAnimationFrame(() => this.root?.classList.add('show'));
      this.offs.push(this.s.bus.on('money:changed', () => this.renderTaskbar()));
      this.renderTaskbar();
    }
    if (app) this.openApp(app);
  }

  private buildStartMenu(): HTMLElement {
    const items = APPS.filter((a) => !a.hidden).map((a) => h('button', {
      class: 'sm-item', onClick: () => { this.startMenu.classList.remove('open'); this.openApp(a.id); },
    }, [h('span', { class: 'sm-ico', text: a.icon }), h('span', { text: a.name })]));
    return h('div', { class: 'pc-startmenu', onClick: (e) => e.stopPropagation() }, [
      h('div', { class: 'sm-head' }, [h('span', { class: 'sm-avatar', text: '🏪' }), h('b', { text: 'Chủ tiệm' })]),
      h('div', { class: 'sm-body' }, [
        h('div', { class: 'sm-left' }, items),
        h('div', { class: 'sm-right' }, [h('b', { text: 'Đầu Hẻm OS' }), h('span', { text: 'Phiên bản 1.0' }), h('span', { class: 'sm-hint', text: 'Nhấn Esc để tắt máy' })]),
      ]),
      h('div', { class: 'sm-foot' }, [h('button', { class: 'sm-off', html: '<i></i><span>Tắt máy</span>', onClick: () => this.close() })]),
    ]);
  }

  private renderTaskbar(): void {
    this.clock.textContent = `Ngày ${this.s.data.day} · ${formatClock(this.s.data.minutes)}`;
    this.balance.textContent = `💰 ${money(this.s.data.money)}`;
  }

  private closeWindow(): void {
    clear(this.winHost);
    clear(this.tasks);
    this.current = null;
  }

  openApp(id: AppId): void {
    const def = APPS.find((a) => a.id === id);
    if (!def || !this.root) return;
    this.current = id;
    this.s.bus.emit('sound', { name: 'click' });
    clear(this.winHost);
    clear(this.tasks);
    const body = h('div', { class: 'win-body' });
    const win = h('div', { class: 'window app-window' }, [
      h('div', { class: 'win-title' }, [
        h('span', { class: 'xp-title', text: `${def.icon} ${def.name}` }),
        h('div', { class: 'xp-ctl' }, [
          h('button', { class: 'xp-btn', title: 'Thu nhỏ', text: '🗕', onClick: () => win.classList.toggle('minimized') }),
          h('button', { class: 'xp-btn', title: 'Phóng to', text: '🗖', onClick: () => win.classList.toggle('maximized') }),
          h('button', { class: 'xp-btn xp-close', title: 'Đóng', text: '✕', onClick: () => this.closeWindow() }),
        ]),
      ]),
      body,
    ]);
    this.winHost.append(win);
    this.tasks.append(h('button', { class: 'pc-task', text: `${def.icon} ${def.name}`, onClick: () => win.classList.toggle('minimized') }));
    const ctx: AppContext = {
      s: this.s,
      rerender: () => { if (this.current === id) { clear(body); def.render(body, ctx); } },
      closePc: () => this.close(),
      openApp: (x) => this.openApp(x),
    };
    def.render(body, ctx);
  }

  close(): void {
    if (!this.root) return;
    const r = this.root;
    this.root = null;
    this.current = null;
    this.offs.forEach((o) => o());
    this.offs = [];
    r.classList.remove('show');
    setTimeout(() => r.remove(), 180);
    this.onClose();
  }
}
