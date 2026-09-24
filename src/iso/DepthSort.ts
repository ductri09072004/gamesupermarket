/**
 * depth = (gx + gy) * 10 + layerOffset.
 * Nhân vật dùng toạ độ thực (tâm ô = gx + 0.5) nên depth thay đổi mượt khi di chuyển.
 */
export const LAYER = {
  furniture: 0,
  box: 1,
  character: 2,
  wall: 0,
} as const;

export const DEPTH_FLOOR = -1_000_000;
export const DEPTH_FLOOR_OVERLAY = -999_000;
export const DEPTH_UI = 1_000_000;
export const DEPTH_LIGHT = 900_000;

export function depthAt(gx: number, gy: number, layer = 0): number {
  return (gx + gy) * 10 + layer;
}

/** Vật nhiều ô: dùng ô có gx+gy lớn nhất của footprint (tâm ô). */
export function footprintDepth(cells: Array<{ gx: number; gy: number }>, layer = LAYER.furniture): number {
  let best = -Infinity;
  for (const c of cells) best = Math.max(best, c.gx + c.gy);
  return depthAt(best + 1, 0, layer);
}
