import { getFurniture, type FurnitureDef } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { counterTiles, footprintCells } from '../iso/Footprint';
import type { IsoGrid, WalkGrid } from '../iso/IsoGrid';
import type { GridPoint } from '../iso/IsoMath';
import { findPath } from '../iso/Pathfinding';

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
}

/** Lưới ảo: giả lập đặt thêm vật cản để kiểm tra đường đi. */
class OverlayGrid implements WalkGrid {
  version = 0;
  constructor(private base: IsoGrid, private blocked: Set<string>, private ignoreUid: string | null) {}
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
      const t = counterTiles(f.gx, f.gy, f.rot);
      out.push([t.staff], [t.customer]);
    }
  }
  return out;
}

export function canPlace(
  grid: IsoGrid,
  def: FurnitureDef,
  gx: number,
  gy: number,
  rot: number,
  furniture: FurnitureData[],
  ignoreUid: string | null = null,
  extraBlocked: GridPoint[] = [],
): PlaceCheck {
  const cells = footprintCells(def, gx, gy, rot);
  for (const c of cells) {
    const inStore = grid.isStoreInterior(c.gx, c.gy);
    const inWarehouse = grid.isWarehouseInterior(c.gx, c.gy);
    if (def.warehouseOnly ? !inWarehouse : !inStore) {
      return { ok: false, reason: def.warehouseOnly ? 'Chỉ đặt được trong kho' : 'Phải đặt bên trong cửa hàng' };
    }
    const occ = grid.occupant(c.gx, c.gy);
    if (occ && occ !== ignoreUid) return { ok: false, reason: 'Ô đã có đồ' };
    const door = grid.doorInside;
    if (c.gx === door.gx && c.gy === door.gy) return { ok: false, reason: 'Không được chặn cửa ra vào' };
    const wd = grid.warehouseDoor;
    if (grid.warehouse && Math.abs(c.gx - wd.gx) + Math.abs(c.gy - wd.gy) === 1) {
      return { ok: false, reason: 'Không được chặn cửa kho' };
    }
    if (extraBlocked.some((b) => b.gx === c.gx && b.gy === c.gy)) return { ok: false, reason: 'Có người đang đứng đây' };
  }
  const blocked = new Set(cells.map((c) => `${c.gx},${c.gy}`));
  const overlay = new OverlayGrid(grid, blocked, ignoreUid);
  const targets = requiredTargets(furniture, ignoreUid);
  if (def.kind === 'checkout') {
    const t = counterTiles(gx, gy, rot);
    targets.push([t.staff], [t.customer]);
  }
  const start = grid.doorInside;
  for (const tg of targets) {
    if (!findPath(overlay, start, tg)) return { ok: false, reason: 'Sẽ chặn đường từ cửa tới quầy thu ngân' };
  }
  if (grid.warehouse && !findPath(overlay, start, { gx: 0, gy: grid.warehouseDoor.gy })) {
    return { ok: false, reason: 'Sẽ chặn đường vào kho' };
  }
  return { ok: true };
}
