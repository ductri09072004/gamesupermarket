import { ALLEY, SCOOTER_FILTERS } from '../config/city';
import type { Rng } from '../core/Random';
import { ROW_DEPTH } from './CityFill';
import { rectsOverlap, type Placement, type Rect } from './CityLayout';

/**
 * Hẻm nhỏ trong lòng khối phố (kiểu Việt Nam): hẻm thông hai đầu (xuyên khối ra hai đường), hẻm cụt (một đầu bít bằng nhà),
 * ngõ nhánh rẽ ngang từ hẻm lớn. Sàn có dốc lên xuống (`profile`), hai bên là tường nhà.
 */
export interface Alley {
  rect: Rect;
  /** Hướng dọc hẻm */
  axis: 'x' | 'z';
  kind: 'through' | 'dead' | 'branch';
  /** Độ cao sàn (m) theo vị trí t ∈ [0,1] dọc trục (từ phía giá trị nhỏ tới lớn) */
  profile: Array<[number, number]>;
  /** Đầu bị bít kín: 'min' | 'max' (phía giá trị nhỏ / lớn của trục), null = thông */
  deadEnd: 'min' | 'max' | null;
}

export type DecorKind = 'plant' | 'trash' | 'bucket' | 'sandals' | 'shrine' | 'laundry' | 'door' | 'window' | 'ad' | 'plate' | 'cable';

/** Đồ sinh hoạt vẽ bằng code (cây chậu, túi rác, thùng, dép, bàn thờ treo tường, dây phơi đồ). */
export interface AlleyDecor {
  kind: DecorKind;
  x: number;
  y: number;
  z: number;
  /** Hướng dọc hẻm (laundry: dây chạy theo trục này) */
  axis: 'x' | 'z';
  /** laundry / cable: chiều dài dây (m); shrine / door / window / ad / plate: góc quay Y để mặt hướng ra lòng hẻm (rad) */
  len: number;
  /** Số ngẫu nhiên 0..1 để đổi dáng / màu */
  seed: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Nội suy mượt giữa các điểm điều khiển. */
function profileAt(p: Array<[number, number]>, t: number): number {
  if (t <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i][0]) {
      const [t0, h0] = p[i - 1];
      const [t1, h1] = p[i];
      return h0 + (h1 - h0) * smooth((t - t0) / (t1 - t0 || 1));
    }
  }
  return p[p.length - 1][1];
}

export function alleyLength(a: Alley): number {
  return a.axis === 'z' ? a.rect.z1 - a.rect.z0 : a.rect.x1 - a.rect.x0;
}

