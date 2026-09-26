import { getFurniture } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { frontTiles, type GridPoint } from './Footprint';
import { cellCenter, type NavGrid } from './NavGrid';
import { furnitureCenter } from './Placement';

/** Các ô đứng trước mặt kệ (đi được, trong cửa hàng) để lấy hàng. */
export function shelfFrontGoals(grid: NavGrid, shelves: FurnitureData[]): GridPoint[] {
  const goals: GridPoint[] = [];
  for (const f of shelves) {
    for (const t of frontTiles(getFurniture(f.type), f.gx, f.gy, f.rot)) {
      if (grid.isWalkable(t.gx, t.gy) && grid.isStoreInterior(t.gx, t.gy)) goals.push(t);
    }
  }
  return goals;
}

/** Kệ gần ô `end` nhất (ô đích A* đã chọn). */
export function nearestFurniture(shelves: FurnitureData[], end: GridPoint): FurnitureData {
  const ec = cellCenter(end.gx, end.gy);
  const d = (f: FurnitureData) => {
    const c = furnitureCenter(f);
    return Math.hypot(c.x - ec.x, c.z - ec.z);
  };
  return shelves.reduce((best, f) => (d(f) < d(best) ? f : best), shelves[0]);
}
