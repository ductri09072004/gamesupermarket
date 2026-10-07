import {
  ALLEY, BUILDINGS, CITY_SEED, LAMP_SPACING, MAIN_PARK_STRIP, MAIN_ROAD_WIDTH, PARKED_CARS, ROAD_WIDTH, TREES, TREE_SPACING, WALK_WIDTH,
} from '../config/city';
import { SIDEWALK_DEPTH, WALL_THICKNESS, WAREHOUSE_LOT } from '../config/constants';
import { mulberry32, pick } from '../core/Random';
import type { AABB } from './Colliders';
import { planStreetSigns, type StreetSigns } from './StreetSigns';
import { alleyLife, planAlleys, type Alley, type AlleyDecor } from './Alleys';
import { backfillBlock, oppositeShops, sideShops, tileBlock } from './CityFill';
import { streetLife, type StallArea } from './CityStreetLife';
import { roadDamage, type RoadMark } from './RoadDamage';
import { polePlan, type PoleSpot, type Wire } from './CityWires';
import { STREET_LIFE } from '../config/city';
import { planTrafficSignals, type TrafficSignal } from './TrafficSignals';
import { planCrosswalks, type Crosswalk } from './Crosswalks';

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type PlacementKind = 'building' | 'tree' | 'bush' | 'prop' | 'car';

/** Model đặt trong thành phố. rot: góc quay Y (rad) — model gốc quay mặt +Z. */
export interface Placement {
  kind: PlacementKind;
  model: string;
  x: number;
  z: number;
  rot: number;
  variant: number;
  /** Chữ biển hiệu (cửa hiệu cạnh siêu thị) */
  sign?: string;
  /** Độ cao đặt (m), mặc định 0 — vd. dừa trên mặt bàn */
  y?: number;
  /** Co giãn nhà theo bề ngang / bề sâu (m → hệ số) để lấp khít khối phố; mặc định 1 */
  sx?: number;
  sz?: number;
  /** Chỉ hiện trong khung giờ game [từ, đến) — hàng rong theo giờ */
  hours?: [number, number];
}

export interface Spot {
  x: number;
  z: number;
  yaw: number;
}

/** Trạm xe buýt trên vỉa hè cạnh cửa hàng: mái che (chiếm chỗ), điểm xe buýt đỗ (tâm xe) trên làn sát lề. */
export interface BusStop {
  shelter: Rect;
  bay: { x: number; z: number };
}

export interface CityLayout {
  signals: TrafficSignal[];
  crosswalks: Crosswalk[];
  /** Mặt đường, không chồng nhau (đường dọc cắt ở giao lộ) */
  roads: Rect[];
  /** Chỗ đỗ xe người chơi: dọc vỉa hè trước cửa hàng, trên nửa làn ven lề của đường chính */
  frontSpots: Spot[];
  /** Tim tuyến xe chạy quanh mỗi khối (cùng thứ tự `blocks`): đường chính lệch ra xa lề để chừa dải đỗ xe */
  loopCenters: Rect[];
  /** Biển tên đường, số hẻm và cột biển */
  signs: StreetSigns;
  /** Hẻm nhỏ giữa các nhà (thông hai đầu / cụt / ngõ nhánh), sàn có dốc */
  alleys: Alley[];
  /** Đồ sinh hoạt trong hẻm vẽ bằng code */
  alleyDecor: AlleyDecor[];
  /** Tim đường (vạch giữa): dọc theo X (axis 'x') hoặc Z */
  centerLines: Array<{ axis: 'x' | 'z'; c: number; from: number; to: number }>;
  blocks: Rect[];
  lot: Rect;
  /** Chỗ đỗ trong bãi — 3 chỗ đầu dành cho xe người chơi */
  lotSpots: Spot[];
  depot: { shed: Rect; pad: Rect; kiosk: Spot };
  placements: Placement[];
  colliders: AABB[];
  bounds: Rect;
  /** Tim các đường ngang (Z) — cùng V_ROADS tạo lưới đường cho xe chạy */
  hz: number[];
  /** Vùng sạp hàng rong (không có va chạm vì theo giờ) — cột điện né, người đi bộ bước xuống đường vòng qua */
  stalls: StallArea[];
  /** Miếng vá, nắp cống trên mặt đường */
  damage: RoadMark[];
  /** Cột điện & dây điện chằng chịt */
  wiring: { poles: PoleSpot[]; wires: Wire[] };
  busStop: BusStop;
}

const HALF = ROAD_WIDTH / 2;
const HALF_MAIN = MAIN_ROAD_WIDTH / 2;
export const V_ROADS = [-84, -38, 64, 114];

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;
}