function inside(r: Rect, x: number, z: number): boolean {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

export function alleyHeight(a: Alley, x: number, z: number): number {
  const t = a.axis === 'z' ? (z - a.rect.z0) / (a.rect.z1 - a.rect.z0) : (x - a.rect.x0) / (a.rect.x1 - a.rect.x0);
  return profileAt(a.profile, Math.max(0, Math.min(1, t)));
}

/** Độ cao mặt đất tại (x, z): trong hẻm thì theo dốc của hẻm, ngoài hẻm là 0. */
export function groundAt(alleys: Alley[], x: number, z: number): number {
  for (const a of alleys) if (inside(a.rect, x, z)) return alleyHeight(a, x, z);
  return 0;
}

/** Điểm trên tim hẻm tại vị trí s (m, tính từ đầu giá trị nhỏ). */
export function alleyPoint(a: Alley, s: number): { x: number; z: number } {
  return a.axis === 'z' ? { x: (a.rect.x0 + a.rect.x1) / 2, z: a.rect.z0 + s } : { x: a.rect.x0 + s, z: (a.rect.z0 + a.rect.z1) / 2 };
}

/** Hẻm thông: bằng phẳng ở hai đầu, ở giữa có đoạn dốc lên rồi xuống (gò). */
function throughProfile(rng: Rng, len: number): Array<[number, number]> {
  // đoạn dốc dài ≥ 8.5 × độ cao → độ dốc đỉnh (nội suy mượt) ≲ 18%
  const r = Math.min(0.2 * len, 9 * (0.55 + rng() * 0.55));
  const H = Math.min(0.55 + rng() * 0.55, r / 8.5);
  const ramp = r / len;
  const a = 0.12 + rng() * 0.12;
  const b = Math.min(0.95 - ramp, a + ramp + 0.12 + rng() * 0.25);
  return [[0, 0], [a, 0], [a + ramp, H], [b, H], [b + ramp, rng() < 0.5 ? 0 : H * 0.35], [1, 0]];
}

const profileMirror = (p: Array<[number, number]>): Array<[number, number]> => p.map(([t, h]) => [1 - t, h] as [number, number]).reverse();

/** Hẻm cụt: vào từ vỉa hè (độ cao 0), dốc lên dần về phía cuối hẻm. */
function deadProfile(rng: Rng, len: number): Array<[number, number]> {
  const r = 0.55 * len;
  const H = Math.min(0.4 + rng() * 0.6, r / 8.5);
  const a = 0.1 + rng() * 0.2;
  return [[0, 0], [a, 0], [Math.min(0.95, a + r / len), H], [1, H]];
}

/**
 * Quy hoạch hẻm cho các khối phố: hẻm thông xuyên khối theo hướng Z (vài hẻm song song), hẻm cụt đi vào từ hai phía,
 * ngõ nhánh rẽ ngang từ hẻm thông. Rect hẻm được thêm vào `taken` để các dãy nhà chừa chỗ (nhà ôm sát hai bên hẻm).
 * Hẻm cụt có chiều dài bằng số nguyên dãy nhà → cuối hẻm là mặt hông nhà đúng ngay ranh dãy.
 */
export function planAlleys(rng: Rng, blocks: Rect[], walk: number, taken: Rect[]): Alley[] {
  const out: Alley[] = [];
  const w2 = ALLEY.width / 2;
  const free = (r: Rect, except?: Rect) => !taken.some((k) => k !== except && rectsOverlap(k, r, 0.3));
  const add = (a: Alley) => { out.push(a); taken.push(a.rect); };
  for (const b of blocks) {
    const I = { x0: b.x0 + walk, x1: b.x1 - walk, z0: b.z0 + walk, z1: b.z1 - walk };
    const Wd = I.x1 - I.x0;
    const Hd = I.z1 - I.z0;
    const n = Math.max(1, Math.round(Hd / ROW_DEPTH));
    const rd = Hd / n;
    // hẻm chỉ nằm ở vùng giữa các dãy ngang (không lấn vào hai cột nhà sát đường dọc → khỏi để lại khe hẹp)
    const lo = I.x0 + ROW_DEPTH + 3 + w2;
    const hi = I.x1 - ROW_DEPTH - 3 - w2;
    const xs: number[] = [];
    const farFromOthers = (x: number, gap: number) => xs.every((o) => Math.abs(o - x) >= gap);
    const first = out.length;
    // hẻm thông (xuyên khối, hai đầu ra vỉa hè)
    const nThrough = Wd > 80 ? 2 : 1;
    for (let k = 0, tries = 0; k < nThrough && tries < 30; tries++) {
      if (hi <= lo) break;
      const x = lo + rng() * (hi - lo);
      const rect = { x0: x - w2, x1: x + w2, z0: I.z0, z1: I.z1 };
      if (!farFromOthers(x, ALLEY.spacing + 8) || !free(rect)) continue;
      xs.push(x);
      k++;
      add({ rect, axis: 'z', kind: 'through', profile: throughProfile(rng, Hd), deadEnd: null });
    }
    // hẻm cụt: vào từ phía đường z0 hoặc z1, dài 1–2 dãy nhà
    const nDead = Wd > 80 ? 5 : 3;
    for (let k = 0, tries = 0; k < nDead && tries < 60; tries++) {
      if (hi <= lo) break;
      const x = lo + rng() * (hi - lo);
      const fromNorth = rng() < 0.5;
      const len = rd * (rng() < 0.45 ? 2 : 1);
      const rect = fromNorth ? { x0: x - w2, x1: x + w2, z0: I.z1 - len, z1: I.z1 } : { x0: x - w2, x1: x + w2, z0: I.z0, z1: I.z0 + len };
      if (!farFromOthers(x, ALLEY.spacing - 6) || !free(rect)) continue;
      xs.push(x);
      k++;
      const prof = deadProfile(rng, len);
      add({ rect, axis: 'z', kind: 'dead', profile: fromNorth ? profileMirror(prof) : prof, deadEnd: fromNorth ? 'min' : 'max' });
    }
    // ngõ nhánh: rẽ ngang từ hẻm thông, cụt ở cuối
    for (const t of out.slice(first).filter((a) => a.kind === 'through')) {
      for (let k = 0, tries = 0; k < 2 && tries < 12; tries++) {
        const side = rng() < 0.5 ? -1 : 1;
        // ngõ rẽ ngay ranh giữa hai dãy nhà (nhà hai bên ôm vừa khít)
        const z = I.z0 + (1 + Math.floor(rng() * Math.max(1, n - 1))) * rd;
        if (n < 2) break;
        const room = side > 0 ? hi + w2 - t.rect.x1 : t.rect.x0 - (lo - w2);
        if (room < 4) continue;
        const L = Math.min(room, 8 + rng() * 9);
        const rect = side > 0 ? { x0: t.rect.x1, x1: t.rect.x1 + L, z0: z - w2, z1: z + w2 } : { x0: t.rect.x0 - L, x1: t.rect.x0, z0: z - w2, z1: z + w2 };
        if (rect.x0 < lo - w2 || rect.x1 > hi + w2 || !free(rect, t.rect)) continue;
        k++;
        const base = alleyHeight(t, (t.rect.x0 + t.rect.x1) / 2, z);
        const rise = (rng() - 0.35) * 0.5;
        const p: Array<[number, number]> = [[0, base], [0.25, base], [0.7, Math.max(0, base + rise)], [1, Math.max(0, base + rise)]];
        add({ rect, axis: 'x', kind: 'branch', profile: side > 0 ? p : profileMirror(p), deadEnd: side > 0 ? 'max' : 'min' });
      }
    }
  }
  return out;
}

/** Góc quay Y (model mặt +Z) để mặt hướng ra lòng hẻm khi gắn lên tường bên (side = ±1) hoặc tường cuối hẻm. */
function wallRot(a: Alley, side: number, end: 'min' | 'max' | null = null): number {
  if (end) return a.axis === 'z' ? (end === 'max' ? Math.PI : 0) : end === 'max' ? -Math.PI / 2 : Math.PI / 2;
  return a.axis === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
}

export interface AlleyLife {
  placements: Placement[];
  solids: Rect[];
  decor: AlleyDecor[];
}

/** Dấu vết sinh hoạt: cây chậu, dây phơi đồ, bàn thờ treo tường, xe máy dựng sát tường, ghế đẩu cuối hẻm, đèn lồng… */
export function alleyLife(rng: Rng, alleys: Alley[]): AlleyLife {
  const placements: Placement[] = [];
  const solids: Rect[] = [];
  const decor: AlleyDecor[] = [];
  const w2 = ALLEY.width / 2;
  for (const a of alleys) {
    const len = alleyLength(a);
    const at = (s: number, lateral: number) => {
      const p = alleyPoint(a, s);
      return a.axis === 'z' ? { x: p.x + lateral, z: p.z } : { x: p.x, z: p.z + lateral };
    };
    const y = (s: number) => {
      const p = alleyPoint(a, s);
      return alleyHeight(a, p.x, p.z);
    };
    // hướng dọc hẻm: model quay mặt +Z → rot 0/π (hẻm theo Z) hoặc ±π/2 (hẻm theo X)
    const along = a.axis === 'z' ? 0 : Math.PI / 2;
    const prop = (model: string, s: number, lateral: number, rot: number, solid = 0, variant = 0, lift = 0) => {
      const p = at(s, lateral);
      placements.push({ kind: 'prop', model, x: p.x, z: p.z, rot, variant, y: y(s) + lift });
      if (solid > 0) solids.push({ x0: p.x - solid, x1: p.x + solid, z0: p.z - solid, z1: p.z + solid });
    };
    const dec = (kind: DecorKind, s: number, lateral: number, lift = 0, l = 0) => {
      const p = at(s, lateral);
      decor.push({ kind, x: p.x, y: y(s) + lift, z: p.z, axis: a.axis, len: l, seed: rng() });
    };
    // rải đồ dọc hai bên chân tường mỗi 2–5m
    for (let s = 1.5; s < len - 1.5; s += 2 + rng() * 3) {
      const side = rng() < 0.5 ? -1 : 1;
      const r = rng();
      if (r < 0.42) dec('plant', s, side * (w2 - 0.22));
      else if (r < 0.58) dec('trash', s, side * (w2 - 0.22));
      else if (r < 0.7) dec('bucket', s, side * (w2 - 0.22));
      else if (r < 0.8) dec('sandals', s, side * (w2 - 0.3));
      else if (r < 0.88) dec('shrine', s, side * (w2 - 0.04), 1.55, wallRot(a, side));
    }
    // mặt tường hai bên hẻm: cửa sắt kéo mở thẳng ra hẻm, ô cửa chấn song, biển số nhà xanh, chữ quảng cáo sơn tay
    for (const side of [-1, 1]) {
      for (let s = 1.6 + rng() * 1.5; s < len - 1.5; s += 2.6 + rng() * 3.4) {
        const lat = side * (w2 - 0.025);
        const r = rng();
        const rot = wallRot(a, side);
        if (r < 0.5) {
          dec('door', s, lat, 0, rot);
          if (rng() < 0.7) dec('plate', s + 0.72, lat, 1.55, rot);
        } else if (r < 0.72) dec('window', s, lat, 1.35, rot);
        else if (r < 0.88) dec('ad', s, lat, 1.5, rot);
      }
    }
    // dây điện, dây cáp chằng chịt phía trên hẻm
    for (let k = 0; k < Math.ceil(len / 12); k++) {
      const l = 6 + rng() * 14;
      dec('cable', Math.min(len - l / 2, l / 2 + rng() * Math.max(0, len - l)), (rng() - 0.5) * 0.9, 4.0 + rng() * 1.2, l);
    }
    // dây phơi quần áo dọc hẻm sát một bên tường, trên đầu người đi
    for (let k = 0, n = a.kind === 'through' ? 2 : 1; k < n; k++) {
      const l = 5 + rng() * Math.max(1, Math.min(8, len - 8));
      if (len < l + 3) continue;
      const s = 1.5 + rng() * (len - l - 3);
      dec('laundry', s + l / 2, (rng() < 0.5 ? -1 : 1) * (w2 - 0.2), 2.45 + rng() * 0.3, l);
    }
    // đèn lồng đỏ treo giữa hẻm
    for (let s = 6 + rng() * 6; s < len - 3; s += 14 + rng() * 10) prop('vn_lanterns', s, 0, along, 0, 0, 2.55);
    // xe máy dựng sát tường (chừa ≥ 0.8m để lách qua)
    if (rng() < 0.55 && len > 8) {
      const s = 3 + rng() * (len - 6);
      const lat = (rng() < 0.5 ? -1 : 1) * (w2 - 0.34);
      prop('vn_scooter', s, lat, along + (rng() < 0.5 ? 0 : Math.PI), 0.32, Math.floor(rng() * SCOOTER_FILTERS.length));
    }
    // cuối hẻm cụt: bộ bàn ghế đẩu, bàn thờ treo tường
    if (a.deadEnd) {
      const end = a.deadEnd === 'max' ? len - 1.2 : 1.2;
      const dir = a.deadEnd === 'max' ? -1 : 1;
      prop('vn_stool_red', end + dir * 0.3, -0.35, rng() * 3, 0.2);
      prop('vn_stool_blue', end + dir * 0.5, 0.35, rng() * 3, 0.2);
      prop('vn_table', end + dir * 0.3, 0.3, along, 0.25);
      prop('vn_coconut', end + dir * 0.3, 0.28, 0, 0, 0, 0.45);
      dec('shrine', a.deadEnd === 'max' ? len - 0.05 : 0.05, 0, 1.6, wallRot(a, 0, a.deadEnd));
    }
  }
  return { placements, solids, decor };
}
