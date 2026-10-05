import {
  CELL, DEV_MONEY, INITIAL_STORE_H, INITIAL_STORE_W, OPEN_MINUTE, SAVE_VERSION, START_MONEY, START_REPUTATION, STORE_FRONT_Z,
} from '../config/constants';

/** Hàng ô sau cùng (gy nhỏ nhất) của tiệm lúc mới chơi: tiệm nằm sát mặt tiền nên toạ độ nội thất tính từ hàng này */
const STARTER_BACK_ROW = Math.round((STORE_FRONT_Z - INITIAL_STORE_H) / CELL);
import { getFurniture } from '../config/furniture';
import { LICENSES } from '../config/licenses';
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

export type BoxLocation = 'floor' | 'held' | 'rack' | 'staff' | 'vehicle';

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
  /** Tư thế sau khi bị vật lý xô đổ (thùng trên sàn): độ cao tâm + quaternion. Không có → đặt thẳng, chồng theo vị trí */
  pose?: { y: number; q: [number, number, number, number] };
}

/** Xe người chơi sở hữu. x/z/yaw: vị trí world (m, rad); cargo: uid thùng đang chở. */
export interface VehicleData {
  uid: string;
  type: string;
  /** Kiểu xe đã chọn khi mua (config/fleet.ts); thiếu → kiểu đầu tiên của loại */
  variant?: string;
  x: number;
  z: number;
  yaw: number;
  cargo: string[];
}

export interface OrderData {
  id: string;
  items: Array<{ productId: string; boxes: number }>;
  /** Nội thất đã mua — giao tới dạng thùng lắp đặt */
  furniture?: string[];
  remainingMs: number;
  total: number;
  /** Đã có xe tải đang chạy tới giao (không lưu ý nghĩa qua lần tải game) */
  dispatched?: boolean;
}

/** Thùng nội thất (giao bằng xe tải), bê vào rồi lắp đặt ở góc nhìn thứ nhất. held: người chơi đang bê. */
export interface CrateData {
  uid: string;
  type: string;
  x: number;
  z: number;
  held?: boolean;
}

export type StaffRole = 'cashier' | 'stocker' | 'helper' | 'cleaner' | 'guard';

/** Chất bẩn: rác trên sàn, vết đổ trên sàn, vết bẩn trên cửa kính mặt tiền. Toạ độ m. */
export type DirtKind = 'litter' | 'spill' | 'smudge';

export interface DirtData {
  uid: string;
  kind: DirtKind;
  x: number;
  z: number;
  /** Góc xoay / biến thể hình (trang trí) */
  seed: number;
}

/** Món hàng rơi trên sàn (văng ra từ khách trộm), chờ nhặt về kệ. */
export interface LooseItem {
  uid: string;
  productId: string;
  x: number;
  z: number;
}

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
  /** Số món khách mua ngoài hàng rong thay vì trong cửa hàng */
  vendorLost: number;
}

/** lite = siêu nhẹ (máy yếu): không đổ bóng, không hậu kỳ, dựng ở độ phân giải thấp, ít xe / người */
export type Quality = 'lite' | 'low' | 'medium' | 'high';

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

/** Khoản vay ngân hàng: lãi đơn theo ngày, trả cả gốc + lãi khi đáo hạn (hoặc tất toán sớm). */
export interface LoanData {
  id: string;
  principal: number;
  dailyRate: number;
  termDays: number;
  startDay: number;
  dueDay: number;
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
  /** Các khoản vay còn nợ */
  loans: LoanData[];
  stats: DayStats;
  settings: Settings;
  tutorial: Record<string, boolean>;
  /** Vị trí người chơi (m) và hướng nhìn */
  player: { gx: number; gy: number; yaw: number };
  gameOver: boolean;
  vehicles: VehicleData[];
  dirt: DirtData[];
  loose: LooseItem[];
  crates: CrateData[];
  /** Công tắc đèn trong cửa hàng */
  lightsOn: boolean;
  /** Chế độ developer: nhiều tiền, bỏ qua giới hạn cấp độ */
  devMode: boolean;
  /** Lần thắp nhang Thần Tài gần nhất (ngày, giờ game) */
  incense?: { day: number; hour: number };
}

export function emptyStats(rep: number): DayStats {
  return {
    revenue: 0, cogs: 0, customers: 0, walkouts: 0, itemsSold: 0,
    changeLoss: 0, purchases: 0, repStart: rep, xpGained: 0, vendorLost: 0,
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
  // Toạ độ tuyệt đối theo ô NavGrid 0.5m. Tiệm hẻm 8m × 6m nằm sát mặt tiền: x = 0..15, z = b..b+11 (b = hàng ô sau cùng của tiệm).
  // Cửa ở x = 4..7 trên hàng ô ngay sau tiệm; 3 kệ sát tường sau / phải, quầy thu ngân gần cửa.
  const b = STARTER_BACK_ROW;
  const layout: Array<[string, number, number, number]> = [
    ['shelf_hutch', 1, b + 1, 0],
    ['shelf_ladder', 6, b + 1, 0],
    ['fridge_coke', 14, b + 3, 3],
    ['checkout', 10, b + 6, 0],
    ['computer', 0, b + 3, 1],
    ['trash', 0, b + 10, 0],
  ];
  const furniture = [...layout.map(([type, gx, gy, rot], i) => makeFurniture(`f${i + 1}`, type, gx, gy, rot)), ...starterLamps()];
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
    loans: [],
    stats: emptyStats(START_REPUTATION),
    settings: {
      muted: false, music: true, gameOverEnabled: true, cameraFollow: true, quality: 'lite', fov: 70, sensitivity: 1,
      headbob: true, volMaster: 0.8, volSfx: 1, volMusic: 0.5, volAmbient: 0.6,
    },
    tutorial: {},
    // (gx, gy) thực chất là x, z tính bằng mét: trong tiệm, cách cửa kính ~1.7m, nhìn vào trong
    player: { gx: 3.5, gy: STORE_FRONT_Z - 1.7, yaw: 0 },
    gameOver: false,
    vehicles: [],
    dirt: [],
    loose: [],
    crates: [],
    lightsOn: true,
    devMode: false,
  };
}

/** 4 đèn tuýp cơ bản cho cửa hàng mới — muốn sáng hơn thì mua thêm. */
export function starterLamps(prefix = 'L'): FurnitureData[] {
  const b = STARTER_BACK_ROW;
  const at: Array<[number, number]> = [[3, 3], [12, 3], [3, 8], [12, 8]];
  return at.map(([gx, gy], i) => makeFurniture(`${prefix}${i + 1}`, 'lamp_tube', gx, b + gy, 0));
}

/** Ván developer: rất nhiều tiền, mọi giấy phép, không giới hạn cấp độ, không phá sản. */
export function createDevState(seed?: number): SaveData {
  const d = createNewState(seed);
  d.devMode = true;
  d.money = DEV_MONEY;
  d.licenses = LICENSES.map((l) => l.id);
  d.settings.gameOverEnabled = false;
  return d;
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

  /** Đủ cấp chưa (chế độ developer luôn đủ). */
  levelAtLeast(level: number): boolean {
    return this.data.devMode || this.data.level >= level;
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
