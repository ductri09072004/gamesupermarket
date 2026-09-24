import { QUEUE_MAX_TILES } from '../config/constants';
import type { FurnitureData } from '../core/GameState';
import { counterTiles } from '../iso/Footprint';
import type { IsoGrid } from '../iso/IsoGrid';
import type { GridPoint } from '../iso/IsoMath';

/**
 * Các ô xếp hàng của quầy: bắt đầu ở ô khách đứng, đi theo hướng mặt trước,
 * gặp vật cản thì rẽ ngang. Luôn nằm trong cửa hàng.
 */
export function computeQueueTiles(grid: IsoGrid, counter: FurnitureData): GridPoint[] {
  const t = counterTiles(counter.gx, counter.gy, counter.rot);
  const out: GridPoint[] = [];
  const used = new Set<string>();
  const ok = (p: GridPoint) =>
    grid.isStoreInterior(p.gx, p.gy) && grid.isWalkable(p.gx, p.gy) && !used.has(`${p.gx},${p.gy}`)
    && !(p.gx === grid.doorInside.gx && p.gy === grid.doorInside.gy);
  if (!ok(t.customer)) return [t.customer];
  let cur = t.customer;
  let dir = t.dir;
  out.push(cur);
  used.add(`${cur.gx},${cur.gy}`);
  while (out.length < QUEUE_MAX_TILES) {
    const perp = [{ gx: dir.gy, gy: -dir.gx }, { gx: -dir.gy, gy: dir.gx }];
    const options = [dir, ...perp];
    let moved = false;
    for (const d of options) {
      const n = { gx: cur.gx + d.gx, gy: cur.gy + d.gy };
      if (ok(n)) {
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

export { counterTiles };
