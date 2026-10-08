import { describe, expect, it } from 'vitest';
import { MAIN_PARK_STRIP, MAIN_ROAD_WIDTH } from '../src/config/city';
import { BUS, RUSH_HOURS, TRAFFIC, YIELD } from '../src/config/traffic';
import { mulberry32 } from '../src/core/Random';
import { Traffic } from '../src/game/Traffic';
import { busDue, busPassengers, busTimes, trafficDensity, wearsRaincoat } from '../src/systems/TrafficSystem';
import { rectsOverlap, cityLayout } from '../src/world/CityLayout';
import { carLoops, onRoad, poseAt } from '../src/world/CityRoutes';

const far = { x: -500, z: -500 };

function makeTraffic(): { tr: Traffic; L: ReturnType<typeof cityLayout> } {
  const L = cityLayout(10, 12);
  const tr = new Traffic();
  (tr as unknown as { rng: () => number }).rng = mulberry32(7);
  tr.reset(L);
  return { tr, L };
}

describe('mật độ giao thông', () => {
  it('cao điểm xe máy đông hơn hẳn, ô tô chỉ nhỉnh hơn; khuya vắng', () => {
    expect(trafficDensity(8, 'moto')).toBeGreaterThan(trafficDensity(8, 'car'));
    expect(trafficDensity(8, 'moto')).toBeGreaterThan(trafficDensity(13, 'moto'));
    expect(trafficDensity(13, 'moto')).toBe(1);
    expect(trafficDensity(23)).toBeLessThan(0.5);
    expect(trafficDensity(6)).toBeLessThan(1);
    for (const [a, b] of RUSH_HOURS) expect(trafficDensity((a + b) / 2, 'moto')).toBeGreaterThan(1);
  });

  it('trời mưa hầu hết xe máy mặc áo mưa, trời khô thì không', () => {
    expect(wearsRaincoat(0, 0)).toBe(false);
    expect(wearsRaincoat(0.1, 0)).toBe(false);
    expect(wearsRaincoat(0.8, 0.3)).toBe(true);
    expect(wearsRaincoat(0.8, 0.99)).toBe(false);
  });
});

describe('lịch xe buýt', () => {
  it('chuyến cách nhau đều trong khung giờ chạy', () => {
    const t = busTimes();
    expect(t[0]).toBe(BUS.firstHour);
    expect(t[t.length - 1]).toBeLessThanOrEqual(BUS.lastHour + 1e-6);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(BUS.everyH, 6);
  });

  it('busDue chỉ báo khi giờ game vượt qua một chuyến; sang ngày mới thì không báo bừa', () => {
    expect(busDue(6.4, 6.6)).toBe(BUS.firstHour);
    expect(busDue(6.6, 6.9)).toBeNull();
    expect(busDue(6.4, 6.4)).toBeNull();
    expect(busDue(21.9, 6.0)).toBeNull();
  });

  it('cao điểm khách xuống đông hơn; luôn ≥ 1', () => {
    const rng = mulberry32(3);
    let rush = 0;
    let calm = 0;
    for (let i = 0; i < 300; i++) {
      rush += busPassengers(8, rng);
      calm += busPassengers(13, rng);
    }
    expect(rush).toBeGreaterThan(calm);
    expect(busPassengers(13, () => 0)).toBe(BUS.passengers[0]);
  });
});

