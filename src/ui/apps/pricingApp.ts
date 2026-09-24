import type { AppContext } from '../computer';
import { h } from '../dom';
import { priceEditor } from '../priceEditor';

export function renderPricing(body: HTMLElement, ctx: AppContext): void {
  const { s } = ctx;
  body.append(h('p', { class: 'muted', text: 'Giá thị trường dao động ±5% mỗi ngày. Giá ≤ thị trường: khách luôn mua; > 150%: không ai mua.' }));
  const list = h('div', { class: 'pricing-list' });
  for (const p of s.state.unlockedProducts()) list.append(priceEditor(s, p.id, true));
  body.append(list);
}
