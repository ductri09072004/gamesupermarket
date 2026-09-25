import { WAREHOUSE_LEVEL, WAREHOUSE_PRICE } from '../../config/constants';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

export function renderExpansion(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const d = s.data;
  const next = s.shop.nextPack();
  const cards = h('div', { class: 'card-grid' });
  if (next) {
    const lockedLevel = !s.state.levelAtLeast(next.levelRequired);
    cards.append(h('div', { class: `shop-card ${lockedLevel ? 'locked' : ''}` }, [
      h('div', { class: 'shop-icon', text: '🏗️' }),
      h('b', { text: `Gói mở rộng #${next.index + 1}` }),
      h('div', { class: 'muted small', text: `${next.axis === 'cols' ? '+2 cột' : '+2 hàng'} → ${next.sizeAfter.w}×${next.sizeAfter.h} ô` }),
      h('div', { class: 'muted small', text: 'Khách tới đông hơn, nhưng tiền thuê tăng theo diện tích.' }),
      h('button', {
        class: 'btn primary', text: lockedLevel ? `🔒 Cần cấp ${next.levelRequired}` : `Mua ${money(next.price)}`,
        disabled: lockedLevel || !s.economy.canAfford(next.price),
        onClick: () => {
          const r = s.shop.buyExpansion();
          if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          else ctx.closePc();
        },
      }),
    ]));
  } else {
    cards.append(h('div', { class: 'shop-card owned' }, [h('div', { class: 'shop-icon', text: '🏬' }), h('b', { text: 'Đã mở rộng tối đa!' })]));
  }
  const whLocked = !s.state.levelAtLeast(WAREHOUSE_LEVEL);
  cards.append(h('div', { class: `shop-card ${d.warehouseUnlocked ? 'owned' : whLocked ? 'locked' : ''}` }, [
    h('div', { class: 'shop-icon', text: '🏚️' }),
    h('b', { text: 'Kho phía sau' }),
    h('div', { class: 'muted small', text: 'Khu 5×5 ô có cửa riêng, đặt Kệ kho để chứa thùng hàng.' }),
    h('button', {
      class: 'btn primary',
      text: d.warehouseUnlocked ? '✔ Đã mở' : whLocked ? `🔒 Cần cấp ${WAREHOUSE_LEVEL}` : `Mua ${money(WAREHOUSE_PRICE)}`,
      disabled: d.warehouseUnlocked || whLocked || !s.economy.canAfford(WAREHOUSE_PRICE),
      onClick: () => {
        const r = s.shop.buyWarehouse();
        if (!r.ok) s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
        else ctx.closePc();
      },
    }),
  ]));
  body.append(h('p', { class: 'muted', text: `Diện tích hiện tại: ${d.storeW}×${d.storeH} ô (tối đa 24×20). Nội thất được giữ nguyên khi mở rộng.` }), cards);
}
