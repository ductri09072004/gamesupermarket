import { VEHICLES } from '../../config/vehicles';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

/** Garage: mua xe máy / ô tô / bán tải; gọi xe đang kẹt về bãi đỗ cạnh cửa hàng. */
export function renderGarage(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const cards = VEHICLES.map((def) => {
    const owned = s.data.vehicles.find((v) => v.type === def.id);
    const lockedLevel = s.data.level < def.levelRequired;
    const cap = def.countBySize ? `${def.capacity} suất (thùng cồng kềnh = 2)` : `${def.capacity} thùng`;
    const action = owned
      ? h('button', {
        class: 'btn block', text: '📍 Gọi về bãi đỗ',
        onClick: () => { s.bus.emit('vehicle:recall', { uid: owned.uid }); ctx.rerender(); },
      })
      : h('button', {
        class: 'btn primary block', disabled: lockedLevel || !s.economy.canAfford(def.price),
        text: lockedLevel ? `🔒 Cần cấp ${def.levelRequired}` : `Mua ${money(def.price)}`,
        onClick: () => { s.bus.emit('vehicle:buy', { type: def.id }); ctx.rerender(); },
      });
    return h('div', { class: `product-card ${owned ? 'in-cart' : ''}` }, [
      h('div', { class: 'swatch big', text: def.icon, style: { background: '#e8eef5' } }),
      h('div', { class: 'pc-name', text: def.name }),
      h('div', { class: 'muted small', text: def.description }),
      h('div', { class: 'pc-price', text: `Chở: ${cap}` }),
      h('div', { class: 'muted small', text: `Tối đa ${Math.round(def.maxSpeed * 3.6)} km/h` }),
      owned ? h('div', { class: 'muted small', text: `✔ Đã sở hữu · đang chở ${owned.cargo.length} thùng` }) : null,
      action,
    ]);
  });
  body.append(
    h('div', { class: 'muted', text: 'Lái xe tới KHO SỈ (khối nhà bên phải, sau ngã tư) để mua hàng rẻ hơn 20% và chở về. E: lên xe · G: dỡ thùng.' }),
    h('div', { class: 'market-grid' }, cards),
  );
}
