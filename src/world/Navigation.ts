import type { Rect } from './CityLayout';

/** Vật cản AABB (cùng dạng với world/Colliders). */
interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Lưới đi bộ thô của cả thành phố (ô 1m) dùng để vạch đường chỉ lối trên bản đồ. */
export interface NavGrid {
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  cell: number;
  blocked: Uint8Array;
}

export interface Pt {
  x: number;
  z: number;
}

export interface Route {
  pts: Pt[];
  length: number;
}

export function buildNavGrid(bounds: Rect, solids: Solid[], cell = 0.5, pad = 0.2): NavGrid {
  const cols = Math.ceil((bounds.x1 - bounds.x0) / cell);
  const rows = Math.ceil((bounds.z1 - bounds.z0) / cell);
  const blocked = new Uint8Array(cols * rows);
  for (const s of solids) {
    const i0 = Math.max(0, Math.floor((s.minX - pad - bounds.x0) / cell));
    const i1 = Math.min(cols - 1, Math.floor((s.maxX + pad - bounds.x0) / cell));
    const j0 = Math.max(0, Math.floor((s.minZ - pad - bounds.z0) / cell));
    const j1 = Math.min(rows - 1, Math.floor((s.maxZ + pad - bounds.z0) / cell));
    for (let j = j0; j <= j1; j++) {
      const cz = bounds.z0 + (j + 0.5) * cell;
      if (cz < s.minZ - pad || cz > s.maxZ + pad) continue;
      for (let i = i0; i <= i1; i++) {
        const cx = bounds.x0 + (i + 0.5) * cell;
        if (cx >= s.minX - pad && cx <= s.maxX + pad) blocked[j * cols + i] = 1;
      }
    }
  }
  return { x0: bounds.x0, z0: bounds.z0, cols, rows, cell, blocked };
}

const cellOf = (g: NavGrid, p: Pt): [number, number] => [Math.floor((p.x - g.x0) / g.cell), Math.floor((p.z - g.z0) / g.cell)];
const center = (g: NavGrid, i: number, j: number): Pt => ({ x: g.x0 + (i + 0.5) * g.cell, z: g.z0 + (j + 0.5) * g.cell });
const inGrid = (g: NavGrid, i: number, j: number) => i >= 0 && j >= 0 && i < g.cols && j < g.rows;
const free = (g: NavGrid, i: number, j: number) => inGrid(g, i, j) && g.blocked[j * g.cols + i] === 0;

/** Ô đi được gần nhất (tìm theo vòng quanh ô chứa p, tối đa `r` ô); null nếu không có. */
export function nearestFree(g: NavGrid, p: Pt, r = 8): Pt | null {
  const [ci, cj] = cellOf(g, p);
  if (free(g, ci, cj)) return center(g, ci, cj);
  let best: Pt | null = null;
  let bd = Infinity;
  for (let d = 1; d <= r; d++) {
    for (let j = cj - d; j <= cj + d; j++) {
      for (let i = ci - d; i <= ci + d; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== d || !free(g, i, j)) continue;
        const c = center(g, i, j);
        const dd = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
        if (dd < bd) { bd = dd; best = c; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Hai điểm nhìn thấy nhau (không vướng ô chắn) — lấy mẫu dọc đoạn thẳng. */
function lineOfSight(g: NavGrid, a: Pt, b: Pt): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (g.cell * 0.4)));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const [i, j] = cellOf(g, { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    if (!free(g, i, j)) return false;
  }
  return true;
}

class MinHeap {
  private f: number[] = [];
  private v: number[] = [];
  get size(): number { return this.v.length; }
  push(val: number, pri: number): void {
    let i = this.v.length;
    this.v.push(val);
    this.f.push(pri);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[p] <= this.f[i]) break;
      [this.f[p], this.f[i]] = [this.f[i], this.f[p]];
      [this.v[p], this.v[i]] = [this.v[i], this.v[p]];
      i = p;
    }
  }
  pop(): number {
    const top = this.v[0];
    const lastV = this.v.pop()!;
    const lastF = this.f.pop()!;
    if (this.v.length) {
      this.v[0] = lastV;
      this.f[0] = lastF;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.v.length && this.f[l] < this.f[m]) m = l;
        if (r < this.v.length && this.f[r] < this.f[m]) m = r;
        if (m === i) break;
        [this.f[m], this.f[i]] = [this.f[i], this.f[m]];
        [this.v[m], this.v[i]] = [this.v[i], this.v[m]];
        i = m;
      }
    }
    return top;
  }
}

const NEIGHBORS: Array<[number, number, number]> = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/** A* 8 hướng (không cắt góc) từ `from` tới `to`, rồi kéo thẳng đường (string-pulling). null nếu không có đường. */
export function findRoute(g: NavGrid, from: Pt, to: Pt): Route | null {
  const s = nearestFree(g, from);
  const t = nearestFree(g, to);
  if (!s || !t) return null;
  const [si, sj] = cellOf(g, s);
  const [ti, tj] = cellOf(g, t);
  const N = g.cols * g.rows;
  const cost = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new MinHeap();
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - ti);
    const dz = Math.abs(j - tj);
    return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const start = sj * g.cols + si;
  cost[start] = 0;
  heap.push(start, h(si, sj));
  const goal = tj * g.cols + ti;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const ci = cur % g.cols;
    const cj = (cur - ci) / g.cols;
    for (const [di, dj, w] of NEIGHBORS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!free(g, ni, nj)) continue;
      if (di !== 0 && dj !== 0 && (!free(g, ci + di, cj) || !free(g, ci, cj + dj))) continue;
      const ni2 = nj * g.cols + ni;
      const c = cost[cur] + w;
      if (c < cost[ni2]) {
        cost[ni2] = c;
        prev[ni2] = cur;
        heap.push(ni2, c + h(ni, nj));
      }
    }
  }
  if (prev[goal] < 0 && goal !== start) return null;
  const raw: Pt[] = [];
  for (let k = goal; k >= 0; k = prev[k]) {
    const i = k % g.cols;
    raw.push(center(g, i, (k - i) / g.cols));
    if (k === start) break;
  }
  raw.reverse();
  // kéo thẳng: từ mỗi điểm nhảy tới điểm xa nhất còn nhìn thấy
  const out: Pt[] = [raw[0]];
  let i = 0;
  while (i < raw.length - 1) {
    let j = raw.length - 1;
    while (j > i + 1 && !lineOfSight(g, raw[i], raw[j])) j--;
    out.push(raw[j]);
    i = j;
  }
  let length = 0;
  for (let k = 1; k < out.length; k++) length += Math.hypot(out[k].x - out[k - 1].x, out[k].z - out[k - 1].z);
  return { pts: out, length };
}
