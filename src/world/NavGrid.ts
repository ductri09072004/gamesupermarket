import { CELL, DOOR_WIDTH, DOOR_X, MAX_STORE_H, MAX_STORE_W, SIDEWALK_DEPTH, WAREHOUSE } from '../config/constants';
import type { GridPoint } from './Footprint';

export type TileType = 'grass' | 'road' | 'sidewalk' | 'floor' | 'warehouse' | 'wall' | 'door';
export type Zone = 'store' | 'warehouse' | 'outside';

export interface Tile {
  type: TileType;
  zone: Zone;
  occupiedBy: string | null;
}

export interface WalkGrid {
  version: number;
  isWalkable(gx: number, gy: number): boolean;
}

const WALKABLE: Record<TileType, boolean> = {
  grass: false, road: false, sidewalk: true, floor: true, warehouse: true, wall: false, door: true,
};

export const m2c = (m: number): number => Math.round(m / CELL);

/** Tâm ô → toạ độ world (m). */
export function cellCenter(gx: number, gy: number): { x: number; z: number } {
  return { x: (gx + 0.5) * CELL, z: (gy + 0.5) * CELL };
}

export function worldToCell(x: number, z: number): GridPoint {
  return { gx: Math.floor(x / CELL), gy: Math.floor(z / CELL) };
}

/**
 * Lưới đi lại 0.5m cho A*. Cửa hàng chiếm các ô [0, sw) × [0, sd); phía trước (+Z) là vỉa hè,
 * phía sau (-Z) là kho (mở khoá sau).
 */
export class NavGrid implements WalkGrid {
  static readonly MIN_X = -16;
  static readonly MIN_Y = m2c(WAREHOUSE.z0) - 2;
  static readonly MAX_X = m2c(MAX_STORE_W) + 16;
  static readonly MAX_Y = m2c(MAX_STORE_H + SIDEWALK_DEPTH) + 12;
  readonly width = NavGrid.MAX_X - NavGrid.MIN_X + 1;
  readonly height = NavGrid.MAX_Y - NavGrid.MIN_Y + 1;
  version = 0;
  sw = 0;
  sd = 0;
  private tiles: Tile[] = [];

  constructor(public storeW: number, public storeH: number, public warehouse: boolean) {
    this.rebuild(storeW, storeH, warehouse);
  }

  private idx(gx: number, gy: number): number {
    return (gy - NavGrid.MIN_Y) * this.width + (gx - NavGrid.MIN_X);
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= NavGrid.MIN_X && gx <= NavGrid.MAX_X && gy >= NavGrid.MIN_Y && gy <= NavGrid.MAX_Y;
  }

  get(gx: number, gy: number): Tile | null {
    return this.inBounds(gx, gy) ? this.tiles[this.idx(gx, gy)] : null;
  }

  private set(gx: number, gy: number, type: TileType, zone: Zone): void {
    if (!this.inBounds(gx, gy)) return;
    const t = this.tiles[this.idx(gx, gy)];
    t.type = type;
    t.zone = zone;
  }

  get doorCells(): GridPoint[] {
    const x0 = m2c(DOOR_X - DOOR_WIDTH / 2);
    const x1 = m2c(DOOR_X + DOOR_WIDTH / 2);
    const out: GridPoint[] = [];
    for (let x = x0; x < x1; x++) out.push({ gx: x, gy: this.sd });
    return out;
  }

  get warehouseDoorCells(): GridPoint[] {
    const x = m2c(WAREHOUSE.x0 + WAREHOUSE.doorX);
    return [{ gx: x - 1, gy: -1 }, { gx: x, gy: -1 }];
  }

