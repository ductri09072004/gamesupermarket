import { SEASON } from '../config/constants';

/** Dịp Tết: mỗi "năm" (SEASON.yearDays ngày game) có N ngày cuối năm + đầu năm trang trí Tết trong cửa hàng. */
export function tetSeason(day: number): boolean {
  const d = (Math.max(1, day) - 1) % SEASON.yearDays;
  return d >= SEASON.yearDays - SEASON.tetBefore || d < SEASON.tetAfter;
}
