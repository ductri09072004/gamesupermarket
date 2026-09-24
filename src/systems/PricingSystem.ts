import { PRICE_FLUCTUATION } from '../config/constants';
import { getProduct, type ProductDef } from '../config/products';
import { hashString, mulberry32, round2 } from '../core/Random';

/**
 * ratio = sellPrice / marketPrice
 * ≤ 1.0 → 100%; 1.0–1.5 → giảm tuyến tính 100% → 20%; > 1.5 → 0%.
 */
export function buyProbability(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  if (ratio <= 1) return 1;
  if (ratio <= 1.5) return 1 - ((ratio - 1) / 0.5) * 0.8;
  return 0;
}

export type PurchaseDecision = 'buy' | 'expensive' | 'skip';

export function decidePurchase(sellPrice: number, marketPrice: number, roll: number): PurchaseDecision {
  const ratio = sellPrice / marketPrice;
  if (ratio > 1.5) return 'expensive';
  return roll < buyProbability(ratio) ? 'buy' : 'skip';
}

/** Giá thị trường dao động ±5% mỗi ngày, xác định bởi seed + ngày + sản phẩm. */
export function marketPriceOn(product: ProductDef, day: number, seed: number): number {
  const rng = mulberry32(hashString(`${seed}:${day}:${product.id}`));
  const f = (rng() * 2 - 1) * PRICE_FLUCTUATION;
  return round2(product.marketPrice * (1 + f));
}

export function marketPrice(productId: string, day: number, seed: number): number {
  return marketPriceOn(getProduct(productId), day, seed);
}

/** % lợi nhuận trên giá vốn. */
export function profitMargin(sellPrice: number, cost: number): number {
  return cost === 0 ? 0 : (sellPrice - cost) / cost;
}

export function isLoss(sellPrice: number, cost: number): boolean {
  return sellPrice < cost;
}

export function clampPrice(p: number): number {
  if (!Number.isFinite(p)) return 0.01;
  return Math.max(0.01, Math.min(999, round2(p)));
}