/** Hình chữ nhật chiếm chỗ của model kích thước [w, _, d] khi xoay rot (bội số 90°). */
export function footprint(x: number, z: number, w: number, d: number, rot: number): Rect {
  const q = Math.round(rot / (Math.PI / 2)) & 1;
  const hw = (q ? d : w) / 2;
  const hd = (q ? w : d) / 2;
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}

/** Hình chữ nhật chiếm chỗ của một nhà (đã tính co giãn sx/sz). */
export function houseRect(p: Placement): Rect {
  const [w, , d] = BUILDINGS[p.model];
  return footprint(p.x, p.z, w * (p.sx ?? 1), d * (p.sz ?? 1), p.rot);
}

/** Mép vỉa hè giáp đường (tim đường chính = trước cửa hàng). */
export function curbZ(D: number): number {
  return D + WALL_THICKNESS + SIDEWALK_DEPTH;
}

/**
 * Bố cục phố cố định theo hạt giống, phụ thuộc chiều sâu cửa hàng D (đường chính chạy trước mặt tiền)
 * và chiều rộng W (dãy cửa hiệu bên phải co lại khi mở rộng).
 */
export function cityLayout(D: number, W = 12): CityLayout {
  const rng = mulberry32(CITY_SEED);
  const F = curbZ(D);
  const hz = [-44, F + HALF_MAIN, F + 64];
  // nửa rộng từng đường ngang: đường chính (trước cửa hàng) rộng 1,5 làn
  const halves = [HALF, HALF_MAIN, HALF];
  const xMin = V_ROADS[0] - HALF;
  const xMax = V_ROADS[V_ROADS.length - 1] + HALF;
  const zMin = hz[0] - halves[0];
  const zMax = hz[2] + halves[2];
  const roads: Rect[] = hz.map((c, k) => ({ x0: xMin, x1: xMax, z0: c - halves[k], z1: c + halves[k] }));
  const centerLines: CityLayout['centerLines'] = hz.map((c) => ({ axis: 'x' as const, c, from: xMin, to: xMax }));
  for (const x of V_ROADS) {
    for (let i = 0; i < hz.length - 1; i++) {
      roads.push({ x0: x - HALF, x1: x + HALF, z0: hz[i] + halves[i], z1: hz[i + 1] - halves[i + 1] });
      centerLines.push({ axis: 'z', c: x, from: hz[i] + halves[i], to: hz[i + 1] - halves[i + 1] });
    }
  }
  const blocks: Rect[] = [];
  const loopCenters: Rect[] = [];
  // tim làn xe chạy: đường chính lệch khỏi vỉa hè phía cửa hàng nửa dải đỗ
  const laneZ = hz.map((c, k) => (k === 1 ? c + MAIN_PARK_STRIP / 2 : c));
  for (let i = 0; i < V_ROADS.length - 1; i++) {
    for (let j = 0; j < hz.length - 1; j++) {
      blocks.push({ x0: V_ROADS[i] + HALF, x1: V_ROADS[i + 1] - HALF, z0: hz[j] + halves[j], z1: hz[j + 1] - halves[j + 1] });
      loopCenters.push({ x0: V_ROADS[i], x1: V_ROADS[i + 1], z0: laneZ[j], z1: laneZ[j + 1] });
    }
  }
  const walk = WALK_WIDTH;
  const lot: Rect = { x0: 36, x1: 58, z0: F - walk - 19, z1: F - walk };
  const lotSpots: Spot[] = [];
  // xe người chơi đỗ song song sát vỉa hè trước cửa hàng, phía sau điểm dừng của xe tải giao hàng (x ≤ 8.2) và trước trạm buýt
  const frontSpots: Spot[] = [13, 19, 25].map((x) => ({ x, z: F + MAIN_PARK_STRIP / 2, yaw: Math.PI / 2 }));
  for (let i = 0; i < 6; i++) lotSpots.push({ x: lot.x0 + 2 + i * 3.4, z: lot.z0 + 7, yaw: Math.PI });
  const shed: Rect = { x0: 76, x1: 102, z0: F - walk - 26, z1: F - walk - 10 };
  const pad: Rect = { x0: 78, x1: 94, z0: F - walk - 8, z1: F - walk - 2 };
  const depot = { shed, pad, kiosk: { x: 96.5, z: pad.z0 + 3, yaw: 0 } };
  // trạm xe buýt: bên phải mặt tiền cửa hàng, sát lề; xe đỗ trên làn ngoài cùng (đầu xe hướng -X) — cửa trước xe nằm ngoài mái che, hành khách xuống rồi đi về phía cửa hàng
  const stopX = 32.6;
  const busStop: BusStop = { shelter: { x0: stopX - 1.6, x1: stopX + 1.6, z0: F - 1.4, z1: F - 0.3 }, bay: { x: stopX, z: hz[1] + MAIN_PARK_STRIP / 2 } };
  const busClear: Rect = { x0: busStop.shelter.x0 - 1.2, x1: busStop.shelter.x1 + 1.2, z0: F - walk, z1: F };
  const reserved: Rect[] = [
    // vỏ nhà: cửa hàng + kho kế bên (chừa lối sau 3m) và vỉa hè trước mặt tiền
    { x0: WAREHOUSE_LOT.x0 - 0.6, x1: W + 0.6, z0: -4, z1: F }, { x0: WAREHOUSE_LOT.x0 - 0.6, x1: 35, z0: D + WALL_THICKNESS, z1: F },
    lot, { ...shed, z1: F }, { x0: shed.x0 - 2, x1: shed.x1 + 2, z0: shed.z0, z1: F },
  ];
  const placements: Placement[] = [];
  const colliders: AABB[] = [];
  const taken: Rect[] = [...reserved];
  const addSolid = (r: Rect, tag: string) => colliders.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, tag });
  addSolid(shed, 'depot');
  addSolid({ x0: depot.kiosk.x - 0.6, x1: depot.kiosk.x + 0.6, z0: depot.kiosk.z - 0.4, z1: depot.kiosk.z + 0.4 }, 'kiosk');
  // hàng xóm sát hai bên siêu thị trước, rồi mới tới nhà ven các khối phố
  sideShops(D, W, lot.x0, taken, placements, addSolid);
  oppositeShops(hz[1] + HALF_MAIN + walk, -24, 58, taken, placements, addSolid);

  // hẻm trước (nhà sẽ ôm sát hai bên), rồi lấp kín phần còn lại của khối bằng nhà ống Việt
  const alleys = planAlleys(mulberry32(ALLEY.seed), blocks, walk, taken);
  for (const b of blocks) tileBlock(rng, b, walk, taken, placements, addSolid);
  for (const b of blocks) backfillBlock(rng, b, walk, taken, placements, addSolid);
  const life = alleyLife(mulberry32(ALLEY.seed + 1), alleys);
  placements.push(...life.placements);
  for (const r of life.solids) addSolid(r, 'prop');

  // cây & đèn dọc vỉa hè (sát lề đường), chừa giao lộ, lối vào bãi, trước cửa hàng
  const noTree: Rect[] = [{ x0: -4, x1: 30, z0: F - walk, z1: F }, { x0: lot.x0, x1: lot.x1, z0: F - walk, z1: F },
    { x0: pad.x0 - 2, x1: pad.x1 + 2, z0: F - walk, z1: F }, busClear];
  const sidewalks = streetSides(blocks, walk);
  for (const s of sidewalks) {
    const len = s.to - s.from;
    for (let t = 6; t < len - 6; t += TREE_SPACING) {
      const p = s.at(s.from + t, 0.9);
      const r = { x0: p.x - 0.4, x1: p.x + 0.4, z0: p.z - 0.4, z1: p.z + 0.4 };
      if (noTree.some((n) => rectsOverlap(n, r))) continue;
      placements.push({ kind: 'tree', model: pick(rng, TREES), x: p.x, z: p.z, rot: rng() * Math.PI * 2, variant: 0 });
      addSolid(r, 'tree');
    }
    for (let t = 12; t < len - 4; t += LAMP_SPACING) {
      const p = s.at(s.from + t, 0.45);
      if (rectsOverlap(busClear, { x0: p.x - 0.3, x1: p.x + 0.3, z0: p.z - 0.3, z1: p.z + 0.3 })) continue;
      placements.push({ kind: 'prop', model: 'Streetlight_Single', x: p.x, z: p.z, rot: s.facing, variant: 0 });
      addSolid({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 }, 'lamp');
    }
  }
  const signals = planTrafficSignals(V_ROADS, hz, halves, HALF);
  const crosswalks = planCrosswalks(signals, V_ROADS, hz, halves, HALF);
  for (const c of crosswalks) for (const p of [c.from, c.to]) {
    const x = p.x + (c.axis === 'x' ? 1.5 : 0);
    const z = p.z + (c.axis === 'z' ? 1.5 : 0);
    addSolid({ x0: x - 0.08, x1: x + 0.08, z0: z - 0.08, z1: z + 0.08 }, 'lamp');
  }
  for (const p of signals) {
    addSolid({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 }, 'lamp');
  }
  // quán bánh mì, ghế đẩu nhựa, xe máy đỗ vỉa hè (hạt giống riêng → không xáo trộn bố cục nhà)
  // cột điện đặt trước (ưu tiên mép lề), né chỗ hàng rong & lối cửa siêu thị; xe máy đỗ sau sẽ né cột
  const far = F + 2 * HALF_MAIN + walk;
  const stallAvoid = [...STREET_LIFE.near.stalls.map((s) => ({ x0: s.x - 3.6, x1: s.x + 3.6, z0: F - walk, z1: F })),
    ...STREET_LIFE.far.stalls.map((s) => ({ x0: s.x - 3.6, x1: s.x + 3.6, z0: far - walk, z1: far }))];
  const wiring = polePlan(blocks, colliders, [...stallAvoid, { x0: -1.5, x1: 7.5, z0: D, z1: F }, busClear]);
  addSolid(busStop.shelter, 'busstop');
  for (const p of wiring.poles) addSolid({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 }, 'pole');
  const stalls = streetLife(mulberry32(CITY_SEED + 7), F, HALF_MAIN, colliders, placements, addSolid);
  // xe đỗ trang trí: 3 chỗ cuối bãi (lòng đường để cho xe NPC chạy — xem Traffic)
  lotSpots.slice(3).forEach((s, i) => placements.push({ kind: 'car', model: PARKED_CARS[i % PARKED_CARS.length], x: s.x, z: s.z, rot: s.yaw, variant: 0 }));
  for (const p of placements) if (p.kind === 'car') addSolid(footprint(p.x, p.z, 1.9, 4.3, p.rot), 'car');
  // cọc chặn: xe không chạy vào cửa hàng qua cửa kính
  const bounds: Rect = { x0: xMin - 4, x1: xMax + 4, z0: zMin - 4, z1: zMax + 4 };
  colliders.push(
    { minX: bounds.x0 - 10, maxX: bounds.x0, minZ: bounds.z0 - 10, maxZ: bounds.z1 + 10, tag: 'bound' },
    { minX: bounds.x1, maxX: bounds.x1 + 10, minZ: bounds.z0 - 10, maxZ: bounds.z1 + 10, tag: 'bound' },
    { minX: bounds.x0, maxX: bounds.x1, minZ: bounds.z0 - 10, maxZ: bounds.z0, tag: 'bound' },
    { minX: bounds.x0, maxX: bounds.x1, minZ: bounds.z1, maxZ: bounds.z1 + 10, tag: 'bound' },
  );
  // đoạn đường ngay trước cửa hàng luôn có cụm miếng vá (người chơi thấy ngay)
  const hot = { x0: -10, x1: 30, z0: roads[1].z0, z1: roads[1].z1 };
  const crosswalk = { x0: -7, x1: -3, z0: roads[1].z0, z1: roads[1].z1 };
  const damage = roadDamage(roads, [hot], [crosswalk]);
  // biển tên đường & số hẻm (cột biển né vật cản và góc đèn giao thông)
  const signs = planStreetSigns({
    hz, halves, vRoads: V_ROADS, vHalf: HALF, bounds, blocks, alleys, walk,
    solids: colliders.map((c) => ({ x0: c.minX, x1: c.maxX, z0: c.minZ, z1: c.maxZ })),
    avoidCorner: (x, z) => signals.some((p) => Math.hypot(p.x - x, p.z - z) < 0.6),
  });
  for (const p of signs.posts) addSolid({ x0: p.x - 0.1, x1: p.x + 0.1, z0: p.z - 0.1, z1: p.z + 0.1 }, 'sign');
  return { crosswalks, signals, roads, centerLines, blocks, loopCenters, signs, alleys, alleyDecor: life.decor, lot, lotSpots, frontSpots, depot, placements, colliders, bounds, hz, stalls, damage, wiring, busStop };
}

/** Các dải vỉa hè dọc đường: hàm at(t, lề) trả điểm cách mép đường `lề` mét. facing: hướng quay ra đường. */
function streetSides(blocks: Rect[], walk: number) {
  const out: Array<{ from: number; to: number; facing: number; at: (t: number, off: number) => { x: number; z: number } }> = [];
  for (const b of blocks) {
    out.push({ from: b.x0 + walk, to: b.x1 - walk, facing: 0, at: (t, o) => ({ x: t, z: b.z1 - o }) });
    out.push({ from: b.x0 + walk, to: b.x1 - walk, facing: Math.PI, at: (t, o) => ({ x: t, z: b.z0 + o }) });
    out.push({ from: b.z0 + walk, to: b.z1 - walk, facing: Math.PI / 2, at: (t, o) => ({ x: b.x1 - o, z: t }) });
    out.push({ from: b.z0 + walk, to: b.z1 - walk, facing: -Math.PI / 2, at: (t, o) => ({ x: b.x0 + o, z: t }) });
  }
  return out;
}
