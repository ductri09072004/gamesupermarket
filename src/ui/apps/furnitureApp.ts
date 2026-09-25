import { FURNITURE } from '../../config/furniture';
import { getLicense } from '../../config/licenses';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

export function renderFurniture(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const grid = h('div', { class: 'card-grid' });
  for (const def of FURNITURE.filter((f) => f.buyable)) {
    const check = s.shop.canBuyFurniture(def.id);
    const owned = s.data.furnitureStock.filter((t) => t === def.id).length;
    const locked = !s.state.hasLicense(def.licenseRequired) || (def.warehouseOnly && !s.data.warehouseUnlocked);
    const detail = def.kind === 'display'
      ? `${def.tiers} tầng × ${def.columns} ngăn`
      : def.kind === 'rack' ? `Chứa ${def.slots} thùng · chỉ đặt trong kho` : def.kind === 'checkout' ? 'Khách xếp hàng thanh toán'
        : def.kind === 'selfcheckout' ? 'Khách tự quét & trả tiền · có khách cần hỗ trợ'
          : def.kind === 'lamp' ? `Gắn trần · chiếu sáng ~${def.light?.area ?? 0} m²` : 'Vứt thùng rỗng';
    grid.append(h('div', { class: `shop-card ${locked ? 'locked' : ''}` }, [
      h('div', { class: 'shop-icon', text: def.icon }),
      h('b', { text: def.name }),
      h('div', { class: 'muted small', text: `${def.size.w}×${def.size.d}m · ${detail}` }),
      def.electricity > 0 ? h('div', { class: 'muted small', text: `⚡ ${money(def.electricity)}/ngày` }) : null,
      locked ? h('div', { class: 'muted small', text: def.warehouseOnly && !s.data.warehouseUnlocked ? '🔒 Cần mở kho' : `🔒 Cần giấy phép ${getLicense(def.licenseRequired).name}` }) : null,
      owned ? h('div', { class: 'tag', text: `Trong kho: ${owned}` }) : null,
      h('button', {
        class: 'btn primary', text: `Mua ${money(def.price)}`, disabled: !check.ok,
        onClick: () => {
          const r = s.shop.buyFurniture(def.id);
          if (!r.ok) {
            s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
            return;
          }
          s.bus.emit('sound', { name: 'coin' });
          ctx.closePc();
          s.bus.emit('build:hold', { furnitureId: def.id });
        },
      }),
    ]));
  }
  body.append(h('p', { class: 'muted', text: 'Mua xong sẽ vào chế độ xây dựng để đặt nội thất. Nhấn B bất cứ lúc nào để sắp xếp lại cửa hàng.' }), grid);
}
