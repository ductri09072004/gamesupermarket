import { BUILDINGS, CITY_SEED, SHOP_BUILDINGS, SHOP_NAMES, STREET_BUILDINGS } from '../config/city';
import { WALL_THICKNESS, WAREHOUSE_LOT } from '../config/constants';
import { mulberry32, pick, type Rng } from '../core/Random';
import { footprint, houseRect, rectsOverlap, type Placement, type Rect } from './CityLayout';

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

/** Khoảng trống hẹp hơn mức này (m) thì bỏ qua — nhà ống nhỏ nhất kéo co tới 0.6 lần vẫn rộng hơn */
const MIN_SPAN = 2.4;
const MIN_SQUEEZE = 0.6;
/** Dãy nhà vá nốt mỏng hơn mức này (m) thì bỏ */
const MIN_DEPTH = 0.6;
/** Độ sâu mặc định của một dãy nhà (m): mọi nhà được kéo/co theo bề sâu này để dãy phẳng, không để hở phía sau */
export const ROW_DEPTH = 11;

/** Dải đất mà một dãy nhà `depth` m chiếm dọc cạnh `e`. */
function band(e: Edge, depth: number): Rect {
  const a = Math.min(e.line, e.line + e.sign * depth);
  const b = Math.max(e.line, e.line + e.sign * depth);
  return e.along === 'x' ? { x0: e.from, x1: e.to, z0: a, z1: b } : { x0: a, x1: b, z0: e.from, z1: e.to };
}

/** Các đoạn còn trống dọc cạnh (trừ phần đã bị chiếm), bỏ đoạn quá hẹp. */
function freeSpans(e: Edge, depth: number, taken: Rect[]): Array<[number, number]> {
  const b = band(e, depth);
  const cuts = taken
    .filter((k) => rectsOverlap(k, b, -0.05))
    .map((k): [number, number] => (e.along === 'x' ? [k.x0, k.x1] : [k.z0, k.z1]))
    .sort((p, q) => p[0] - q[0]);
  const out: Array<[number, number]> = [];
  let cur = e.from;
  for (const [a, z] of cuts) {
    if (a - cur >= MIN_SPAN) out.push([cur, Math.min(a, e.to)]);
    cur = Math.max(cur, z);
  }
  if (e.to - cur >= MIN_SPAN) out.push([cur, e.to]);
  return out;
}

/**
 * Xếp nhà ống Việt sát nhau dọc một cạnh, mặt tiền quay ra ngoài, KHÔNG chừa khe: mỗi đoạn trống được lấp bằng các nhà
 * kéo giãn/co chiều rộng cho vừa khít và co/giãn bề sâu về `depth`. Bỏ qua chỗ đã chiếm (`taken`).
 */
export function fillEdge(
  rng: Rng, e: Edge, taken: Rect[], out: Placement[], addSolid: AddSolid,
  names: string[] = STREET_BUILDINGS, sign?: () => string, depth = ROW_DEPTH,
): void {
  for (const [a, b] of freeSpans(e, depth, taken)) {
    const len = b - a;
    const fit = names.filter((n) => BUILDINGS[n][0] * MIN_SQUEEZE <= len);
    if (!fit.length) continue;
    const picks: string[] = [];
    let sum = 0;
    for (let g = 0; g < 80; g++) {
      const name = pick(rng, fit);
      const w = BUILDINGS[name][0];
      if (sum + w <= len) { picks.push(name); sum += w; continue; }
      // phần dư lớn thì thêm 1 nhà nữa rồi co lại, nhỏ thì giãn đều các nhà
      if (!picks.length || len - sum >= w * 0.45) { picks.push(name); sum += w; }
      break;
    }
    const k = len / sum;
    let t = a;
    for (const name of picks) {
      const [w, , d] = BUILDINGS[name];
      const sx = k;
      const sz = depth / d;
      const c = t + (w * sx) / 2;
      const off = e.line + e.sign * (depth / 2);
      const x = e.along === 'x' ? c : off;
      const z = e.along === 'x' ? off : c;
      const r = footprint(x, z, w * sx, depth, e.rot);
      taken.push(r);
      out.push({ kind: 'building', model: name, x, z, rot: e.rot, variant: Math.floor(rng() * 6), sx, sz, sign: sign?.() });
      addSolid(r, 'building');
      t += w * sx;
    }
  }
}

/**
 * Lấp kín một khối phố bằng nhà ống: hai cột nhà sát đường dọc (quay ra đường), phần giữa chia thành các dãy ngang
 * lưng tựa lưng (dãy đầu/cuối quay ra đường ngang). Bề sâu chia đều nên không còn mảnh đất trống bên trong.
 */
export function tileBlock(rng: Rng, b: Rect, walk: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  const I = { x0: b.x0 + walk, x1: b.x1 - walk, z0: b.z0 + walk, z1: b.z1 - walk };
  const cd = ROW_DEPTH;
  fillEdge(rng, { rot: Math.PI / 2, along: 'z', from: I.z0, to: I.z1, line: I.x1, sign: -1 }, taken, out, addSolid, STREET_BUILDINGS, undefined, cd);
  fillEdge(rng, { rot: -Math.PI / 2, along: 'z', from: I.z0, to: I.z1, line: I.x0, sign: 1 }, taken, out, addSolid, STREET_BUILDINGS, undefined, cd);
  const x0 = I.x0 + cd;
  const x1 = I.x1 - cd;
  if (x1 - x0 < MIN_SPAN) return;
  const H = I.z1 - I.z0;
  const n = Math.max(1, Math.round(H / ROW_DEPTH));
  const rd = H / n;
  for (let i = 0; i < n; i++) {
    const e: Edge = i === 0
      ? { rot: Math.PI, along: 'x', from: x0, to: x1, line: I.z0, sign: 1 }
      : { rot: 0, along: 'x', from: x0, to: x1, line: I.z0 + (i + 1) * rd, sign: -1 };
    fillEdge(rng, e, taken, out, addSolid, STREET_BUILDINGS, undefined, rd);
  }
}

