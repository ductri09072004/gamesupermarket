import { getFurniture } from '../config/furniture';
import type { Services } from '../core/Services';
import { h, modal } from './dom';
import { priceEditor } from './priceEditor';

/** Bảng giá khi click vào kệ. */
export function openPricePanel(s: Services, furnitureUid: string, onClose: () => void): () => void {
  const f = s.state.furniture(furnitureUid);
  if (!f) {
    onClose();
    return () => {};
  }
  const def = getFurniture(f.type);
  const ids = [...new Set(f.slots.map((x) => x.productId).filter((x): x is string => !!x))];
  const body = h('div', { class: 'price-panel' });
  if (ids.length === 0) {
    body.append(h('p', { class: 'muted', text: 'Kệ chưa có sản phẩm. Cầm thùng hàng đã mở tới kệ và nhấn E để xếp hàng.' }));
  }
  f.slots.forEach((slot, i) => {
    body.append(h('div', { class: 'slot-line muted', text: `Slot ${i + 1}: ${slot.productId ? `${slot.qty}/${def.slotCapacity} món` : 'trống'}` }));
  });
  for (const id of ids) body.append(priceEditor(s, id));
  const m = modal(`🏷️ Giá bán — ${def.name}`, body, { onClose });
  return m.close;
}
