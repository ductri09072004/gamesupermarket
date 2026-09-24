import { TILE_H, TILE_W } from '../config/constants';

export interface Point {
  x: number;
  y: number;
}

export interface GridPoint {
  gx: number;
  gy: number;
}

export interface CameraLike {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export const ORIGIN: Point = { x: 0, y: 0 };

/** Góc trên của ô (gx, gy) — hoặc điểm bất kỳ nếu gx, gy là số thực. */
export function gridToScreen(gx: number, gy: number, origin: Point = ORIGIN): Point {
  return {
    x: (gx - gy) * (TILE_W / 2) + origin.x,
    y: (gx + gy) * (TILE_H / 2) + origin.y,
  };
}

/** Toạ độ lưới thực (float) từ toạ độ world. */
export function screenToGridFloat(sx: number, sy: number, origin: Point = ORIGIN): GridPoint {
  const a = (sx - origin.x) / (TILE_W / 2);
  const b = (sy - origin.y) / (TILE_H / 2);
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/** Ô lưới chứa điểm world (sx, sy). */
export function screenToGrid(sx: number, sy: number, origin: Point = ORIGIN): GridPoint {
  const f = screenToGridFloat(sx, sy, origin);
  return { gx: Math.floor(f.gx + 1e-9), gy: Math.floor(f.gy + 1e-9) };
}

/** Tâm ô trên màn hình (world). */
export function tileCenter(gx: number, gy: number, origin: Point = ORIGIN): Point {
  return gridToScreen(gx + 0.5, gy + 0.5, origin);
}

/** Chuyển toạ độ màn hình (pixel canvas) sang world, theo camera Phaser (origin 0.5). */
export function cameraToWorld(sx: number, sy: number, cam: CameraLike): Point {
  const cx = cam.width / 2;
  const cy = cam.height / 2;
  return {
    x: cam.scrollX + cx + (sx - cx) / cam.zoom,
    y: cam.scrollY + cy + (sy - cy) / cam.zoom,
  };
}

export function worldToCamera(wx: number, wy: number, cam: CameraLike): Point {
  const cx = cam.width / 2;
  const cy = cam.height / 2;
  return {
    x: (wx - cam.scrollX - cx) * cam.zoom + cx,
    y: (wy - cam.scrollY - cy) * cam.zoom + cy,
  };
}

/** Ô lưới dưới con trỏ chuột (toạ độ canvas), có tính camera scroll/zoom. */
export function pointerToGrid(sx: number, sy: number, cam: CameraLike, origin: Point = ORIGIN): GridPoint {
  const w = cameraToWorld(sx, sy, cam);
  return screenToGrid(w.x, w.y, origin);
}

/** Vector di chuyển WASD (màn hình) → vector lưới đã chuẩn hoá. */
export function inputToGridVector(up: boolean, down: boolean, left: boolean, right: boolean): GridPoint {
  let gx = 0;
  let gy = 0;
  if (up) { gx -= 1; gy -= 1; }
  if (down) { gx += 1; gy += 1; }
  if (left) { gx -= 1; gy += 1; }
  if (right) { gx += 1; gy -= 1; }
  const len = Math.hypot(gx, gy);
  if (len === 0) return { gx: 0, gy: 0 };
  return { gx: gx / len, gy: gy / len };
}

export type Facing = 'down' | 'up' | 'left' | 'right';

/** Hướng hiển thị (4 hướng màn hình) từ vector lưới. */
export function facingFromGridVector(dgx: number, dgy: number): Facing {
  const sx = dgx - dgy;
  const sy = (dgx + dgy) / 2;
  if (Math.abs(sx) > Math.abs(sy) * 1.5) return sx < 0 ? 'left' : 'right';
  return sy < 0 ? 'up' : 'down';
}
