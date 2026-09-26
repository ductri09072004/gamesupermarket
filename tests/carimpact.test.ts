import { describe, expect, it } from 'vitest';
import { CAR_IMPACT } from '../src/config/physics';
import { obbContact, resolveImpact, type CarBody } from '../src/systems/CarImpact';

const car = (x: number, z: number, yaw: number, vx: number, vz: number, mass = 1200): CarBody => ({ x, z, yaw, vx, vz, w: 0, hw: 0.9, hl: 2, mass });

describe('va chạm xe (vật rắn 2D)', () => {
  it('không chạm thì không có tiếp xúc', () => {
    expect(obbContact(car(0, 0, 0, 0, 0), car(0, 5, 0, 0, 0))).toBeNull();
  });

  it('đâm thẳng 2 xe bằng khối lượng: bảo toàn động lượng, nảy theo hệ số, bị tách ra', () => {
    // A (đầu -Z) chạy về -Z, B đứng ngay phía trước, chồng lấn 0.2m
    const a = car(0, 0, 0, 0, -10);
    const b = car(0, -3.8, 0, 0, 0);
    const c = obbContact(a, b)!;
    expect(c.nz).toBeCloseTo(-1);
    expect(c.depth).toBeCloseTo(0.2);
    const hit = resolveImpact(a, b, c);
    expect(hit).toBeCloseTo(10);
    expect(a.vz + b.vz).toBeCloseTo(-10); // động lượng
    expect(b.vz - a.vz).toBeCloseTo(-10 * CAR_IMPACT.restitution);
    expect(Math.abs(a.w) + Math.abs(b.w)).toBeLessThan(1e-6);
    expect(obbContact(a, b)).toBeNull();
  });

  it('đâm lệch tâm vào hông xe khác: xe bị đâm vừa văng vừa xoay', () => {
    const a = car(0, 0, 0, 0, -12);
    // B nằm ngang (yaw 90°) phía trước, lệch sang phải 1.2m
    const b = car(1.2, -2.7, Math.PI / 2, 0, 0);
    const c = obbContact(a, b)!;
    expect(c).not.toBeNull();
    resolveImpact(a, b, c);
    expect(b.vz).toBeLessThan(-2);
    expect(Math.abs(b.w)).toBeGreaterThan(0.3);
  });

  it('vật cố định (khối lượng vô hạn) không bị đẩy, xe bật ngược lại', () => {
    const a = car(0, 0, 0, 0, -8);
    const wall: CarBody = { x: 0, z: -2.9, yaw: 0, vx: 0, vz: 0, w: 0, hw: 5, hl: 1, mass: Infinity };
    resolveImpact(a, wall, obbContact(a, wall)!);
    expect(wall.vz).toBe(0);
    expect(wall.z).toBeCloseTo(-2.9);
    expect(a.vz).toBeCloseTo(8 * CAR_IMPACT.restitution);
  });
});
