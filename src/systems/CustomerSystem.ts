import {
  BASE_CUSTOMERS_PER_HOUR, EARLY_MULT, INITIAL_STORE_H, INITIAL_STORE_W, MAX_REPUTATION, MAX_WISH, MIN_WISH,
  PEAK_HOURS, PEAK_MULT,
} from '../config/constants';
import type { ProductDef } from '../config/products';
import type { Rng } from '../core/Random';
import { randInt } from '../core/Random';

export function peakFactor(hour: number): number {
  for (const [a, b] of PEAK_HOURS) if (hour >= a && hour < b) return PEAK_MULT;
  if (hour < 10) return EARLY_MULT;
  if (hour >= 20) return 0.8;
  return 1;
}

export function reputationFactor(rep: number): number {
  return 0.35 + (rep / MAX_REPUTATION) * 1.3;
}

export function areaFactor(storeW: number, storeH: number): number {
  return Math.sqrt((storeW * storeH) / (INITIAL_STORE_W * INITIAL_STORE_H));
}

/** Số khách mỗi giờ game. */
export function spawnRatePerHour(hour: number, rep: number, storeW: number, storeH: number): number {
  return BASE_CUSTOMERS_PER_HOUR * peakFactor(hour) * reputationFactor(rep) * areaFactor(storeW, storeH);
}

export interface Wish {
  productId: string;
  qty: number;
}

/**
 * Danh sách mong muốn 1–6 món, chỉ gồm sản phẩm đã mở khoá.
 * Ưu tiên (70%) sản phẩm đang có trên kệ để trải nghiệm công bằng.
 */
export function generateWishlist(unlocked: ProductDef[], stocked: string[], rng: Rng): Wish[] {
  if (unlocked.length === 0) return [];
  const n = Math.min(randInt(rng, MIN_WISH, MAX_WISH), unlocked.length);
  const stockedSet = new Set(stocked);
  const pool = [...unlocked];
  const out: Wish[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const inStock = pool.filter((p) => stockedSet.has(p.id));
    const src = inStock.length > 0 && rng() < 0.7 ? inStock : pool;
    const p = src[Math.floor(rng() * src.length)];
    pool.splice(pool.indexOf(p), 1);
    out.push({ productId: p.id, qty: rng() < 0.75 ? 1 : randInt(rng, 2, 3) });
  }
  return out;
}

/** Bộ tích luỹ sinh khách theo tốc độ (khách / giờ game). */
export class SpawnAccumulator {
  private acc = 0;
  constructor(private rng: Rng) {}

  /** gameMinutes: số phút game đã trôi. Trả về số khách cần sinh. */
  tick(gameMinutes: number, ratePerHour: number): number {
    this.acc += (ratePerHour / 60) * gameMinutes * (0.6 + this.rng() * 0.8);
    let n = 0;
    while (this.acc >= 1) {
      this.acc -= 1;
      n++;
    }
    return n;
  }

  reset(): void {
    this.acc = 0;
  }
}
