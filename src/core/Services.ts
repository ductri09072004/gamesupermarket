import { bus, type EventBus, type GameEvents } from './EventBus';
import { GameState, type SaveData } from './GameState';
import { mulberry32, type Rng } from './Random';
import { SaveSystem } from './SaveSystem';
import { IsoGrid } from '../iso/IsoGrid';
import { PathCache } from '../iso/Pathfinding';
import { footprintCells } from '../iso/Footprint';
import { getFurniture } from '../config/furniture';
import { TimeSystem } from '../systems/TimeSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { OrderSystem } from '../systems/OrderSystem';
import { StaffSystem } from '../systems/StaffSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { DaySystem } from '../systems/DaySystem';
import { marketPrice } from '../systems/PricingSystem';

/** Gom toàn bộ system của một ván chơi. UI & scene truy cập qua getServices(). */
export class Services {
  readonly state: GameState;
  readonly bus: EventBus<GameEvents> = bus;
  readonly rng: Rng;
  readonly grid: IsoGrid;
  readonly paths: PathCache;
  readonly time: TimeSystem;
  readonly economy: EconomySystem;
  readonly progression: ProgressionSystem;
  readonly inventory: InventorySystem;
  readonly orders: OrderSystem;
  readonly staff: StaffSystem;
  readonly shop: ShopSystem;
  readonly day: DaySystem;
  readonly saves = new SaveSystem();
  /** Số khách hiện có trong cửa hàng (do CustomerManager cập nhật). */
  customerCount = 0;

  constructor(data: SaveData) {
    this.state = new GameState(data);
    this.rng = mulberry32(data.seed + data.day * 7919);
    this.grid = new IsoGrid(data.storeW, data.storeH, data.warehouseUnlocked);
    this.syncOccupancy();
    this.paths = new PathCache(this.grid);
    this.time = new TimeSystem(this.state, this.bus);
    this.economy = new EconomySystem(this.state, this.bus);
    this.progression = new ProgressionSystem(this.state, this.bus);
    this.inventory = new InventorySystem(this.state, this.bus);
    this.orders = new OrderSystem(this.state, this.bus, this.economy, this.inventory, this.rng, () => this.grid.deliveryTiles());
    this.staff = new StaffSystem(this.state, this.bus, this.rng);
    this.shop = new ShopSystem(this.state, this.bus, this.economy);
    this.day = new DaySystem(this);
  }

  get data(): SaveData {
    return this.state.data;
  }

  market(productId: string): number {
    return marketPrice(productId, this.data.day, this.data.seed);
  }

  rebuildGrid(): void {
    const d = this.data;
    this.grid.rebuild(d.storeW, d.storeH, d.warehouseUnlocked);
    this.syncOccupancy();
  }

  syncOccupancy(): void {
    const g = this.grid;
    g.forEach((_x, _y, t) => { t.occupiedBy = null; });
    for (const f of this.data.furniture) g.occupy(footprintCells(getFurniture(f.type), f.gx, f.gy, f.rot), f.uid);
  }

  save(): boolean {
    const ok = this.saves.save(this.snapshot());
    if (ok) this.bus.emit('game:saved', {});
    return ok;
  }

  /** Bản sao để lưu: thùng đang cầm được đặt xuống sàn. */
  snapshot(): SaveData {
    const copy = JSON.parse(JSON.stringify(this.data)) as SaveData;
    for (const b of copy.boxes) {
      if (b.location === 'held' || b.location === 'staff') {
        b.location = 'floor';
        b.holderId = null;
      }
    }
    return copy;
  }
}

let current: Services | null = null;

export function setServices(s: Services | null): void {
  current = s;
}

export function getServices(): Services {
  if (!current) throw new Error('Services not initialised');
  return current;
}

export function hasServices(): boolean {
  return current !== null;
}
