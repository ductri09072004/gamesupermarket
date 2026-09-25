import {
  INITIAL_STORE_H, INITIAL_STORE_W, OPEN_MINUTE, SAVE_VERSION, START_MONEY, START_REPUTATION,
} from '../config/constants';
import { getFurniture } from '../config/furniture';
import { PRODUCTS } from '../config/products';

export interface SlotData {
  productId: string | null;
  qty: number;
}

export interface FurnitureData {
  uid: string;
  type: string;
  gx: number;
  gy: number;
  rot: number;
  slots: SlotData[];
  /** Kệ kho: uid các thùng đang nằm trên kệ */
  boxes: string[];
}

export type BoxLocation = 'floor' | 'held' | 'rack' | 'staff';

/** Thùng hàng. gx/gy là toạ độ world (m) theo X/Z. */
export interface BoxData {
  uid: string;
  productId: string;
  qty: number;
  open: boolean;
  gx: number;
  gy: number;
  location: BoxLocation;
  holderId: string | null;
}

export interface OrderData {
  id: string;
  items: Array<{ productId: string; boxes: number }>;
  remainingMs: number;
  total: number;
}

export type StaffRole = 'cashier' | 'stocker';

export interface StaffData {
  uid: string;
  name: string;
  role: StaffRole;
  wage: number;
  speed: number;
  shirt: number;
}

export interface Transaction {
  day: number;
  minutes: number;
  amount: number;
  label: string;
  balance: number;
}

export interface DayStats {
  revenue: number;
  cogs: number;
  customers: number;
  walkouts: number;
  itemsSold: number;
  changeLoss: number;
  purchases: number;
  repStart: number;
  xpGained: number;
}

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  muted: boolean;
  music: boolean;
  gameOverEnabled: boolean;
  cameraFollow: boolean;
  quality: Quality;
  fov: number;
  sensitivity: number;
  headbob: boolean;
  volMaster: number;
  volSfx: number;
  volMusic: number;
  volAmbient: number;
}

export interface SaveData {
  version: number;
  seed: number;
  nextUid: number;
  money: number;
  day: number;
  minutes: number;
  speed: number;
  level: number;
  xp: number;
  reputation: number;
  storeOpen: boolean;
  storeW: number;
  storeH: number;
  warehouseUnlocked: boolean;
  expansions: number;
  licenses: number[];
  prices: Record<string, number>;
  furniture: FurnitureData[];
  boxes: BoxData[];
  orders: OrderData[];
  furnitureStock: string[];
  staff: StaffData[];
  transactions: Transaction[];
  debtDays: number;
  stats: DayStats;
  settings: Settings;
  tutorial: Record<string, boolean>;
  /** Vị trí người chơi (m) và hướng nhìn */
  player: { gx: number; gy: number; yaw: number };
  gameOver: boolean;
}

export function emptyStats(rep: number): DayStats {
  return {
    revenue: 0, cogs: 0, customers: 0, walkouts: 0, itemsSold: 0,
    changeLoss: 0, purchases: 0, repStart: rep, xpGained: 0,
  };
}

export function makeFurniture(uid: string, type: string, gx: number, gy: number, rot = 0): FurnitureData {
  const def = getFurniture(type);
  const slots: SlotData[] = def.kind === 'display'
    ? Array.from({ length: def.slots }, () => ({ productId: null, qty: 0 }))
    : [];
  return { uid, type, gx, gy, rot, slots, boxes: [] };
}

export function createNewState(seed = Date.now() % 1_000_000): SaveData {
  const prices: Record<string, number> = {};
  for (const p of PRODUCTS) prices[p.id] = p.marketPrice;
  // Toạ độ theo ô NavGrid 0.5m. Cửa hàng 12m × 10m = 24 × 20 ô, cửa ở x = 4..7, z = 20.
  const layout: Array<[string, number, number, number]> = [
    ['shelf_large', 3, 1, 0],
    ['shelf_large', 10, 1, 0],
    ['fridge', 22, 5, 3],
    ['checkout', 9, 13, 0],
    ['computer', 0, 5, 1],
    ['trash', 1, 17, 0],
  ];
  const furniture = layout.map(([type, gx, gy, rot], i) => makeFurniture(`f${i + 1}`, type, gx, gy, rot));
  return {
    version: SAVE_VERSION,
    seed,
    nextUid: 100,
    money: START_MONEY,
    day: 1,
    minutes: OPEN_MINUTE,
    speed: 1,
    level: 1,
    xp: 0,
    reputation: START_REPUTATION,
    storeOpen: false,
    storeW: INITIAL_STORE_W,
    storeH: INITIAL_STORE_H,
    warehouseUnlocked: false,
    expansions: 0,
    licenses: [0],
    prices,
    furniture,
    boxes: [],
    orders: [],
    furnitureStock: [],
    staff: [],
    transactions: [],
    debtDays: 0,
    stats: emptyStats(START_REPUTATION),
    settings: {
      muted: false, music: true, gameOverEnabled: true, cameraFollow: true, quality: 'medium', fov: 70, sensitivity: 1,
      headbob: true, volMaster: 0.8, volSfx: 1, volMusic: 0.5, volAmbient: 0.6,
    },
    tutorial: {},
    player: { gx: 3, gy: 8, yaw: 0 },
    gameOver: false,
  };
}

/** State trung tâm — nguồn sự thật duy nhất. */
export class GameState {
  constructor(public data: SaveData) {}

  newUid(prefix: string): string {
    this.data.nextUid += 1;
    return `${prefix}${this.data.nextUid}`;
  }

  furniture(uid: string): FurnitureData | undefined {
    return this.data.furniture.find((f) => f.uid === uid);
  }

  box(uid: string): BoxData | undefined {
    return this.data.boxes.find((b) => b.uid === uid);
  }

  hasLicense(id: number): boolean {
    return this.data.licenses.includes(id);
  }

  unlockedProducts() {
    return PRODUCTS.filter((p) => this.hasLicense(p.licenseId));
  }

  priceOf(productId: string): number {
    return this.data.prices[productId] ?? 0;
  }
}
