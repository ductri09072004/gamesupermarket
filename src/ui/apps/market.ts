import { getFurniture, type StorageType } from '../../config/furniture';
import { PRODUCTS, boxCost } from '../../config/products';
import { acceptsProduct } from '../../systems/SlotLayout';
import { getLicense } from '../../config/licenses';
import { cartBoxes, cartTotal, type Cart } from '../../systems/OrderSystem';
import type { AppContext } from '../computer';
import { h, money } from '../dom';

const cart: Cart = {};

const STORAGE_LABEL: Record<StorageType, string> = {
  shelf: 'Kệ', fridge: 'Tủ lạnh', freezer: 'Tủ đông', clothing: 'Giá treo', electronics: 'Tủ kính',
};

export function renderMarket(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const grid = h('div', { class: 'market-grid' });
  const categories = [...new Set(PRODUCTS.map((p) => p.category))];
  for (const cat of categories) {
    grid.append(h('div', { class: 'market-cat', text: cat }));
    for (const p of PRODUCTS.filter((x) => x.category === cat)) {
      const unlocked = s.state.hasLicense(p.licenseId);
      const n = cart[p.id] ?? 0;
      const setN = (v: number) => {
        cart[p.id] = Math.max(0, Math.min(99, v));
        if (cart[p.id] === 0) delete cart[p.id];
        ctx.rerender();
      };
      grid.append(h('div', { class: `product-card ${unlocked ? '' : 'locked'} ${n > 0 ? 'in-cart' : ''}` }, [
        h('div', { class: 'swatch big', text: unlocked ? p.icon : '🔒', style: { background: p.color } }),
        h('div', { class: 'pc-name', text: p.name }),
        h('div', { class: 'muted', text: `${p.unitsPerBox} món/thùng · ${STORAGE_LABEL[p.storage]}${acceptsProduct(getFurniture('vending'), p) ? ' · 🥤 máy bán hàng' : ''}` }),
        h('div', { class: 'pc-price', text: `${money(boxCost(p))}/thùng` }),
        h('div', { class: 'muted small', text: `Vốn ${money(p.costPerUnit)} · TT ${money(s.market(p.id))}` }),
        unlocked
          ? h('div', { class: 'qty' }, [
            h('button', { class: 'btn tiny', text: '−', onClick: () => setN(n - 1) }),
            h('span', { class: 'qty-n', text: String(n) }),
            h('button', { class: 'btn tiny', text: '+', onClick: () => setN(n + 1) }),
          ])
          : h('div', { class: 'muted small', text: `Cần giấy phép "${getLicense(p.licenseId).name}"` }),
      ]));
    }
  }
  const total = cartTotal(cart);
  const canBuy = total > 0 && s.economy.canAfford(total);
  const lines = Object.entries(cart).map(([id, n]) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    return h('div', { class: 'cart-line' }, [h('span', { text: `${p.icon} ${p.name} ×${n}` }), h('b', { text: money(boxCost(p) * n) })]);
  });
  const orders = s.data.orders.map((o) => h('div', { class: 'cart-line muted' }, [
    h('span', { text: `🚚 ${o.items.reduce((a, i) => a + i.boxes, 0)} thùng` }),
    h('span', { text: `~${Math.ceil(o.remainingMs / 1000)}s` }),
  ]));
  const side = h('div', { class: 'cart' }, [
    h('h3', { text: '🛒 Giỏ hàng' }),
    ...(lines.length ? lines : [h('div', { class: 'muted', text: 'Chưa có gì trong giỏ' })]),
    h('div', { class: 'cart-total' }, [h('span', { text: `${cartBoxes(cart)} thùng` }), h('b', { text: money(total) })]),
    h('button', {
      class: 'btn primary block', text: canBuy ? 'Mua' : total > 0 ? 'Không đủ tiền' : 'Mua', disabled: !canBuy,
      onClick: () => {
        const r = s.orders.placeOrder(cart);
        if (!r.ok) {
          s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          return;
        }
        for (const k of Object.keys(cart)) delete cart[k];
        s.bus.emit('toast', { message: '✅ Đã đặt hàng! Thùng sẽ được giao tới vỉa hè trong giây lát.', kind: 'success' });
        s.bus.emit('sound', { name: 'coin' });
        s.bus.emit('tutorial:done', { step: 'order' });
        ctx.rerender();
      },
    }),
    h('button', { class: 'btn block', text: 'Xoá giỏ', onClick: () => { for (const k of Object.keys(cart)) delete cart[k]; ctx.rerender(); } }),
    orders.length ? h('h4', { text: 'Đang giao' }) : null,
    ...orders,
  ]);
  body.append(h('div', { class: 'market' }, [grid, side]));
}
