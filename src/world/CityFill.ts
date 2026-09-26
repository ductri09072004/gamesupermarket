import { BUILDINGS, BUILDING_TEXTURES, CITY_SEED, INFILL_BUILDINGS, SHOP_BUILDINGS, SHOP_NAMES } from '../config/city';
import { WALL_THICKNESS, WAREHOUSE } from '../config/constants';
import { mulberry32, pick, type Rng } from '../core/Random';
import { footprint, rectsOverlap, type Placement, type Rect } from './CityLayout';

export interface Edge {
  rot: number;
  along: 'x' | 'z';
  from: number;
  to: number;
  /** Đường mặt tiền; nhà lùi vào trong theo `sign` */
  line: number;
  sign: number;
}

type AddSolid = (r: Rect, tag: string) => void;

/** Xếp nhà sát nhau dọc một cạnh, mặt tiền quay ra ngoài; bỏ qua chỗ đã chiếm. */
export function fillEdge(
  rng: Rng, e: Edge, taken: Rect[], out: Placement[], addSolid: AddSolid,
  names: string[] = Object.keys(BUILDINGS), gap = 2.5, sign?: () => string,
): void {
  let t = e.from + rng() * 2;
  let guard = 0;
  while (t < e.to && guard++ < 80) {
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
    out.push({ kind: 'building', model: name, x, z, rot: e.rot, variant: Math.floor(rng() * BUILDING_TEXTURES.length), sign: sign?.() });
    addSolid(r, 'building');
    t += w + 0.4 + rng() * gap;
  }
}

/** 4 cạnh của một vòng nhà lùi `inset` m vào trong khối (cạnh dọc chừa góc để khỏi chồng cạnh ngang). */
export function ringEdges(b: Rect, inset: number): Edge[] {
  const r = { x0: b.x0 + inset, x1: b.x1 - inset, z0: b.z0 + inset, z1: b.z1 - inset };
  return [
    { rot: 0, along: 'x', from: r.x0, to: r.x1, line: r.z1, sign: -1 },
    { rot: Math.PI, along: 'x', from: r.x0, to: r.x1, line: r.z0, sign: 1 },
    { rot: Math.PI / 2, along: 'z', from: r.z0 + 8, to: r.z1 - 8, line: r.x1, sign: -1 },
    { rot: -Math.PI / 2, along: 'z', from: r.z0 + 8, to: r.z1 - 8, line: r.x0, sign: 1 },
  ];
}

/**
 * Lõi khối phố: thêm các vòng nhà cao dần vào trong để phố đặc, skyline có tầng lớp.
 * Vòng đầu (sát vỉa hè) do cityLayout xếp; ở đây từ vòng 2.
 */
export function infillBlocks(rng: Rng, blocks: Rect[], walk: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  for (const b of blocks) {
    for (let k = 1; k <= 3; k++) {
      const inset = walk + k * 11;
      if (b.x1 - b.x0 - 2 * inset < 12 || b.z1 - b.z0 - 2 * inset < 12) break;
      for (const e of ringEdges(b, inset)) fillEdge(rng, e, taken, out, addSolid, INFILL_BUILDINGS, 1.2);
    }
  }
}

/**
 * Dãy cửa hiệu sát hai bên siêu thị, mặt tiền thẳng hàng với mặt tiền cửa hàng, phía sau là nhà cao hơn.
 * Bên phải phụ thuộc chiều rộng cửa hàng W (mở rộng → dãy co lại). Rect đã chiếm được thêm vào `taken`.
 */
export function sideShops(D: number, W: number, right: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  const front = D + WALL_THICKNESS;
  // chỉ né thân cửa hàng + kho (vỉa hè trước mặt tiền đã nằm ngoài vì nhà lùi sau đường mặt tiền)
  const near: Rect[] = [{ x0: -0.3, x1: W + 0.3, z0: WAREHOUSE.z0 - 4, z1: front }];
  let n = 0;
  const shopSign = () => SHOP_NAMES[n++ % SHOP_NAMES.length];
  const sides: Array<{ from: number; to: number; seed: number }> = [
    { from: -14, to: -0.7, seed: 11 },
    { from: W + 0.7, to: right, seed: 97 + W },
  ];
  for (const s of sides) {
    if (s.to - s.from < 3) continue;
    const rng = mulberry32(CITY_SEED + s.seed);
    // dãy mặt tiền (mở hàng ra vỉa hè) + dãy nhà phía sau, không lấn xuống kho phía sau cửa hàng
    // fillEdge lùi nhà 0.3m sau đường mặt tiền → +0.3 để mặt tiền thẳng hàng siêu thị
    const edge: Edge = { rot: 0, along: 'x', from: s.from, to: s.to, line: front + 0.3, sign: -1 };
    fillEdge(rng, edge, near, out, addSolid, SHOP_BUILDINGS, 0.2, shopSign);
    const back: Edge = { ...edge, line: front - 7.4 };
    if (back.line - 7 > WAREHOUSE.z0 - 6) fillEdge(rng, back, near, out, addSolid, INFILL_BUILDINGS, 0.3);
  }
  taken.push(...near.slice(1));
}
