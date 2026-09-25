import type { FurnitureDef } from '../config/furniture';

/** Toạ độ ô lưới (0.5m). */
export interface GridPoint {
  gx: number;
  gy: number;
}

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

/** Hướng mặt trước (phía khách đứng) theo rot. rot 0 → +Z. */
export function frontDir(rot: number): GridPoint {
  return DIRS[((rot % 4) + 4) % 4];
}

/** Góc quay quanh Y để mặt trước model (-Z) quay về frontDir. */
export function rotationY(rot: number): number {
  const f = frontDir(rot);
  return Math.atan2(-f.gx, -f.gy);
}

/** Các ô ngay trước mặt trước của nội thất. */
export function frontTiles(def: Pick<FurnitureDef, 'footprint'>, gx: number, gy: number, rot: number): GridPoint[] {
  const { w, h } = rotatedSize(def, rot);
  const r = ((rot % 4) + 4) % 4;
  const out: GridPoint[] = [];
  if (r === 0) for (let i = 0; i < w; i++) out.push({ gx: gx + i, gy: gy + h });
  if (r === 2) for (let i = 0; i < w; i++) out.push({ gx: gx + i, gy: gy - 1 });
  if (r === 1) for (let i = 0; i < h; i++) out.push({ gx: gx + w, gy: gy + i });
  if (r === 3) for (let i = 0; i < h; i++) out.push({ gx: gx - 1, gy: gy + i });
  return out;
}

/** Ô thu ngân đứng (phía sau) và ô khách đứng (phía trước) của quầy. */
export function counterTiles(
  def: Pick<FurnitureDef, 'footprint'>, gx: number, gy: number, rot: number,
): { staff: GridPoint; customer: GridPoint; dir: GridPoint } {
  const { w, h } = rotatedSize(def, rot);
  const r = ((rot % 4) + 4) % 4;
  const dir = frontDir(r);
  switch (r) {
    case 0: return { staff: { gx: gx + 1, gy: gy - 1 }, customer: { gx: gx + 1, gy: gy + h }, dir };
    case 1: return { staff: { gx: gx - 1, gy: gy + 1 }, customer: { gx: gx + w, gy: gy + 1 }, dir };
    case 2: return { staff: { gx: gx + w - 2, gy: gy + h }, customer: { gx: gx + w - 2, gy: gy - 1 }, dir };
    default: return { staff: { gx: gx + w, gy: gy + h - 2 }, customer: { gx: gx - 1, gy: gy + h - 2 }, dir };
  }
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
