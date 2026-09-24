import { getProduct } from '../config/products';
import type { Services } from '../core/Services';
import { round2 } from '../core/Random';
import { buyProbability, clampPrice, isLoss, profitMargin } from '../systems/PricingSystem';
import { h, money } from './dom';

/** Bộ chỉnh giá 1 sản phẩm: giá vốn, thị trường, ô nhập, nút nhanh, % lợi nhuận, cảnh báo lỗ. */
export function priceEditor(s: Services, productId: string, compact = false): HTMLElement {
  const p = getProduct(productId);
  const market = s.market(productId);
  const input = h('input', { class: 'price-input', attrs: { type: 'number', step: '0.01', min: '0.01' } });
  const info = h('div', { class: 'price-info' });
  const row = h('div', { class: `price-row ${compact ? 'compact' : ''}` });

  const render = () => {
    const price = s.state.priceOf(productId);
    input.value = price.toFixed(2);
    const margin = profitMargin(price, p.costPerUnit);
    const ratio = price / market;
    const prob = buyProbability(ratio);
    const loss = isLoss(price, p.costPerUnit);
    info.className = `price-info ${loss ? 'loss' : ratio > 1.5 ? 'expensive' : ''}`;
    info.innerHTML = `
      <span>Lãi: <b>${(margin * 100).toFixed(0)}%</b> (${money(price - p.costPerUnit)}/món)</span>
      <span>Khách mua: <b>${Math.round(prob * 100)}%</b></span>
      ${loss ? '<span class="warn">⚠ Đang bán LỖ!</span>' : ''}
      ${ratio > 1.5 ? '<span class="warn">⚠ Quá đắt — không ai mua</span>' : ''}`;
  };

  const set = (v: number) => {
    const price = clampPrice(v);
    s.data.prices[productId] = price;
    s.bus.emit('price:changed', { productId, price });
    s.bus.emit('tutorial:done', { step: 'price' });
    render();
  };

  input.addEventListener('change', () => set(parseFloat(input.value)));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') set(parseFloat(input.value));
    e.stopPropagation();
  });
  const quick = (label: string, fn: () => number) => h('button', { class: 'btn tiny', text: label, onClick: () => set(fn()) });
  const cur = () => s.state.priceOf(productId);
  row.append(
    h('div', { class: 'price-head' }, [
      h('span', { class: 'swatch', text: p.icon, style: { background: p.color } }),
      h('div', {}, [
        h('b', { text: p.name }),
        h('div', { class: 'muted', text: `Vốn ${money(p.costPerUnit)} · Thị trường ${money(market)}` }),
      ]),
    ]),
    h('div', { class: 'price-controls' }, [
      quick('−0.1', () => round2(cur() - 0.1)),
      input,
      quick('+0.1', () => round2(cur() + 0.1)),
      quick('= TT', () => market),
      quick('+10%', () => round2(market * 1.1)),
      quick('+20%', () => round2(market * 1.2)),
    ]),
    info,
  );
  render();
  return row;
}
