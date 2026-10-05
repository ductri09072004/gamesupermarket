import { FURNITURE } from '../../config/furniture';
import { getLicense } from '../../config/licenses';
import type { FurnitureCart } from '../../systems/ShopSystem';
import type { AppContext } from '../computer';
import { h, money } from '../dom';
import { furnitureImg } from '../productThumb';

/** Giỏ nội thất (giữ khi vẽ lại giao diện): loại → số lượng */
const cart: FurnitureCart = {};

function detailOf(def: (typeof FURNITURE)[number]): string {
  return def.kind === 'display'
    ? `${def.tiers} tầng × ${def.columns} ngăn`
    : def.kind === 'rack' ? `Chứa ${def.slots} thùng · chỉ đặt trong kho` : def.kind === 'checkout' ? 'Khách xếp hàng thanh toán'
      : def.kind === 'selfcheckout' ? 'Khách tự quét & trả tiền · có khách cần hỗ trợ'
        : def.kind === 'lamp' ? `Gắn trần · chiếu sáng ~${def.light?.area ?? 0} m²`
          : def.kind === 'gate' ? 'Đặt ở cửa · hú còi khi khách mang hàng chưa trả tiền đi qua'
            : def.kind === 'altar' ? 'Thắp nhang mỗi ngày: khách đông hơn, uy tín tăng nhẹ' : 'Vứt thùng rỗng';
}

/** Nội thất: thêm vào giỏ như hàng hoá, bấm Mua mới trả tiền; xe tải giao thùng tới trước cửa hàng. */
export function renderFurniture(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  const list = FURNITURE.filter((f) => f.buyable && !f.legacy);
  const grid = h('div', { class: 'market-grid' });
  for (const def of list) {
    const owned = s.data.furnitureStock.filter((t) => t === def.id).length;
    const locked = !s.state.hasLicense(def.licenseRequired) || (def.warehouseOnly && !s.data.warehouseUnlocked);
    const n = cart[def.id] ?? 0;
    const setN = (v: number) => {
      cart[def.id] = Math.max(0, Math.min(20, v));
      if (cart[def.id] === 0) delete cart[def.id];
      ctx.rerender();
    };
    grid.append(h('div', { class: `product-card ${locked ? 'locked' : ''} ${n > 0 ? 'in-cart' : ''}` }, [
      h('div', { class: 'pc-photo' }, [furnitureImg(def.id, 96, locked, def.icon)]),
      h('div', { class: 'pc-name', text: def.name }),
      h('div', { class: 'muted small', text: `${def.size.w}×${def.size.d}m · ${detailOf(def)}` }),
      def.electricity > 0 ? h('div', { class: 'muted small', text: `⚡ ${money(def.electricity)}/ngày` }) : null,
      h('div', { class: 'pc-price', text: money(def.price) }),
      owned ? h('div', { class: 'tag', text: `Trong kho: ${owned}` }) : null,
      locked
        ? h('div', { class: 'muted small', text: def.warehouseOnly && !s.data.warehouseUnlocked ? '🔒 Cần mở kho' : `🔒 Cần giấy phép ${getLicense(def.licenseRequired).name}` })
        : h('div', { class: 'qty' }, [
          h('button', { class: 'btn tiny', text: '−', onClick: () => setN(n - 1) }),
          h('span', { class: 'qty-n', text: String(n) }),
          h('button', { class: 'btn tiny', text: '+', onClick: () => setN(n + 1) }),
        ]),
    ]));
  }
  const total = s.shop.furnitureCartTotal(cart);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const canBuy = total > 0 && s.economy.canAfford(total);
  const lines = Object.entries(cart).map(([type, n]) => {
    const def = FURNITURE.find((f) => f.id === type)!;
    return h('div', { class: 'cart-line' }, [h('span', { class: 'cart-prod' }, [furnitureImg(type, 26, false, def.icon), ` ${def.name} ×${n}`]), h('b', { text: money(def.price * n) })]);
  });
  const side = h('div', { class: 'cart' }, [
    h('h3', { text: '🛒 Giỏ nội thất' }),
    ...(lines.length ? lines : [h('div', { class: 'muted', text: 'Chưa có gì trong giỏ' })]),
    h('div', { class: 'cart-total' }, [h('span', { text: `${count} món` }), h('b', { text: money(total) })]),
    h('button', {
      class: 'btn primary block', text: canBuy ? 'Mua' : total > 0 ? 'Không đủ tiền' : 'Mua', disabled: !canBuy,
      onClick: () => {
        const r = s.shop.buyFurnitureCart(cart);
        if (!r.ok) {
          s.bus.emit('toast', { message: r.reason ?? 'Lỗi', kind: 'error' });
          return;
        }
        for (const k of Object.keys(cart)) delete cart[k];
        s.bus.emit('sound', { name: 'coin' });
        s.bus.emit('toast', { message: '🚚 Đã đặt mua nội thất — xe tải sẽ chở thùng tới trước cửa hàng', kind: 'success' });
        ctx.rerender();
      },
    }),
    h('button', { class: 'btn block', text: 'Xoá giỏ', onClick: () => { for (const k of Object.keys(cart)) delete cart[k]; ctx.rerender(); } }),
    s.data.orders.some((o) => o.furniture?.length)
      ? h('h4', { text: 'Đang giao' })
      : null,
    ...s.data.orders.filter((o) => o.furniture?.length).map((o) => h('div', { class: 'cart-line muted' }, [
      h('span', { text: `🚚 ${o.furniture!.length} thùng nội thất` }),
      h('span', { text: `~${Math.ceil(o.remainingMs / 1000)}s` }),
    ])),
  ]);
  body.append(
    h('p', { class: 'muted', text: 'Nội thất được xe tải giao tới trước cửa hàng dạng thùng: click bê thùng rồi nhìn chỗ muốn đặt, lăn chuột để xoay, click để lắp. Nhìn vào đồ có sẵn + M để dời chỗ.' }),
    h('div', { class: 'market' }, [grid, side]),
  );
}
