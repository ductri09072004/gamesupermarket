import { bus, type EventBus, type GameEvents } from './EventBus';
import { GameState, type SaveData } from './GameState';
import { mulberry32, type Rng } from './Random';
import { SaveSystem } from './SaveSystem';
import { NavGrid } from '../world/NavGrid';
import { PathCache } from '../world/Pathfinding';
import { footprintCells } from '../world/Footprint';
import { getFurniture, isPassable } from '../config/furniture';
import { TimeSystem } from '../systems/TimeSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { OrderSystem } from '../systems/OrderSystem';
import { StaffSystem } from '../systems/StaffSystem';
import { VehicleSystem } from '../systems/VehicleSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { DaySystem } from '../systems/DaySystem';
import { CleanlinessSystem } from '../systems/CleanlinessSystem';
import { marketPrice } from '../systems/PricingSystem';

/** Gom toàn bộ system của một ván chơi. UI & scene truy cập qua getServices(). */
export class Services {
  readonly state: GameState;
  readonly bus: EventBus<GameEvents> = bus;
  readonly rng: Rng;
  readonly grid: NavGrid;
  readonly paths: PathCache;
  readonly time: TimeSystem;
  readonly economy: EconomySystem;
  readonly progression: ProgressionSystem;
  readonly inventory: InventorySystem;
  readonly orders: OrderSystem;
  readonly vehicles: VehicleSystem;
  /** Điểm đặt thùng mua sỉ ở kho (World 3D gán khi dựng thành phố) */
  padSpots: () => Array<{ gx: number; gy: number }> = () => [];
  readonly staff: StaffSystem;
  readonly shop: ShopSystem;
  readonly day: DaySystem;
  readonly cleanliness: CleanlinessSystem;
  readonly saves = new SaveSystem();
  /** Số khách hiện có trong cửa hàng (do CustomerManager cập nhật). */
  customerCount = 0;

  constructor(data: SaveData) {
    this.state = new GameState(data);
    this.rng = mulberry32(data.seed + data.day * 7919);
    this.grid = new NavGrid(data.storeW, data.storeH, data.warehouseUnlocked);
    this.syncOccupancy();
    this.paths = new PathCache(this.grid);
    this.time = new TimeSystem(this.state, this.bus);
    this.economy = new EconomySystem(this.state, this.bus);
    this.progression = new ProgressionSystem(this.state, this.bus);
    this.inventory = new InventorySystem(this.state, this.bus);
    this.orders = new OrderSystem(this.state, this.bus, this.economy, this.inventory, this.rng, () => this.grid.deliverySpots(), () => this.grid.crateSpots());
    this.staff = new StaffSystem(this.state, this.bus, this.rng);
    this.shop = new ShopSystem(this.state, this.bus, this.economy, this.orders);
    this.vehicles = new VehicleSystem(this.state, this.bus, this.economy);
    this.cleanliness = new CleanlinessSystem(this.state, this.bus, this.rng, this.progression);
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
    g.clearOccupancy();
    for (const f of this.data.furniture) {
      const def = getFurniture(f.type);
      if (!isPassable(def)) g.occupy(footprintCells(def, f.gx, f.gy, f.rot), f.uid);
    }
  }

  save(): boolean {
    const ok = this.saves.save(this.snapshot());
    if (ok) this.bus.emit('game:saved', {});
    return ok;
  }

  /** Bản sao để lưu: thùng đang cầm được đặt xuống sàn. */
  snapshot(): SaveData {
    const copy = JSON.parse(JSON.stringify(this.data)) as SaveData;
    // thùng nội thất đang bê → đặt xuống chỗ người chơi đứng
    for (const k of copy.crates) if (k.held) Object.assign(k, { held: false, x: copy.player.gx, z: copy.player.gy });
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
