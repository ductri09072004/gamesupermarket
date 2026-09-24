import { describe, expect, it } from 'vitest';
import {
  cameraToWorld, facingFromGridVector, gridToScreen, inputToGridVector, pointerToGrid, screenToGrid,
  screenToGridFloat, tileCenter, worldToCamera,
} from '../src/iso/IsoMath';

describe('IsoMath', () => {
  it('gridToScreen theo công thức 2:1', () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToScreen(1, 0)).toEqual({ x: 32, y: 16 });
    expect(gridToScreen(0, 1)).toEqual({ x: -32, y: 16 });
    expect(gridToScreen(2, 3, { x: 100, y: 50 })).toEqual({ x: 100 - 32, y: 50 + 80 });
  });

  it('round-trip chính xác với nhiều ô', () => {
    const origin = { x: 37, y: -12 };
    for (let gx = -10; gx <= 30; gx++) {
      for (let gy = -10; gy <= 30; gy++) {
        const c = tileCenter(gx, gy, origin);
        expect(screenToGrid(c.x, c.y, origin)).toEqual({ gx, gy });
        const f = screenToGridFloat(gridToScreen(gx, gy, origin).x, gridToScreen(gx, gy, origin).y, origin);
        expect(f.gx).toBeCloseTo(gx);
        expect(f.gy).toBeCloseTo(gy);
      }
    }
  });

  it('điểm gần mép ô vẫn thuộc đúng ô', () => {
    const top = gridToScreen(3, 4);
    expect(screenToGrid(top.x, top.y + 1)).toEqual({ gx: 3, gy: 4 });
    expect(screenToGrid(top.x, top.y + 31)).toEqual({ gx: 3, gy: 4 });
  });

  it('camera scroll/zoom round-trip', () => {
    const cams = [
      { scrollX: 0, scrollY: 0, zoom: 1, width: 800, height: 600 },
      { scrollX: -250, scrollY: 120, zoom: 0.5, width: 1280, height: 720 },
      { scrollX: 400, scrollY: -300, zoom: 2, width: 1024, height: 768 },
    ];
    for (const cam of cams) {
      for (let gx = -3; gx < 15; gx += 2) {
        for (let gy = -3; gy < 15; gy += 3) {
          const c = tileCenter(gx, gy);
          const s = worldToCamera(c.x, c.y, cam);
          const w = cameraToWorld(s.x, s.y, cam);
          expect(w.x).toBeCloseTo(c.x);
          expect(w.y).toBeCloseTo(c.y);
          expect(pointerToGrid(s.x, s.y, cam)).toEqual({ gx, gy });
        }
      }
    }
  });

  it('WASD xoay theo trục iso và chuẩn hoá', () => {
    const w = inputToGridVector(true, false, false, false);
    expect(w.gx).toBeCloseTo(-Math.SQRT1_2);
    expect(w.gy).toBeCloseTo(-Math.SQRT1_2);
    const d = inputToGridVector(false, false, false, true);
    expect(d.gx).toBeGreaterThan(0);
    expect(d.gy).toBeLessThan(0);
    const wd = inputToGridVector(true, false, false, true);
    expect(Math.hypot(wd.gx, wd.gy)).toBeCloseTo(1);
    expect(inputToGridVector(true, true, false, false)).toEqual({ gx: 0, gy: 0 });
  });

  it('hướng nhìn 4 hướng', () => {
    expect(facingFromGridVector(-1, -1)).toBe('up');
    expect(facingFromGridVector(1, 1)).toBe('down');
    expect(facingFromGridVector(-1, 1)).toBe('left');
    expect(facingFromGridVector(1, -1)).toBe('right');
  });
});
