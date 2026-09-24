import { LICENSES } from '../../config/licenses';
import { PRODUCTS } from '../../config/products';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

export function renderLicenses(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const list = h('div', { class: 'card-grid' });
  for (const l of LICENSES) {
    const st = s.shop.licenseStatus(l.id);
    const products = PRODUCTS.filter((p) => p.licenseId === l.id).map((p) => p.icon).join(' ');
    const label = st === 'owned' ? '✔ Đã sở hữu' : st === 'locked-level' ? `🔒 Cần cấp ${l.levelRequired}` : st === 'locked-prev' ? '🔒 Cần giấy phép trước' : `Mua ${money(l.price)}`;
    list.append(h('div', { class: `shop-card ${st === 'owned' ? 'owned' : st !== 'available' ? 'locked' : ''}` }, [
      h('div', { class: 'shop-icon', text: l.icon }),
      h('b', { text: l.name }),
      h('div', { class: 'muted small', text: l.description }),
      h('div', { class: 'emoji-row', text: products }),
      h('button', {
        class: 'btn primary', text: label, disabled: st !== 'available' || !s.economy.canAfford(l.price),
        onClick: () => {
          const r = s.shop.buyLicense(l.id);
          if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          else s.bus.emit('sound', { name: 'levelup' });
          ctx.rerender();
        },
      }),
    ]));
  }
  body.append(h('p', { class: 'muted', text: `Cấp cửa hàng hiện tại: ${s.data.level}. Tăng cấp bằng doanh thu (XP = doanh thu / 10).` }), list);
}