  rebuild(storeW: number, storeH: number, warehouse: boolean): void {
    this.storeW = storeW;
    this.storeH = storeH;
    this.warehouse = warehouse;
    const sw = m2c(storeW);
    const sd = m2c(storeH);
    this.sw = sw;
    this.sd = sd;
    const old = this.tiles;
    this.tiles = Array.from({ length: this.width * this.height }, () => ({ type: 'grass' as TileType, zone: 'outside' as Zone, occupiedBy: null }));
    const walkDepth = m2c(SIDEWALK_DEPTH);
    for (let gx = NavGrid.MIN_X; gx <= NavGrid.MAX_X; gx++) {
      for (let gy = sd + 1; gy <= sd + walkDepth; gy++) this.set(gx, gy, 'sidewalk', 'outside');
      for (let gy = sd + walkDepth + 1; gy <= Math.min(sd + walkDepth + 12, NavGrid.MAX_Y); gy++) this.set(gx, gy, 'road', 'outside');
    }
    for (let gx = 0; gx < sw; gx++) for (let gy = 0; gy < sd; gy++) this.set(gx, gy, 'floor', 'store');
    for (let gx = -1; gx <= sw; gx++) {
      this.set(gx, -1, 'wall', 'store');
      this.set(gx, sd, 'wall', 'store');
    }
    for (let gy = -1; gy <= sd; gy++) {
      this.set(-1, gy, 'wall', 'store');
      this.set(sw, gy, 'wall', 'store');
    }
    for (const d of this.doorCells) this.set(d.gx, d.gy, 'door', 'store');
    if (warehouse) {
      const x0 = m2c(WAREHOUSE.x0);
      const x1 = m2c(WAREHOUSE.x0 + WAREHOUSE.w);
      const y0 = m2c(WAREHOUSE.z0);
      for (let gx = x0; gx < x1; gx++) for (let gy = y0; gy < -1; gy++) this.set(gx, gy, 'warehouse', 'warehouse');
      for (let gx = x0 - 1; gx <= x1; gx++) this.set(gx, y0 - 1, 'wall', 'warehouse');
      for (let gy = y0 - 1; gy < -1; gy++) {
        this.set(x0 - 1, gy, 'wall', 'warehouse');
        this.set(x1, gy, 'wall', 'warehouse');
      }
      for (const d of this.warehouseDoorCells) this.set(d.gx, d.gy, 'door', 'warehouse');
    }
    if (old.length === this.tiles.length) {
      for (let i = 0; i < old.length; i++) {
        if (old[i].occupiedBy && WALKABLE[this.tiles[i].type]) this.tiles[i].occupiedBy = old[i].occupiedBy;
      }
    }
    this.version++;
  }

  isWalkable(gx: number, gy: number): boolean {
    const t = this.get(gx, gy);
    return !!t && WALKABLE[t.type] && !t.occupiedBy;
  }

  isFloorType(gx: number, gy: number): boolean {
    const t = this.get(gx, gy);
    return !!t && WALKABLE[t.type];
  }

  isStoreInterior(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < this.sw && gy < this.sd;
  }

  isWarehouseInterior(gx: number, gy: number): boolean {
    return this.get(gx, gy)?.type === 'warehouse';
  }

  occupy(cells: GridPoint[], uid: string): void {
    for (const c of cells) {
      const t = this.get(c.gx, c.gy);
      if (t) t.occupiedBy = uid;
    }
    this.version++;
  }

  free(uid: string): void {
    for (const t of this.tiles) if (t.occupiedBy === uid) t.occupiedBy = null;
    this.version++;
  }

  clearOccupancy(): void {
    for (const t of this.tiles) t.occupiedBy = null;
    this.version++;
  }

  occupant(gx: number, gy: number): string | null {
    return this.get(gx, gy)?.occupiedBy ?? null;
  }

  /** Ô ngay bên trong cửa ra vào (giữa cửa). */
  get doorInside(): GridPoint {
    const d = this.doorCells;
    return { gx: d[Math.floor(d.length / 2)].gx, gy: this.sd - 1 };
  }

  get doorOutside(): GridPoint {
    return { gx: this.doorInside.gx, gy: this.sd + 1 };
  }

  get warehouseDoor(): GridPoint {
    return this.warehouseDoorCells[1];
  }

  /** Vị trí biển Mở/Đóng cửa (m). */
  get signPosition(): { x: number; z: number } {
    return { x: DOOR_X + DOOR_WIDTH / 2 + 0.55, z: this.storeH };
  }

  spawnPoints(): GridPoint[] {
    const y = this.sd + 3;
    return [{ gx: NavGrid.MIN_X + 1, gy: y }, { gx: Math.min(this.sw + 14, NavGrid.MAX_X - 1), gy: y }];
  }

  /** Điểm giao hàng trên vỉa hè (m). */
  deliverySpots(): Array<{ gx: number; gy: number }> {
    const z = this.storeH + 0.9;
    return [0, 1, 2, 3, 4, 5].map((i) => ({ gx: DOOR_X + DOOR_WIDTH / 2 + 0.8 + (i % 3) * 0.75, gy: z + Math.floor(i / 3) * 0.75 }));
  }

  forEach(fn: (gx: number, gy: number, t: Tile) => void): void {
    for (let gy = NavGrid.MIN_Y; gy <= NavGrid.MAX_Y; gy++) {
      for (let gx = NavGrid.MIN_X; gx <= NavGrid.MAX_X; gx++) fn(gx, gy, this.tiles[this.idx(gx, gy)]);
    }
  }
}
