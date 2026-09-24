import type { Services } from '../core/Services';
import { formatClock } from '../systems/TimeSystem';
import { clear, h, money, uiRoot } from './dom';
import { renderMarket } from './apps/market';
import { renderFurniture } from './apps/furnitureApp';
import { renderLicenses } from './apps/licensesApp';
import { renderExpansion } from './apps/expansionApp';
import { renderStaff } from './apps/staffApp';
import { renderBank } from './apps/bankApp';
import { renderPricing } from './apps/pricingApp';

export type AppId = 'market' | 'furniture' | 'licenses' | 'expansion' | 'staff' | 'bank' | 'pricing';

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
}

const APPS: AppDef[] = [
  { id: 'market', name: 'Market', icon: '🛒', render: renderMarket },
  { id: 'pricing', name: 'Pricing', icon: '🏷️', render: renderPricing },
  { id: 'furniture', name: 'Furniture', icon: '🛋️', render: renderFurniture },
  { id: 'licenses', name: 'Licenses', icon: '📜', render: renderLicenses },
  { id: 'expansion', name: 'Expansion', icon: '🏗️', render: renderExpansion },
  { id: 'staff', name: 'Staff', icon: '👥', render: renderStaff },
  { id: 'bank', name: 'Bank', icon: '🏦', render: renderBank },
];

/** Máy tính dạng desktop giả lập. */
export class Computer {
  private root: HTMLElement | null = null;
  private winHost!: HTMLElement;
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
      this.clock = h('span');
      this.balance = h('span');
      const icons = h('div', { class: 'pc-icons' }, APPS.map((a) => h('button', {
        class: 'pc-icon', onClick: () => this.openApp(a.id),
      }, [h('div', { class: 'pc-icon-img', text: a.icon }), h('div', { text: a.name })])));
      this.root = h('div', { class: 'pc-overlay' }, [
        h('div', { class: 'pc-screen' }, [
          h('div', { class: 'pc-desktop' }, [icons, this.winHost]),
          h('div', { class: 'pc-taskbar' }, [
            h('button', { class: 'pc-start', text: '🏪 MiniMart OS' }),
            this.balance,
            this.clock,
            h('button', { class: 'btn small danger', text: '⏻ Tắt máy (Esc)', onClick: () => this.close() }),
          ]),
        ]),
      ]);
      uiRoot().append(this.root);
      requestAnimationFrame(() => this.root?.classList.add('show'));
      this.offs.push(this.s.bus.on('money:changed', () => this.renderTaskbar()));
      this.renderTaskbar();
    }
    if (app) this.openApp(app);
  }

  private renderTaskbar(): void {
    this.clock.textContent = `Ngày ${this.s.data.day} · ${formatClock(this.s.data.minutes)}`;
    this.balance.textContent = `Số dư: ${money(this.s.data.money)}`;
  }

  openApp(id: AppId): void {
    const def = APPS.find((a) => a.id === id);
    if (!def || !this.root) return;
    this.current = id;
    this.s.bus.emit('sound', { name: 'click' });
    clear(this.winHost);
    const body = h('div', { class: 'win-body' });
    const win = h('div', { class: 'window app-window' }, [
      h('div', { class: 'win-title' }, [
        h('span', { text: `${def.icon} ${def.name}` }),
        h('button', { class: 'win-close', text: '✕', onClick: () => { clear(this.winHost); this.current = null; } }),
      ]),
      body,
    ]);
    this.winHost.append(win);
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
