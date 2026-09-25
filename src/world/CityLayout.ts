import {
  BUILDINGS, BUILDING_TEXTURES, BUSHES, CITY_SEED, LAMP_SPACING, PARKED_CARS, ROAD_WIDTH, TREES, TREE_SPACING, WALK_WIDTH,
} from '../config/city';
import { SIDEWALK_DEPTH, WALL_THICKNESS, WAREHOUSE } from '../config/constants';
import { mulberry32, pick, type Rng } from '../core/Random';
import type { AABB } from './Colliders';

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
}

export interface Spot {
  x: number;
  z: number;
  yaw: number;
}

export interface CityLayout {
  /** Mặt đường, không chồng nhau (đường dọc cắt ở giao lộ) */
  roads: Rect[];
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
}

const HALF = ROAD_WIDTH / 2;
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

/** Mép vỉa hè giáp đường (tim đường chính = trước cửa hàng). */
export function curbZ(D: number): number {
  return D + WALL_THICKNESS + SIDEWALK_DEPTH;
}

/** Bố cục phố cố định theo hạt giống, chỉ phụ thuộc chiều sâu cửa hàng D (đường chính chạy trước mặt tiền). */
export function cityLayout(D: number): CityLayout {
  const rng = mulberry32(CITY_SEED);
  const F = curbZ(D);
  const hz = [-44, F + HALF, F + 64];
  const xMin = V_ROADS[0] - HALF;
  const xMax = V_ROADS[V_ROADS.length - 1] + HALF;
  const zMin = hz[0] - HALF;
  const zMax = hz[2] + HALF;
  const roads: Rect[] = hz.map((c) => ({ x0: xMin, x1: xMax, z0: c - HALF, z1: c + HALF }));
  const centerLines: CityLayout['centerLines'] = hz.map((c) => ({ axis: 'x' as const, c, from: xMin, to: xMax }));
  for (const x of V_ROADS) {
    for (let i = 0; i < hz.length - 1; i++) {
      roads.push({ x0: x - HALF, x1: x + HALF, z0: hz[i] + HALF, z1: hz[i + 1] - HALF });
      centerLines.push({ axis: 'z', c: x, from: hz[i] + HALF, to: hz[i + 1] - HALF });
    }
  }
  const blocks: Rect[] = [];
  for (let i = 0; i < V_ROADS.length - 1; i++) {
    for (let j = 0; j < hz.length - 1; j++) {
      blocks.push({ x0: V_ROADS[i] + HALF, x1: V_ROADS[i + 1] - HALF, z0: hz[j] + HALF, z1: hz[j + 1] - HALF });
    }
  }
  const walk = WALK_WIDTH;
  const lot: Rect = { x0: 36, x1: 58, z0: F - walk - 19, z1: F - walk };
  const lotSpots: Spot[] = [];
  for (let i = 0; i < 6; i++) lotSpots.push({ x: lot.x0 + 2 + i * 3.4, z: lot.z0 + 7, yaw: Math.PI });
  const shed: Rect = { x0: 76, x1: 102, z0: F - walk - 26, z1: F - walk - 10 };
  const pad: Rect = { x0: 78, x1: 94, z0: F - walk - 8, z1: F - walk - 2 };
  const depot = { shed, pad, kiosk: { x: 96.5, z: pad.z0 + 3, yaw: 0 } };
  const reserved: Rect[] = [
    { x0: -10, x1: 34, z0: WAREHOUSE.z0 - 6, z1: F }, lot, { ...shed, z1: F }, { x0: shed.x0 - 2, x1: shed.x1 + 2, z0: shed.z0, z1: F },
  ];
  const placements: Placement[] = [];
  const colliders: AABB[] = [];
  const taken: Rect[] = [...reserved];
  const addSolid = (r: Rect, tag: string) => colliders.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, tag });
  addSolid(shed, 'depot');
  addSolid({ x0: depot.kiosk.x - 0.6, x1: depot.kiosk.x + 0.6, z0: depot.kiosk.z - 0.4, z1: depot.kiosk.z + 0.4 }, 'kiosk');

  // nhà dọc 4 cạnh mỗi khối, mặt tiền quay ra đường
  for (const b of blocks) {
    const inner: Rect = { x0: b.x0 + walk, x1: b.x1 - walk, z0: b.z0 + walk, z1: b.z1 - walk };
    const edges: Array<{ rot: number; along: 'x' | 'z'; from: number; to: number; line: number; sign: number }> = [
      { rot: 0, along: 'x', from: inner.x0, to: inner.x1, line: inner.z1, sign: -1 },
      { rot: Math.PI, along: 'x', from: inner.x0, to: inner.x1, line: inner.z0, sign: 1 },
      { rot: Math.PI / 2, along: 'z', from: inner.z0 + 8, to: inner.z1 - 8, line: inner.x1, sign: -1 },
      { rot: -Math.PI / 2, along: 'z', from: inner.z0 + 8, to: inner.z1 - 8, line: inner.x0, sign: 1 },
    ];
    for (const e of edges) fillEdge(rng, e, taken, placements, addSolid);
    // bụi cây trong sân sau
    for (let k = 0; k < 6; k++) {
      const x = inner.x0 + 10 + rng() * (inner.x1 - inner.x0 - 20);
      const z = inner.z0 + 10 + rng() * (inner.z1 - inner.z0 - 20);
      const r = { x0: x - 1, x1: x + 1, z0: z - 1, z1: z + 1 };
      if (taken.some((t) => rectsOverlap(t, r, 0.5))) continue;
      placements.push({ kind: 'bush', model: pick(rng, BUSHES), x, z, rot: rng() * Math.PI * 2, variant: 0 });
    }
  }

  // cây & đèn dọc vỉa hè (sát lề đường), chừa giao lộ, lối vào bãi, trước cửa hàng
  const noTree: Rect[] = [{ x0: -4, x1: 30, z0: F - walk, z1: F }, { x0: lot.x0, x1: lot.x1, z0: F - walk, z1: F },
    { x0: pad.x0 - 2, x1: pad.x1 + 2, z0: F - walk, z1: F }];
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
      placements.push({ kind: 'prop', model: 'Streetlight_Single', x: p.x, z: p.z, rot: s.facing, variant: 0 });
      addSolid({ x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2 }, 'lamp');
    }
  }
  // đèn giao thông ở các góc giao lộ đường chính
  for (const x of V_ROADS.slice(1, 3)) {
    for (const [dx, dz, rot] of [[-1, -1, 0], [1, 1, Math.PI]] as const) {
      const p = { x: x + dx * (HALF + 0.6), z: hz[1] + dz * (HALF + 0.6) };
      placements.push({ kind: 'prop', model: 'TrafficLight', x: p.x, z: p.z, rot, variant: 0 });
      addSolid({ x0: p.x - 0.25, x1: p.x + 0.25, z0: p.z - 0.25, z1: p.z + 0.25 }, 'lamp');
    }
  }
  // xe đỗ trang trí: 3 chỗ cuối bãi + ven đường phía bắc
  lotSpots.slice(3).forEach((s, i) => placements.push({ kind: 'car', model: PARKED_CARS[i % PARKED_CARS.length], x: s.x, z: s.z, rot: s.yaw, variant: 0 }));
  for (let i = 0; i < 5; i++) {
    const x = -70 + i * 38 + rng() * 6;
    placements.push({ kind: 'car', model: pick(rng, PARKED_CARS), x, z: hz[2] - HALF + 1.2, rot: -Math.PI / 2, variant: 0 });
  }
  for (const p of placements) if (p.kind === 'car') addSolid(footprint(p.x, p.z, 1.9, 4.3, p.rot), 'car');
  // cọc chặn: xe không chạy vào cửa hàng qua cửa kính
  const bounds: Rect = { x0: xMin - 4, x1: xMax + 4, z0: zMin - 4, z1: zMax + 4 };
  colliders.push(
    { minX: bounds.x0 - 10, maxX: bounds.x0, minZ: bounds.z0 - 10, maxZ: bounds.z1 + 10, tag: 'bound' },
    { minX: bounds.x1, maxX: bounds.x1 + 10, minZ: bounds.z0 - 10, maxZ: bounds.z1 + 10, tag: 'bound' },
    { minX: bounds.x0, maxX: bounds.x1, minZ: bounds.z0 - 10, maxZ: bounds.z0, tag: 'bound' },
    { minX: bounds.x0, maxX: bounds.x1, minZ: bounds.z1, maxZ: bounds.z1 + 10, tag: 'bound' },
  );
  return { roads, centerLines, blocks, lot, lotSpots, depot, placements, colliders, bounds };
}

function fillEdge(
  rng: Rng, e: { rot: number; along: 'x' | 'z'; from: number; to: number; line: number; sign: number },
  taken: Rect[], out: Placement[], addSolid: (r: Rect, tag: string) => void,
): void {
  const names = Object.keys(BUILDINGS);
  let t = e.from + rng() * 2;
  let guard = 0;
  while (t < e.to && guard++ < 60) {
    const name = pick(rng, names);
    const [w, , d] = BUILDINGS[name];
    if (t + w > e.to) { t += 1.5; continue; }
    const c = t + w / 2;
    const off = e.line + e.sign * (d / 2 + 0.3);
    const x = e.along === 'x' ? c : off;
    const z = e.along === 'x' ? off : c;
    const r = footprint(x, z, w, d, e.rot);
    if (taken.some((k) => rectsOverlap(k, r, 0.4))) { t += 2; continue; }
    taken.push(r);
    out.push({ kind: 'building', model: name, x, z, rot: e.rot, variant: Math.floor(rng() * BUILDING_TEXTURES.length) });
    addSolid(r, 'building');
    t += w + 0.4 + rng() * 2.5;
  }
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
