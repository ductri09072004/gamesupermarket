import { getFurniture } from '../config/furniture';
import type { Services } from '../core/Services';
import { slotCapacity } from '../systems/SlotLayout';
import { h, uiRoot } from './dom';
import { priceEditor } from './priceEditor';

/** Bảng giá nhỏ nổi cạnh tâm ngắm (mở bằng súng dán giá: nhìn nhãn giá + E). */
export function openPricePanel(s: Services, furnitureUid: string, slot: number | undefined, onClose: () => void): () => void {
  const f = s.state.furniture(furnitureUid);
  if (!f) {
    onClose();
    return () => {};
  }
  const def = getFurniture(f.type);
  const ids = slot !== undefined && f.slots[slot]?.productId
    ? [f.slots[slot].productId!]
    : [...new Set(f.slots.map((x) => x.productId).filter((x): x is string => !!x))];
  const close = () => {
    root.remove();
    window.removeEventListener('keydown', onKey, true);
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || (e.code === 'KeyE' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT')) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  const body = h('div', { class: 'fp-body' });
  if (ids.length === 0) body.append(h('p', { class: 'muted', text: 'Kệ chưa có sản phẩm. Cầm thùng đã mở, nhìn vào slot và click trái để xếp hàng.' }));
  for (const id of ids) {
    const qty = f.slots.reduce((a, x) => a + (x.productId === id ? x.qty : 0), 0);
    body.append(h('div', { class: 'muted small', text: `Trên kệ: ${qty} món · sức chứa slot ${slotCapacity(f.type, id)}` }), priceEditor(s, id));
  }
  const root = h('div', { class: 'float-panel' }, [
    h('div', { class: 'fp-head' }, [h('b', { text: `🏷️ ${def.name}` }), h('button', { class: 'win-close', text: '✕', onClick: close })]),
    body,
    h('div', { class: 'muted small', text: 'Enter để lưu · Esc hoặc E để đóng' }),
  ]);
  uiRoot().append(root);
  const input = root.querySelector('input');
  setTimeout(() => input?.select(), 30);
  return close;
}
