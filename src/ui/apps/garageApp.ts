import { getVariant, variantsOf } from '../../config/fleet';
import { VEHICLES, vehicleDef } from '../../config/vehicles';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

/** Kiểu xe đang chọn để mua theo loại xe (giữ khi vẽ lại giao diện) */
const picked = new Map<string, string>();

/** Garage: mua xe máy / ô tô / bán tải (chọn kiểu xe cổ); gọi xe đang kẹt về bãi đỗ cạnh cửa hàng. */
export function renderGarage(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const cards = VEHICLES.map((base) => {
    const owned = s.data.vehicles.find((v) => v.type === base.id);
    const kinds = variantsOf(base.id);
    const kind = getVariant(base.id, owned?.variant ?? picked.get(base.id));
    const def = vehicleDef({ type: base.id, variant: kind?.id });
    const price = Math.round(base.price * (kind?.priceMul ?? 1));
    const lockedLevel = !s.state.levelAtLeast(base.levelRequired);
    const cap = def.countBySize ? `${def.capacity} suất (thùng cồng kềnh = 2)` : `${def.capacity} thùng`;
    const chips = !owned && kinds.length > 1
      ? h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, kinds.map((k) => h('button', {
        class: `btn small ${k.id === kind?.id ? 'primary' : ''}`, text: k.name,
        onClick: () => { picked.set(base.id, k.id); ctx.rerender(); },
      })))
      : null;
    const action = owned
      ? h('button', {
        class: 'btn block', text: '📍 Gọi về bãi đỗ',
        onClick: () => { s.bus.emit('vehicle:recall', { uid: owned.uid }); ctx.rerender(); },
      })
      : h('button', {
        class: 'btn primary block', disabled: lockedLevel || !s.economy.canAfford(price),
        text: lockedLevel ? `🔒 Cần cấp ${base.levelRequired}` : `Mua ${money(price)}`,
        onClick: () => { s.bus.emit('vehicle:buy', { type: base.id, variant: kind?.id }); s.bus.emit('sound', { name: 'coin' }); ctx.rerender(); },
      });
    return h('div', { class: `product-card ${owned ? 'in-cart' : ''}` }, [
      h('div', { class: 'swatch big', text: base.icon, style: { background: '#e8eef5' } }),
      h('div', { class: 'pc-name', text: def.name }),
      chips,
      h('div', { class: 'muted small', text: def.description }),
      h('div', { class: 'pc-price', text: `Chở: ${cap}` }),
      h('div', { class: 'muted small', text: `Tối đa ${Math.round(base.maxSpeed * 3.6)} km/h` }),
      owned ? h('div', { class: 'muted small', text: `✔ Đã sở hữu · đang chở ${owned.cargo.length} thùng` }) : null,
      action,
    ]);
  });
  body.append(
    h('div', { class: 'muted', text: 'Lái xe tới KHO SỈ (khối nhà bên phải, sau ngã tư) để mua hàng rẻ hơn 20% và chở về. E: lên xe · G: dỡ thùng.' }),
    h('div', { class: 'market-grid' }, cards),
  );
}
