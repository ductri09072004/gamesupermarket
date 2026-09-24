import { DOOR_X, MAX_STORE_H, MAX_STORE_W, WAREHOUSE } from '../config/constants';
import type { GridPoint } from './IsoMath';

export type TileType = 'void' | 'grass' | 'road' | 'sidewalk' | 'floor' | 'warehouse' | 'wall' | 'door';
/** back_y: tường trên cạnh gy (sau-phải), back_x: cạnh gx (sau-trái), front_*: tường kính thấp phía trước */
export type WallKind = 'back_y' | 'back_x' | 'front_y' | 'front_x' | 'corner';
export type Zone = 'store' | 'warehouse' | 'outside';

export interface Tile {
  type: TileType;
  wall: WallKind | null;
  zone: Zone;
  occupiedBy: string | null;
}

export interface WalkGrid {
  version: number;
  isWalkable(gx: number, gy: number): boolean;
}

const WALKABLE: Record<TileType, boolean> = {
  void: false, grass: false, road: false, sidewalk: true, floor: true, warehouse: true, wall: false, door: true,
};

export class IsoGrid implements WalkGrid {
  static readonly MIN_X = WAREHOUSE.x0 - 2;
  static readonly MIN_Y = -2;
  static readonly MAX_X = MAX_STORE_W + 6;
  static readonly MAX_Y = MAX_STORE_H + 7;
  readonly width = IsoGrid.MAX_X - IsoGrid.MIN_X + 1;
  readonly height = IsoGrid.MAX_Y - IsoGrid.MIN_Y + 1;
  version = 0;
  private tiles: Tile[] = [];

  constructor(public storeW: number, public storeH: number, public warehouse: boolean) {
    this.rebuild(storeW, storeH, warehouse);
  }

  private idx(gx: number, gy: number): number {
    return (gy - IsoGrid.MIN_Y) * this.width + (gx - IsoGrid.MIN_X);
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= IsoGrid.MIN_X && gx <= IsoGrid.MAX_X && gy >= IsoGrid.MIN_Y && gy <= IsoGrid.MAX_Y;
  }

  get(gx: number, gy: number): Tile | null {
    if (!this.inBounds(gx, gy)) return null;
    return this.tiles[this.idx(gx, gy)];
  }

  private set(gx: number, gy: number, type: TileType, zone: Zone, wall: WallKind | null = null): void {
    if (!this.inBounds(gx, gy)) return;
    const t = this.tiles[this.idx(gx, gy)];
    t.type = type;
    t.zone = zone;
    t.wall = wall;
  }

  rebuild(storeW: number, storeH: number, warehouse: boolean): void {
    this.storeW = storeW;
    this.storeH = storeH;
    this.warehouse = warehouse;
    const old = this.tiles;
    this.tiles = Array.from({ length: this.width * this.height }, () => ({
      type: 'grass' as TileType, wall: null, zone: 'outside' as Zone, occupiedBy: null,
    }));
    const W = storeW;
    const H = storeH;
    // đường & vỉa hè
    for (let gx = IsoGrid.MIN_X; gx <= IsoGrid.MAX_X; gx++) {
      for (let gy = H + 1; gy <= H + 3; gy++) this.set(gx, gy, 'sidewalk', 'outside');
      for (let gy = H + 4; gy <= Math.min(H + 6, IsoGrid.MAX_Y); gy++) this.set(gx, gy, 'road', 'outside');
    }
    // sàn cửa hàng
    for (let gx = 0; gx < W; gx++) for (let gy = 0; gy < H; gy++) this.set(gx, gy, 'floor', 'store');
    // tường sau
    for (let gx = -1; gx < W; gx++) this.set(gx, -1, 'wall', 'store', gx === -1 ? 'corner' : 'back_y');
    for (let gy = 0; gy < H; gy++) this.set(-1, gy, 'wall', 'store', 'back_x');
    // tường kính phía trước + cửa
    for (let gx = 0; gx < W; gx++) {
      if (gx === DOOR_X) this.set(gx, H, 'door', 'store');
      else this.set(gx, H, 'wall', 'store', 'front_y');
    }
    for (let gy = 0; gy < H; gy++) this.set(W, gy, 'wall', 'store', 'front_x');
    this.set(W, H, 'wall', 'store', 'corner');
    this.set(-1, H, 'wall', 'store', 'corner');
    this.set(W, -1, 'wall', 'store', 'corner');
    // kho phía sau
    if (warehouse) {
      const { x0, y0, w, h, doorY } = WAREHOUSE;
      for (let gx = x0; gx < x0 + w; gx++) for (let gy = y0; gy < y0 + h; gy++) this.set(gx, gy, 'warehouse', 'warehouse');
      for (let gx = x0 - 1; gx < x0 + w; gx++) this.set(gx, y0 - 1, 'wall', 'warehouse', gx === x0 - 1 ? 'corner' : 'back_y');
      for (let gy = y0; gy < y0 + h; gy++) this.set(x0 - 1, gy, 'wall', 'warehouse', 'back_x');
      for (let gx = x0; gx < x0 + w; gx++) this.set(gx, y0 + h, 'wall', 'warehouse', 'front_y');
      this.set(x0 - 1, y0 + h, 'wall', 'warehouse', 'corner');
      this.set(-1, doorY, 'door', 'warehouse');
    }
    // giữ lại occupancy cũ ở các ô vẫn đi được
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
    return gx >= 0 && gy >= 0 && gx < this.storeW && gy < this.storeH;
  }

  isWarehouseInterior(gx: number, gy: number): boolean {
    const t = this.get(gx, gy);
    return !!t && t.type === 'warehouse';
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

  occupant(gx: number, gy: number): string | null {
    return this.get(gx, gy)?.occupiedBy ?? null;
  }

  get doorInside(): GridPoint {
    return { gx: DOOR_X, gy: this.storeH - 1 };
  }

  get doorTile(): GridPoint {
    return { gx: DOOR_X, gy: this.storeH };
  }

  get doorOutside(): GridPoint {
    return { gx: DOOR_X, gy: this.storeH + 1 };
  }

  get warehouseDoor(): GridPoint {
    return { gx: -1, gy: WAREHOUSE.doorY };
  }

  get signTile(): GridPoint {
    return { gx: DOOR_X + 1, gy: this.storeH };
  }

  spawnPoints(): GridPoint[] {
    const y = this.storeH + 2;
    return [{ gx: IsoGrid.MIN_X + 1, gy: y }, { gx: Math.min(this.storeW + 5, IsoGrid.MAX_X - 1), gy: y }];
  }

  deliveryTiles(): GridPoint[] {
    const y = this.storeH + 1;
    return [0, 1, 2, 3, 4, 5].map((i) => ({ gx: DOOR_X + 2 + i, gy: i % 2 === 0 ? y : y + 1 }));
  }

  forEach(fn: (gx: number, gy: number, t: Tile) => void): void {
    for (let gy = IsoGrid.MIN_Y; gy <= IsoGrid.MAX_Y; gy++) {
      for (let gx = IsoGrid.MIN_X; gx <= IsoGrid.MAX_X; gx++) fn(gx, gy, this.tiles[this.idx(gx, gy)]);
    }
  }
}
