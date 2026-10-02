import { VND_PER_UNIT } from '../config/constants';
/** Bộ sinh số ngẫu nhiên có seed (mulberry32). */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Số đồng có dấu chấm ngăn nghìn: 1.234.500 (số nội bộ × VND_PER_UNIT). */
export function formatVnd(n: number): string {
  return Math.abs(Math.round(n * VND_PER_UNIT)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatMoney(n: number): string {
  const sign = Math.round(n * VND_PER_UNIT) < 0 ? '-' : '';
  return `${sign}${formatVnd(n)}đ`;
}
