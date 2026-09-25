import { getFurniture, isCeiling, type FurnitureDef } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { counterTiles, footprintCells, type GridPoint } from '../world/Footprint';
import type { NavGrid, WalkGrid } from '../world/NavGrid';
import { findPath } from '../world/Pathfinding';

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** Lưới ảo: giả lập đặt thêm vật cản để kiểm tra đường đi. */
class OverlayGrid implements WalkGrid {
  version = 0;
  constructor(private base: NavGrid, private blocked: Set<string>, private ignoreUid: string | null) {}
  isWalkable(gx: number, gy: number): boolean {
    if (this.blocked.has(`${gx},${gy}`)) return false;
    const t = this.base.get(gx, gy);
    if (!t) return false;
    if (t.occupiedBy && t.occupiedBy === this.ignoreUid) return this.base.isFloorType(gx, gy);
    return this.base.isWalkable(gx, gy);
  }
}

/** Các điểm bắt buộc phải tới được từ cửa (ô sau/trước quầy, máy tính...). */
export function requiredTargets(furniture: FurnitureData[], ignoreUid: string | null): GridPoint[][] {
  const out: GridPoint[][] = [];
  for (const f of furniture) {
    if (f.uid === ignoreUid) continue;
    const def = getFurniture(f.type);
    if (def.kind === 'checkout') {
      const t = counterTiles(def, f.gx, f.gy, f.rot);
      out.push([t.staff], [t.customer]);
    }
    if (def.kind === 'selfcheckout') out.push([counterTiles(def, f.gx, f.gy, f.rot).customer]);
  }
  return out;
}

export function canPlace(
  grid: NavGrid,
  def: FurnitureDef,
  gx: number,
  gy: number,
  rot: number,
  furniture: FurnitureData[],
  ignoreUid: string | null = null,
  extraBlocked: GridPoint[] = [],
): PlaceCheck {
  const cells = footprintCells(def, gx, gy, rot);
  if (isCeiling(def)) return canPlaceCeiling(grid, cells, furniture, ignoreUid);
  for (const c of cells) {
    const inStore = grid.isStoreInterior(c.gx, c.gy);
    const inWarehouse = grid.isWarehouseInterior(c.gx, c.gy);
    if (def.warehouseOnly ? !inWarehouse : !inStore) {
      return { ok: false, reason: def.warehouseOnly ? 'Chỉ đặt được trong kho' : 'Phải đặt bên trong cửa hàng' };
    }
    const occ = grid.occupant(c.gx, c.gy);
    if (occ && occ !== ignoreUid) return { ok: false, reason: 'Ô đã có đồ' };
    if (grid.doorCells.some((d) => Math.abs(c.gx - d.gx) <= 1 && d.gy - c.gy <= 2 && d.gy - c.gy >= 0)) {
      return { ok: false, reason: 'Không được chặn cửa ra vào' };
    }
    if (grid.warehouse && grid.warehouseDoorCells.some((d) => Math.abs(c.gx - d.gx) <= 1 && Math.abs(c.gy - d.gy) <= 2)) {
      return { ok: false, reason: 'Không được chặn cửa kho' };
    }
    if (extraBlocked.some((b) => b.gx === c.gx && b.gy === c.gy)) return { ok: false, reason: 'Có người đang đứng đây' };
  }
  const blocked = new Set(cells.map((c) => `${c.gx},${c.gy}`));
  const overlay = new OverlayGrid(grid, blocked, ignoreUid);
  const targets = requiredTargets(furniture, ignoreUid);
  if (def.kind === 'checkout') {
    const t = counterTiles(def, gx, gy, rot);
    targets.push([t.staff], [t.customer]);
  }
  if (def.kind === 'selfcheckout') targets.push([counterTiles(def, gx, gy, rot).customer]);
  const start = grid.doorInside;
  for (const tg of targets) {
    if (!findPath(overlay, start, tg)) return { ok: false, reason: 'Sẽ chặn đường từ cửa tới quầy thu ngân' };
  }
  if (grid.warehouse && !findPath(overlay, start, { gx: grid.warehouseDoor.gx, gy: 0 })) {
    return { ok: false, reason: 'Sẽ chặn đường vào kho' };
  }
  return { ok: true };
}

/** Đèn trần: nằm trong cửa hàng/kho, không chồng lên đèn khác (không chiếm sàn, không chặn đường). */
function canPlaceCeiling(grid: NavGrid, cells: GridPoint[], furniture: FurnitureData[], ignoreUid: string | null): PlaceCheck {
  for (const c of cells) {
    if (!grid.isStoreInterior(c.gx, c.gy) && !grid.isWarehouseInterior(c.gx, c.gy)) return { ok: false, reason: 'Phải gắn trên trần cửa hàng' };
  }
  const taken = new Set<string>();
  for (const f of furniture) {
    if (f.uid === ignoreUid) continue;
    const d = getFurniture(f.type);
    if (isCeiling(d)) for (const p of footprintCells(d, f.gx, f.gy, f.rot)) taken.add(`${p.gx},${p.gy}`);
  }
  if (cells.some((c) => taken.has(`${c.gx},${c.gy}`))) return { ok: false, reason: 'Trùng chỗ đèn khác' };
  return { ok: true };
}
