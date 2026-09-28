import { DARK_THRESHOLD, REP_TOO_DARK } from '../config/constants';
import type { Services } from '../core/Services';
import type { CustomerWorld } from './Customer';

/** Khách vừa bước vào: cửa hàng đóng hoặc tối om thì quay về (trả câu khách nói); null = vào mua. */
export function entryRefusal(s: Services, world: CustomerWorld): string | null {
  if (!s.data.storeOpen) return 'Đóng cửa rồi à... 😕';
  if (world.brightness() < DARK_THRESHOLD) {
    s.data.stats.walkouts += 1;
    s.progression.changeReputation(REP_TOO_DARK);
    return '😨 Tối om vậy, thôi về...';
  }
  return null;
}
