import { ALLEY, STREET_NAMES } from '../config/city';
import type { Alley } from './Alleys';
import { rectsOverlap, type Rect } from './CityLayout';

/**
 * Biển tên đường & số hẻm kiểu Việt Nam (tấm tôn tráng men xanh chữ trắng):
 * - cột biển ở các ngã tư (hai biển vuông góc: tên hai đường giao nhau) và ở đầu mỗi con đường;
 * - biển "HẺM n" gắn tường ở đầu mỗi hẻm (kèm tên đường), biển "HẺM n/k" ở chỗ ngõ nhánh rẽ ra từ hẻm lớn.
 */
export interface SignPlate {
  x: number;
  y: number;
  z: number;
  /** Góc quay Y: pháp tuyến mặt biển = (sin rot, 0, cos rot) */
  rot: number;
  w: number;
  h: number;
  line1: string;
  line2: string;
  style: 'street' | 'alley';
  /** Biển trên cột: hiện cả hai mặt */
  double: boolean;
}

export interface SignPost {
  x: number;
  z: number;
  h: number;
}

export interface StreetSigns {
  plates: SignPlate[];
  posts: SignPost[];
}

interface Args {
  hz: number[];
  halves: number[];
  vRoads: number[];
  vHalf: number;
  /** Biên bản đồ (mép ngoài các đường) */
  bounds: Rect;
  blocks: Rect[];
  alleys: Alley[];
  walk: number;
  /** Vật cản đã có — cột biển né các vật này */
  solids: Rect[];
  /** Góc đèn giao thông đã dùng — né sang góc khác */
  avoidCorner?: (x: number, z: number) => boolean;
}

const POST_H = 3.0;

/** Số nhà của hẻm: chẵn / lẻ theo bên đường, tăng dần theo toạ độ dọc đường. */
export function alleyNumber(x: number, xMin: number, north: boolean): number {
  return Math.floor((x - xMin) * 0.9) * 2 + (north ? 1 : 2);
}

export function planStreetSigns(a: Args): StreetSigns {
  const plates: SignPlate[] = [];
  const posts: SignPost[] = [];
  const hName = (j: number) => STREET_NAMES.horizontal[j] ?? '';
  const vName = (i: number) => STREET_NAMES.vertical[i] ?? '';
  const freeAt = (x: number, z: number) => {
    const r = { x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15 };
    return !a.solids.some((s) => rectsOverlap(s, r, 0.1));
  };
  const addPost = (x: number, z: number, hName1: string | null, vName1: string | null) => {
    if (!freeAt(x, z)) return false;
    posts.push({ x, z, h: POST_H });
    // biển tên đường chạy dọc X: nhìn từ hai đầu đường (pháp tuyến dọc X); đường chạy dọc Z: pháp tuyến dọc Z
    if (hName1) plates.push({ x, y: POST_H - 0.25, z, rot: Math.PI / 2, w: 1.05, h: 0.4, line1: 'ĐƯỜNG', line2: hName1, style: 'street', double: true });
    if (vName1) plates.push({ x, y: POST_H - 0.72, z, rot: 0, w: 1.05, h: 0.4, line1: 'ĐƯỜNG', line2: vName1, style: 'street', double: true });
    return true;
  };

  // ngã tư: cột biển ở một góc vỉa hè (né góc có đèn giao thông)
  a.vRoads.forEach((X, i) => {
    a.hz.forEach((Z, j) => {
      const dx = a.vHalf + 0.5;
      const dz = a.halves[j] + 0.5;
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const x = X + sx * dx;
        const z = Z + sz * dz;
        if (a.avoidCorner?.(x, z)) continue;
        if (addPost(x, z, hName(j), vName(i))) break;
      }
    });
  });
  // đầu đường: cột biển ở hai đầu mỗi con đường (mép bản đồ)
  a.hz.forEach((Z, j) => {
    for (const x of [a.bounds.x0 + 1.2, a.bounds.x1 - 1.2]) addPost(x, Z + a.halves[j] + 0.5, hName(j), null) || addPost(x, Z - a.halves[j] - 0.5, hName(j), null);
  });
  a.vRoads.forEach((X, i) => {
    for (const z of [a.bounds.z0 + 1.2, a.bounds.z1 - 1.2]) addPost(X + a.vHalf + 0.5, z, null, vName(i)) || addPost(X - a.vHalf - 0.5, z, null, vName(i));
  });

  // hẻm: biển "HẺM n" gắn tường ở mỗi đầu hẻm giáp vỉa hè; ngõ nhánh có biển "HẺM n/k" trong hẻm lớn
  const numbers = new Map<Alley, number>();
  const branchCount = new Map<Alley, number>();
  let blockIndex = -1;
  for (const b of a.blocks) {
    blockIndex++;
    const j = blockIndex % (a.hz.length - 1);
    const I = { x0: b.x0 + a.walk, x1: b.x1 - a.walk, z0: b.z0 + a.walk, z1: b.z1 - a.walk };
    const mine = a.alleys.filter((al) => rectsOverlap(al.rect, b));
    for (const al of mine) {
      if (al.axis !== 'z') continue;
      const cx = (al.rect.x0 + al.rect.x1) / 2;
      const north = al.rect.z0 <= I.z0 + 0.01;
      const south = al.rect.z1 >= I.z1 - 0.01;
      if (north) {
        const n = alleyNumber(cx, a.vRoads[0], true);
        numbers.set(al, n);
        // mặt tiền nhà dãy đầu nằm ở z = I.z0; biển cách mép hẻm 0.5m, hướng ra đường
        plates.push({ x: al.rect.x1 + 0.5, y: 2.35, z: I.z0 - 0.04, rot: Math.PI, w: 0.72, h: 0.4, line1: `HẺM ${n}`, line2: hName(j), style: 'alley', double: false });
      }
      if (south) {
        const n = alleyNumber(cx, a.vRoads[0], false);
        if (!north) numbers.set(al, n);
        plates.push({ x: al.rect.x1 + 0.5, y: 2.35, z: I.z1 + 0.04, rot: 0, w: 0.72, h: 0.4, line1: `HẺM ${n}`, line2: hName(j + 1), style: 'alley', double: false });
      }
    }
    // ngõ nhánh
    for (const br of mine.filter((al) => al.kind === 'branch')) {
      const parent = mine.find((p) => p.kind === 'through' && (Math.abs(p.rect.x1 - br.rect.x0) < 0.05 || Math.abs(p.rect.x0 - br.rect.x1) < 0.05));
      if (!parent) continue;
      const k = (branchCount.get(parent) ?? 0) + 1;
      branchCount.set(parent, k);
      const right = Math.abs(parent.rect.x1 - br.rect.x0) < 0.05;
      const n = numbers.get(parent) ?? alleyNumber((parent.rect.x0 + parent.rect.x1) / 2, a.vRoads[0], true);
      const zc = (br.rect.z0 + br.rect.z1) / 2;
      // gắn lên tường hẻm lớn, ngay sau chỗ rẽ, mặt hướng vào lòng hẻm
      plates.push({
        x: right ? parent.rect.x1 - 0.03 : parent.rect.x0 + 0.03, y: 2.3, z: zc + ALLEY.width / 2 + 0.55, rot: right ? -Math.PI / 2 : Math.PI / 2,
        w: 0.52, h: 0.3, line1: `HẺM ${n}/${k}`, line2: '', style: 'alley', double: false,
      });
    }
  }
  return { plates, posts };
}