describe('trạm xe buýt trong bố cục', () => {
  it('mái trạm nằm trên vỉa hè cửa hàng, không đè nhà / cây / cột / đèn nào; xe đỗ giữa làn xe chạy', () => {
    const L = cityLayout(10, 12);
    const s = L.busStop.shelter;
    expect(onRoad(L.roads, (s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2)).toBe(false);
    const road = L.roads[1];
    expect(s.z1).toBeLessThan(road.z0);
    // mọi vật trong bố cục (trừ chính mái trạm) không chồng lên mái trạm
    for (const c of L.colliders) {
      if (c.tag === 'busstop') continue;
      expect(rectsOverlap({ x0: c.minX, x1: c.maxX, z0: c.minZ, z1: c.maxZ }, s), `va chạm với ${c.tag}`).toBe(false);
    }
    expect(L.busStop.bay.z).toBeCloseTo(road.z0 + MAIN_ROAD_WIDTH / 2 + MAIN_PARK_STRIP / 2, 6);
  });

  it('xe buýt đỗ đúng làn ô tô của khối phố cạnh cửa hàng', () => {
    const { L } = makeTraffic();
    const routes = carLoops(L.loopCenters);
    const best = Math.min(...routes.map((r) => {
      let d = Infinity;
      for (let t = 0; t < r.total; t += 0.5) {
        const p = poseAt(r, t);
        d = Math.min(d, Math.hypot(p.x - L.busStop.bay.x, p.z - L.busStop.bay.z));
      }
      return d;
    }));
    expect(best).toBeLessThan(0.6);
  });
});

describe('ô tô & xe buýt chạy trên phố', () => {
  it('không tạo xe máy khi dựng phố, cập nhật giao thông hoặc dựng lại phố', () => {
    const { tr, L } = makeTraffic();
    expect(tr.count('moto')).toBe(0);
    expect(tr.count('car')).toBe(TRAFFIC.maxCars / 2);
    for (const hour of [8, 13, 18, 23]) {
      tr.hour = hour;
      for (let i = 0; i < 1200; i++) {
        tr.update(0.25, far, []);
        expect(tr.count('moto')).toBe(0);
      }
      expect(tr.count('car')).toBeGreaterThan(0);
    }
    tr.reset(L);
    expect(tr.count('moto')).toBe(0);
    expect(tr.count('car')).toBeGreaterThan(0);
  });
  it('xe buýt xuất phát theo lịch, dừng ở trạm, xả hơi, thả khách rồi đi tiếp', () => {
    const { tr, L } = makeTraffic();
    const events: string[] = [];
    let pax: { x: number; z: number; n: number } | null = null;
    tr.onSound = (name) => events.push(name);
    tr.onPassengers = (x, z, n) => { pax = { x, z, n }; };
    tr.hour = 6.4;
    tr.update(0.05, far, []);
    tr.hour = 6.6; // vượt chuyến 6:30
    let arrived = -1;
    let seen = false;
    for (let i = 0; i < 4000 && !pax; i++) {
      tr.update(0.05, far, []);
      seen ||= tr.count('bus') > 0;
      if (seen && tr.count('bus') === 0) break;
    }
    expect(pax).not.toBeNull();
    arrived = tr.count('bus');
    expect(arrived).toBe(1);
    const p = pax!;
    expect(p.n).toBeGreaterThanOrEqual(BUS.passengers[0]);
    // cửa xe nằm ngoài mái trạm, sát vỉa hè phía trước cửa hàng
    expect(p.z).toBeGreaterThan(L.busStop.shelter.z1 - 2);
    expect(p.z).toBeLessThan(L.roads[1].z0);
    expect(Math.abs(p.x - L.busStop.bay.x)).toBeLessThan(5);
    expect(events).toContain('airBrake');
    // dwell xong thì xe đi tiếp và xả hơi lần nữa
    for (let i = 0; i < 400; i++) tr.update(0.05, far, []);
    expect(events.filter((e) => e === 'airBrake').length).toBe(2);
    // chuyến tiếp theo chưa đến giờ → không thả thêm khách
    pax = null;
    for (let i = 0; i < 400; i++) tr.update(0.05, far, []);
    expect(pax).toBeNull();
  });

  it('xe buýt chưa xuất hiện khi người chơi đứng sát điểm xuất phát (không "hiện hình" trước mặt)', () => {
    const { tr, L } = makeTraffic();
    tr.hour = 6.4;
    tr.update(0.05, far, []);
    tr.hour = 6.6;
    // đặt người chơi ngay trên tuyến buýt gần đầu tuyến: chuyến bị hoãn, không sinh xe
    const svc = (tr as unknown as { service: { route: { total: number }; startD: number } }).service;
    const start = poseAt(svc.route as never, svc.startD);
    for (let i = 0; i < 20; i++) tr.update(0.05, { x: start.x, z: start.z }, []);
    expect(tr.count('bus')).toBe(0);
    expect(L.busStop).toBeDefined();
  });
});

describe('gỡ kẹt', () => {
  it('xe bị vật cản đứng chắn giữa hẻm thì tự leo lề, lách qua rồi nhập lại làn', () => {
    const { tr } = makeTraffic();
    const inner = tr as unknown as { cars: Array<{ kind: string; route: Parameters<typeof poseAt>[0]; d: number; x: number; z: number; off: number; speed: number; blockedT: number }> };
    const car = inner.cars.find((c) => c.kind === 'car')!;
    inner.cars = [car];
    // vật cản (xe chết máy) đứng giữa làn, 20m phía trước xe
    const at = poseAt(car.route, car.d + 20);
    const block = [{ x: at.x, z: at.z, lat: 1.4 }];
    let maxOff = 0;
    let stopped = false;
    let travelled = 0;
    for (let i = 0; i < 1000; i++) {
      tr.update(0.05, far, block);
      if (!inner.cars.includes(car)) break;
      maxOff = Math.max(maxOff, car.off);
      if (car.speed < 0.2) stopped = true;
      travelled += car.speed * 0.05;
    }
    expect(stopped).toBe(true); // ban đầu phải dừng sau vật cản
    expect(maxOff).toBeGreaterThan(YIELD.offset.car - 0.2); // rồi leo lề
    // nếu không lách qua thì chỉ đi được ~15m tới sát vật cản; lách được thì vượt xa
    expect(travelled).toBeGreaterThan(45);
    expect(car.off).toBeLessThan(YIELD.offset.car + 1e-6);
  });

  it('xe không bị chặn thì không lệch lề', () => {
    const { tr } = makeTraffic();
    for (let i = 0; i < 200; i++) tr.update(0.05, far, []);
    const cars = (tr as unknown as { cars: Array<{ off: number; kind: string }> }).cars;
    expect(cars.filter((c) => c.kind === 'car').every((c) => c.off === 0)).toBe(true);
  });
});
