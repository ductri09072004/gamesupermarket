import type { FurnitureDef } from '../config/furniture';
import type { GridPoint } from './IsoMath';

export const DIRS: GridPoint[] = [
  { gx: 0, gy: 1 },
  { gx: 1, gy: 0 },
  { gx: 0, gy: -1 },
  { gx: -1, gy: 0 },
];

export function rotatedSize(def: Pick<FurnitureDef, 'footprint'>, rot: number): { w: number; h: number } {
  const { w, h } = def.footprint;
  return rot % 2 === 0 ? { w, h } : { w: h, h: w };
}

export function footprintCells(def: Pick<FurnitureDef, 'footprint'>, gx: number, gy: number, rot: number): GridPoint[] {
  const { w, h } = rotatedSize(def, rot);
  const cells: GridPoint[] = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cells.push({ gx: gx + dx, gy: gy + dy });
  return cells;
}

/** Hướng "mặt trước" của nội thất theo rot. */
export function frontDir(rot: number): GridPoint {
  return DIRS[((rot % 4) + 4) % 4];
}

/** Ô đứng của thu ngân (phía sau) và ô khách đứng (phía trước) của quầy. */
export function counterTiles(gx: number, gy: number, rot: number): { staff: GridPoint; customer: GridPoint; dir: GridPoint } {
  const f = frontDir(rot);
  return {
    staff: { gx: gx - f.gx, gy: gy - f.gy },
    customer: { gx: gx + f.gx, gy: gy + f.gy },
    dir: f,
  };
}

/** Các ô kề (4 hướng) quanh footprint, không thuộc footprint. */
export function adjacentTiles(cells: GridPoint[]): GridPoint[] {
  const key = (p: GridPoint) => `${p.gx},${p.gy}`;
  const own = new Set(cells.map(key));
  const out = new Map<string, GridPoint>();
  for (const c of cells) {
    for (const d of DIRS) {
      const n = { gx: c.gx + d.gx, gy: c.gy + d.gy };
      const k = key(n);
      if (!own.has(k)) out.set(k, n);
    }
  }
  return [...out.values()];
}

export function cellsOverlap(a: GridPoint[], b: GridPoint[]): boolean {
  const s = new Set(a.map((p) => `${p.gx},${p.gy}`));
  return b.some((p) => s.has(`${p.gx},${p.gy}`));
}

/** Khoảng cách từ điểm (float) tới ô gần nhất trong footprint (tính theo tâm ô). */
export function distanceToCells(px: number, py: number, cells: GridPoint[]): { dist: number; cell: GridPoint } {
  let best = { dist: Infinity, cell: cells[0] };
  for (const c of cells) {
    const cx = Math.max(c.gx, Math.min(px, c.gx + 1));
    const cy = Math.max(c.gy, Math.min(py, c.gy + 1));
    const d = Math.hypot(px - cx, py - cy);
    if (d < best.dist) best = { dist: d, cell: c };
  }
  return best;
}