/**
 * Vá nốt chỗ còn trống trong khối (quanh cửa hàng, bãi đỗ, kho… nơi các dãy chính bị cắt cụt): quét lưới 1m, gặp ô trống thì
 * dựng một dãy nhà ngang lấp hết đoạn trống đó, bề sâu vừa bằng khoảng trống còn lại. Các nhà này nằm phía sau nên hướng tuỳ ý.
 */
export function backfillBlock(rng: Rng, b: Rect, walk: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  const I = { x0: b.x0 + walk, x1: b.x1 - walk, z0: b.z0 + walk, z1: b.z1 - walk };
  const near = taken.filter((k) => rectsOverlap(k, I));
  const cover = (x: number, z: number) => near.find((k) => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1);
  const covered = (x: number, z: number) => !!cover(x, z);
  for (let z = I.z0 + 0.5; z < I.z1; z += 1) {
    for (let x = I.x0 + 0.5; x < I.x1; x += 1) {
      if (covered(x, z)) continue;
      let xe = x;
      while (xe + 1 < I.x1 && !covered(xe + 1, z)) xe += 1;
      // biên khít với vật cản hai đầu (không chừa nửa ô lưới)
      const from = Math.max(I.x0, cover(x - 1, z)?.x1 ?? x - 0.5);
      const to = Math.min(I.x1, cover(xe + 1, z)?.x0 ?? xe + 0.5);
      if (to - from >= MIN_SPAN) {
        // mép dãy vừa dựng ngay phía dưới có thể thò vào ô này (lưới 1m) → bắt đầu dãy mới ngay sát mép đó
        let line = z - 0.5;
        for (const k of near) if (k.z1 > line && k.z0 < z && k.x0 < to && k.x1 > from) line = Math.max(line, k.z1);
        let avail = I.z1 - line;
        for (const k of near) if (k.z0 >= line - 1e-6 && k.x0 < to && k.x1 > from) avail = Math.min(avail, k.z0 - line);
        if (avail >= MIN_DEPTH) {
          const depth = avail <= ROW_DEPTH * 1.5 ? avail : ROW_DEPTH;
          const before = out.length;
          fillEdge(rng, { rot: Math.PI, along: 'x', from, to, line, sign: 1 }, taken, out, addSolid, STREET_BUILDINGS, undefined, depth);
          for (const h of out.slice(before)) near.push(houseRect(h));
        }
      }
      x = xe;
    }
  }
}

/**
 * Dãy cửa hiệu bên kia đường, ngay đối diện siêu thị (mặt phố người chơi nhìn nhiều nhất): nhà ống Việt có biển hiệu.
 * `facade`: đường mặt tiền phía bên kia (lề đường + vỉa hè), nhà lùi về +Z, quay mặt -Z.
 */
export function oppositeShops(facade: number, from: number, to: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  const rng = mulberry32(CITY_SEED + 31);
  let n = 4;
  const edge: Edge = { rot: Math.PI, along: 'x', from, to, line: facade, sign: 1 };
  fillEdge(rng, edge, taken, out, addSolid, SHOP_BUILDINGS, () => SHOP_NAMES[n++ % SHOP_NAMES.length], 9);
}

/**
 * Dãy cửa hiệu sát hai bên siêu thị, mặt tiền thẳng hàng với mặt tiền cửa hàng, phía sau là dãy nhà nữa.
 * Bên phải phụ thuộc chiều rộng cửa hàng W (mở rộng → dãy co lại). Rect đã chiếm được thêm vào `taken`.
 */
export function sideShops(D: number, W: number, right: number, taken: Rect[], out: Placement[], addSolid: AddSolid): void {
  const front = D + WALL_THICKNESS;
  // chỉ né vỏ nhà: cửa hàng (rộng tối đa W) + kho kế bên (vỉa hè trước mặt tiền đã nằm ngoài vì nhà lùi sau đường mặt tiền)
  const shellX0 = WAREHOUSE_LOT.x0;
  const near: Rect[] = [{ x0: shellX0 - 0.3, x1: W + 0.3, z0: -4, z1: front }];
  let n = 0;
  const shopSign = () => SHOP_NAMES[n++ % SHOP_NAMES.length];
  const sides: Array<{ from: number; to: number; seed: number }> = [
    { from: shellX0 - 14, to: shellX0 - 0.7, seed: 11 },
    { from: W + 0.7, to: right, seed: 97 + W },
  ];
  const rowDepth = 8;
  for (const s of sides) {
    if (s.to - s.from < 3) continue;
    const rng = mulberry32(CITY_SEED + s.seed);
    // dãy mặt tiền (mở hàng ra vỉa hè) + dãy nhà phía sau, không lấn xuống kho phía sau cửa hàng
    const edge: Edge = { rot: 0, along: 'x', from: s.from, to: s.to, line: front, sign: -1 };
    fillEdge(rng, edge, near, out, addSolid, SHOP_BUILDINGS, shopSign, rowDepth);
    const back: Edge = { ...edge, line: front - rowDepth };
    if (back.line - 7 > -12) fillEdge(rng, back, near, out, addSolid, STREET_BUILDINGS, undefined, ROW_DEPTH);
  }
  taken.push(...near.slice(1));
}
