import { describe, expect, it } from 'vitest';
import { cityLayout, V_ROADS } from '../src/world/CityLayout';
import { canStartCrossing, pedestrianGreen, signalColor } from '../src/world/TrafficSignals';
import { redStopDistance, routeCrossingStops } from '../src/world/Crosswalks';
import { carLoops, poseAt } from '../src/world/CityRoutes';
import { ONE_WAY_BLOCKS } from '../src/config/traffic';
import { Traffic, type Car } from '../src/game/Traffic';

describe('đèn giao thông', () => {
  it('hai hướng không bao giờ cùng xanh/vàng, có khoảng đỏ chung', () => {
    for (let t = -64; t < 128; t += 0.25) {
      expect(signalColor(t, 'x') === 'red' || signalColor(t, 'z') === 'red').toBe(true);
      if (pedestrianGreen(t)) {
        expect(signalColor(t, 'x')).toBe('red');
        expect(signalColor(t, 'z')).toBe('red');
      }
    }
    expect(signalColor(18, 'x')).toBe('amber');
    expect(signalColor(21, 'x')).toBe('red');
    expect(signalColor(21, 'z')).toBe('red');
    expect(signalColor(23, 'z')).toBe('green');
    expect(signalColor(64, 'x')).toBe('green');
  });

  it('người chỉ bắt đầu lúc xanh và đủ thời gian sang hết đường', () => {
    expect(canStartCrossing(45, 0, 8.7, 1)).toBe(false);
    expect(canStartCrossing(46, 0, 8.7, 1)).toBe(true);
    expect(canStartCrossing(57, 0, 8.7, 1)).toBe(false);
    expect(canStartCrossing(58, 0, 3, 1)).toBe(false);
    expect(canStartCrossing(46, 0, 8.7, 0)).toBe(false);
  });

  for (const kind of ['car', 'bus'] as const) it(`${kind}: không vượt vạch đỏ, không leo lề và chạy lại khi xanh`, () => {
    const L = cityLayout(10);
    const traffic = new Traffic();
    traffic.reset(L);
    const internal = traffic as unknown as { cars: Car[]; spawnT: number; motoT: number };
    const car = internal.cars.find((c) => c.kind === (kind === 'bus' ? 'car' : kind))!;
    if (kind === 'bus') { car.kind = 'bus'; car.hl = 4.5; car.hw = 1.3; }
    internal.cars = [car];
    internal.spawnT = internal.motoT = Infinity;
    traffic.hour = 0;
    const stops = routeCrossingStops(car.route, L.crosswalks);
    expect(stops.length).toBeGreaterThan(0);
    const stop = stops[0];
    const stopD = stop.d - car.hl - 0.6;
    car.d = stopD - 8;
    Object.assign(car, poseAt(car.route, car.d));
    car.speed = 8;
    traffic.signalTime = 46 - stop.crosswalk.offset;
    for (let i = 0; i < 240; i++) {
      traffic.signalTime = 46 - stop.crosswalk.offset;
      traffic.update(1 / 30, { x: car.x, z: car.z }, [], false);
      expect(car.d).toBeLessThanOrEqual(stopD + 1e-6);
    }
    expect(car.speed).toBeLessThan(0.01);
    expect(car.off).toBeCloseTo(0);
    expect(car.yieldLeft).toBe(0);
    const before = car.d;
    const green = stop.crosswalk.axis === 'x' ? 0 : 23;
    for (let i = 0; i < 60; i++) {
      traffic.signalTime = green - stop.crosswalk.offset;
      traffic.update(1 / 30, { x: car.x, z: car.z }, [], false);
    }
    expect(car.d).toBeGreaterThan(before + 1);
    traffic.destroy();
  });

  it('xe tiếp tục nhường người còn trên vạch dù tín hiệu xe đã xanh', () => {
    const L = cityLayout(10);
    const route = carLoops([L.loopCenters[ONE_WAY_BLOCKS[0]]])[0];
    const stop = routeCrossingStops(route, L.crosswalks)[0];
    const d = stop.d - 2 - 0.6 - 3;
    const green = (stop.crosswalk.axis === 'x' ? 0 : 23) - stop.crosswalk.offset;
    expect(redStopDistance(route, d, 2, [stop], green, new Set())).toBe(Infinity);
    expect(redStopDistance(route, d, 2, [stop], green, new Set([stop.crosswalk.id]))).toBeCloseTo(3);
  });

  for (const depth of [10, 20]) it(`D=${depth}: phủ ngã tư, ngã ba và góc rẽ, cột nằm ngoài đường`, () => {
    const L = cityLayout(depth);
    for (let i = 0; i < V_ROADS.length; i++) for (let j = 0; j < L.hz.length; j++) {
      const nearby = L.signals.filter((s) => Math.abs(s.x - V_ROADS[i]) < 10 && Math.abs(s.z - L.hz[j]) < 10);
      const count = Number(i > 0) + Number(i < V_ROADS.length - 1) + Number(j > 0) + Number(j < L.hz.length - 1);
      expect(nearby.length).toBe(count);
      for (const s of nearby) {
        expect(L.roads.some((r) => s.x > r.x0 && s.x < r.x1 && s.z > r.z0 && s.z < r.z1)).toBe(false);
        expect(L.signs.posts.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 0.4)).toBe(false);
      }
    }
  });
});
