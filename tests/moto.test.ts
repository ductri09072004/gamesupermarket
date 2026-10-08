import { describe, expect, it } from 'vitest';
import { MOTO_DODGE, MOTO_HIT } from '../src/config/traffic';
import { mulberry32 } from '../src/core/Random';
import { Traffic } from '../src/game/Traffic';
import { launchVelocity, steerMoto, type MotoCar } from '../src/game/TrafficMoto';
import { dodgeOffset, motoHits } from '../src/systems/MotoDodge';
import { cityLayout } from '../src/world/CityLayout';
import { poseAt } from '../src/world/CityRoutes';

// xe máy ở gốc toạ độ, chạy về -Z; "bên phải" là +X
const moto = { x: 0, z: 0, dx: 0, dz: -1, off: 0, hw: 0.4 };
const at = (x: number, z: number, lat = 0.8) => ({ x, z, lat, hl: 0.4 });

describe('xe máy chọn đường lách', () => {
  it('không có vật cản: đi giữa làn', () => {
    expect(dodgeOffset(moto, [])).toEqual({ want: 0, blocked: false, nearest: Infinity });
  });

  it('vật cản đứng giữa làn: lách sang bên còn chỗ (trái, vì bên phải sát lề), không phanh', () => {
    const r = dodgeOffset(moto, [at(0, -6)]);
    expect(r.blocked).toBe(false);
    expect(r.want).toBeLessThan(-1);
    expect(r.want).toBeGreaterThanOrEqual(-MOTO_DODGE.offLeft);
    expect(r.nearest).toBeCloseTo(6);
  });

  it('vật cản ở bên trái làn: lách nhẹ sang phải thay vì băng sang trái', () => {
    const r = dodgeOffset(moto, [at(-1.2, -6)]);
    expect(r.blocked).toBe(false);
    expect(r.want).toBeGreaterThan(-0.1);
    expect(r.want).toBeLessThanOrEqual(MOTO_DODGE.offRight);
  });

  it('vật cản phía sau hoặc quá xa thì bỏ qua', () => {
    expect(dodgeOffset(moto, [at(0, 9)]).want).toBe(0);
    expect(dodgeOffset(moto, [at(0, -(MOTO_DODGE.look + 5))]).want).toBe(0);
  });

  it('hai vật cản chặn kín hai bên: báo blocked để xe phanh', () => {
    expect(dodgeOffset(moto, [at(0, -6), at(-2.5, -6)]).blocked).toBe(true);
  });

  it('đánh lái từ từ: mỗi bước chỉ lệch tối đa latSpeed × dt, hết vật cản thì về làn', () => {
    const c: MotoCar = { kind: 'moto', knock: null, ...moto, hl: 0.95, speed: 8, noDodge: false, hornT: 0 };
    steerMoto(c, [at(0, -6)], 0.1);
    expect(c.off).toBeCloseTo(-MOTO_DODGE.latSpeed * 0.1);
    for (let i = 0; i < 100; i++) steerMoto(c, [], 0.1);
    expect(c.off).toBe(0);
  });

  it('còi: chỉ bóp khi vật cản gần, rồi nghỉ', () => {
    const c: MotoCar = { kind: 'moto', knock: null, ...moto, hl: 0.95, speed: 8, noDodge: false, hornT: 0 };
    expect(steerMoto(c, [at(0, -20)], 0.05).honk).toBe(false);
    expect(steerMoto(c, [at(0, -5)], 0.05).honk).toBe(true);
    expect(steerMoto(c, [at(0, -5)], 0.05).honk).toBe(false);
  });
});

describe('xe máy tông người', () => {
  const body = { x: 0, z: 0, dx: 0, dz: -1, hw: 0.4, hl: 0.95 };

  it('người nằm trong thân xe (cộng bán kính) thì bị tông; đứng xa thì không', () => {
    expect(motoHits(body, 0, -1, 0.3).hit).toBe(true);
    expect(motoHits(body, 0.5, 0, 0.3).hit).toBe(true);
    expect(motoHits(body, 1.0, 0, 0.3).hit).toBe(false);
    expect(motoHits(body, 0, -1.5, 0.3).hit).toBe(false);
  });

  it('văng theo chiều xe, hất ra xa tim xe, nhanh hơn khi xe nhanh', () => {
    const c: MotoCar = { kind: 'moto', knock: null, ...moto, hl: 0.95, speed: 8, noDodge: false, hornT: 0 };
    const right = launchVelocity(c, 0.3);
    expect(right.vz).toBeLessThan(0);
    expect(right.vx).toBeGreaterThan(0);
    const left = launchVelocity(c, -0.3);
    expect(left.vx).toBeLessThan(0);
    const slow = launchVelocity({ ...c, speed: 2 }, 0.3);
    expect(Math.hypot(right.vx, right.vz)).toBeGreaterThan(Math.hypot(slow.vx, slow.vz));
    expect(Math.hypot(right.vx, right.vz)).toBeCloseTo(MOTO_HIT.launch + MOTO_HIT.perSpeed * 8);
  });
});

type Inner = { cars: Array<MotoCar & { route: Parameters<typeof poseAt>[0]; d: number }> };
const far = { x: -500, z: -500 };

function lone(): { tr: Traffic; car: Inner['cars'][number] } {
  const tr = new Traffic();
  (tr as unknown as { rng: () => number }).rng = mulberry32(7);
  tr.reset(cityLayout(10, 12));
  // NPC xe máy đã tắt; tạo fixture riêng để tiếp tục kiểm tra thuật toán né/va chạm.
  (tr as unknown as { spawn: (kind: 'moto', player: null) => void }).spawn('moto', null);
  const inner = tr as unknown as Inner;
  const car = inner.cars.find((c) => c.kind === 'moto')!;
  inner.cars = [car];
  return { tr, car };
}

describe('xe máy trên phố (tích hợp)', () => {
  it('gặp người đứng chắn giữa làn thì lách qua, không dừng chờ', () => {
    const { tr, car } = lone();
    const p = poseAt(car.route, car.d + 22);
    const obstacle = [{ x: p.x, z: p.z, lat: 1.4 }];
    let minSpeed = Infinity;
    let travelled = 0;
    for (let i = 0; i < 160; i++) {
      tr.update(0.05, far, obstacle, false);
      minSpeed = Math.min(minSpeed, car.speed);
      travelled += car.speed * 0.05;
    }
    expect(minSpeed).toBeGreaterThan(MOTO_DODGE.slow * 4); // vẫn chạy, không phanh về 0
    expect(travelled).toBeGreaterThan(40); // đã vượt qua vật cản
  });

  it('người chơi bước ra sát đầu xe, né không kịp: bị tông và có vận tốc văng', () => {
    const { tr, car } = lone();
    const hits: Array<{ vx: number; vz: number }> = [];
    tr.onHitPlayer = (vx, vz) => hits.push({ vx, vz });
    car.speed = 8;
    const p = poseAt(car.route, car.d + 1.0);
    tr.update(0.016, far, [], false);
    expect(hits).toHaveLength(0); // đang không đi bộ trên đường → không tông
    tr.update(0.016, { x: p.x, z: p.z }, [], true);
    expect(hits).toHaveLength(1);
    const h = hits[0];
    // văng cùng hướng xe chạy
    expect(h.vx * car.dx + h.vz * car.dz).toBeGreaterThan(5);
    // tông xong có nghỉ, không tông liên tiếp
    tr.update(0.016, { x: p.x, z: p.z }, [], true);
    expect(hits).toHaveLength(1);
  });
});
