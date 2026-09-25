import type { GridPoint } from './Footprint';
import type { WalkGrid } from './NavGrid';

const SQRT2 = Math.SQRT2;
const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class MinHeap {
  private items: Array<{ key: number; f: number }> = [];
  get size(): number { return this.items.length; }
  push(key: number, f: number): void {
    const a = this.items;
    a.push({ key, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.key;
  }
}

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

const pack = (x: number, y: number) => ((x + 512) << 10) | (y + 512);
const unpackX = (k: number) => (k >> 10) - 512;
const unpackY = (k: number) => (k & 1023) - 512;

export interface PathOptions {
  maxNodes?: number;
}

/**
 * A* 8 hướng, không cắt góc qua vật cản. Hỗ trợ nhiều đích (đến đích gần nhất).
 * Trả về danh sách ô từ start (gồm start) tới đích, hoặc null.
 * Ô start luôn được coi là đi được (nhân vật có thể đang đứng sát vật cản).
 */
export function findPath(grid: WalkGrid, start: GridPoint, goals: GridPoint | GridPoint[], opts: PathOptions = {}): GridPoint[] | null {
  const goalList = (Array.isArray(goals) ? goals : [goals]).filter(
    (g) => grid.isWalkable(g.gx, g.gy) || (g.gx === start.gx && g.gy === start.gy),
  );
  if (goalList.length === 0) return null;
  const goalSet = new Set(goalList.map((g) => pack(g.gx, g.gy)));
  const startK = pack(start.gx, start.gy);
  if (goalSet.has(startK)) return [{ ...start }];
  const h = (x: number, y: number) => {
    let best = Infinity;
    for (const g of goalList) best = Math.min(best, octile(x, y, g.gx, g.gy));
    return best;
  };
  const maxNodes = opts.maxNodes ?? 20000;
  const open = new MinHeap();
  const gScore = new Map<number, number>([[startK, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  open.push(startK, h(start.gx, start.gy));
  let expanded = 0;
  while (open.size > 0) {
    const cur = open.pop();
    if (closed.has(cur)) continue;
    if (goalSet.has(cur)) return reconstruct(came, cur);
    closed.add(cur);
    if (++expanded > maxNodes) return null;
    const cx = unpackX(cur);
    const cy = unpackY(cur);
    const cg = gScore.get(cur)!;
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.isWalkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))) continue;
      const nk = pack(nx, ny);
      if (closed.has(nk)) continue;
      const ng = cg + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, cur);
        open.push(nk, ng + h(nx, ny));
      }
    }
  }
  return null;
}

function reconstruct(came: Map<number, number>, end: number): GridPoint[] {
  const out: GridPoint[] = [];
  let k: number | undefined = end;
  while (k !== undefined) {
    out.push({ gx: unpackX(k), gy: unpackY(k) });
    k = came.get(k);
  }
  return out.reverse();
}

/** Cache đường đi theo version của lưới. */
export class PathCache {
  private cache = new Map<string, GridPoint[] | null>();
  private version = -1;
  hits = 0;

  constructor(private grid: WalkGrid, private maxSize = 400) {}

  find(start: GridPoint, goals: GridPoint | GridPoint[]): GridPoint[] | null {
    if (this.grid.version !== this.version) {
      this.cache.clear();
      this.version = this.grid.version;
    }
    const gl = Array.isArray(goals) ? goals : [goals];
    const key = `${start.gx},${start.gy}>${gl.map((g) => `${g.gx},${g.gy}`).join(';')}`;
    if (this.cache.has(key)) {
      this.hits++;
      const p = this.cache.get(key)!;
      return p ? p.map((q) => ({ ...q })) : null;
    }
    const p = findPath(this.grid, start, gl);
    if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, p);
    return p ? p.map((q) => ({ ...q })) : null;
  }
}

/** Kiểm tra đường thẳng giữa hai tâm ô có đi được không (lấy mẫu dày, có tính bán kính). */
export function lineWalkable(grid: WalkGrid, a: GridPoint, b: GridPoint, radius = 0.35): boolean {
  const ax = a.gx + 0.5;
  const ay = a.gy + 0.5;
  const bx = b.gx + 0.5;
  const by = b.gy + 0.5;
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const [ox, oy] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
      if (!grid.isWalkable(Math.floor(x + ox), Math.floor(y + oy))) return false;
    }
  }
  return true;
}

/** Làm mượt đường (string-pulling): bỏ các điểm trung gian khi nhìn thẳng được. */
export function smoothPath(grid: WalkGrid, path: GridPoint[]): GridPoint[] {
  if (path.length <= 2) return path.slice();
  const out: GridPoint[] = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!lineWalkable(grid, path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}
