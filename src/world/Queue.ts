import { QUEUE_MAX_TILES, QUEUE_SPACING_CELLS } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { counterTiles, type GridPoint } from './Footprint';
import type { NavGrid } from './NavGrid';

/**
 * Các điểm xếp hàng của quầy: bắt đầu ở ô khách đứng, đi theo hướng mặt trước (cách nhau QUEUE_SPACING_CELLS ô),
 * gặp vật cản thì rẽ ngang. Luôn nằm trong cửa hàng và tránh lối cửa.
 */
export function computeQueueTiles(grid: NavGrid, counter: FurnitureData): GridPoint[] {
  const t = counterTiles(getFurniture(counter.type), counter.gx, counter.gy, counter.rot);
  const used = new Set<string>();
  const door = grid.doorInside;
  const ok = (p: GridPoint) =>
    grid.isStoreInterior(p.gx, p.gy) && grid.isWalkable(p.gx, p.gy) && !used.has(`${p.gx},${p.gy}`)
    && !(Math.abs(p.gx - door.gx) <= 2 && p.gy >= door.gy - 1);
  if (!ok(t.customer)) return [t.customer];
  const out: GridPoint[] = [t.customer];
  used.add(`${t.customer.gx},${t.customer.gy}`);
  let cur = t.customer;
  let dir = t.dir;
  const step = QUEUE_SPACING_CELLS;
  while (out.length < QUEUE_MAX_TILES) {
    const perp = [{ gx: dir.gy, gy: -dir.gx }, { gx: -dir.gy, gy: dir.gx }];
    let moved = false;
    for (const d of [dir, ...perp]) {
      const n = { gx: cur.gx + d.gx * step, gy: cur.gy + d.gy * step };
      const mid = { gx: cur.gx + d.gx, gy: cur.gy + d.gy };
      if (ok(n) && grid.isWalkable(mid.gx, mid.gy)) {
        cur = n;
        dir = d;
        out.push(n);
        used.add(`${n.gx},${n.gy}`);
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return out;
}
