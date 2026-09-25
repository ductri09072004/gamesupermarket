import { describe, expect, it } from 'vitest';
import { aabb, moveCircle, resolveCircle } from '../src/world/Colliders';

describe('Va chạm AABB', () => {
  const wall = aabb(0, 0, 10, 0.2, 'wall'); // tường chạy theo X, dày 0.2

  it('không chạm thì giữ nguyên', () => {
    expect(resolveCircle(0, 2, 0.3, [wall])).toEqual({ x: 0, z: 2, hit: false });
  });

  it('đẩy ra khỏi tường theo pháp tuyến', () => {
    const r = resolveCircle(1, 0.3, 0.3, [wall]);
    expect(r.hit).toBe(true);
    expect(r.z).toBeCloseTo(0.4, 3);
    expect(r.x).toBeCloseTo(1);
  });

  it('trượt dọc tường khi đi chéo', () => {
    const p = moveCircle(0, 0.5, 1, -1, 0.3, [wall]);
    expect(p.x).toBeCloseTo(1, 1);
    expect(p.z).toBeGreaterThanOrEqual(0.4 - 1e-3);
  });

  it('không xuyên qua tường mỏng khi đi nhanh', () => {
    const p = moveCircle(0, 1, 0, -3, 0.3, [wall]);
    expect(p.z).toBeGreaterThan(0);
  });

  it('không kẹt ở góc trong', () => {
    const w2 = aabb(-5, 2.5, 0.2, 5, 'wall2');
    const p = moveCircle(-4.4, 0.5, -1, -1, 0.3, [wall, w2]);
    expect(p.x).toBeGreaterThanOrEqual(-4.6 - 1e-3);
    expect(p.z).toBeGreaterThanOrEqual(0.4 - 1e-3);
    const back = moveCircle(p.x, p.z, 1, 1, 0.3, [wall, w2]);
    expect(back.x).toBeGreaterThan(p.x + 0.5);
  });

  it('tâm nằm trong hộp → đẩy ra cạnh gần nhất', () => {
    const box = aabb(0, 0, 2, 2, 'b');
    const r = resolveCircle(0.9, 0, 0.3, [box]);
    expect(r.x).toBeCloseTo(1.3, 3);
  });
});
