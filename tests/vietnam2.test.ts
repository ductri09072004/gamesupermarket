import { describe, expect, it } from 'vitest';
import { VENDOR_GOODS, VENDOR_TAKE, VENDOR_TAKE_CHEAP } from '../src/config/city';
import { getFurniture } from '../src/config/furniture';
import { POTHOLE } from '../src/config/physics';
import { getVehicle } from '../src/config/vehicles';
import { createNewState } from '../src/core/GameState';
import { mulberry32 } from '../src/core/Random';
import { migrate } from '../src/core/SaveSystem';
import { brokenItems, bumpStrength, dropChance, holesUnder, wheelPoints } from '../src/systems/PotholeSystem';
import { competingShift, incenseBurning, incenseLitToday, vendorTakeChance } from '../src/systems/VendorSystem';
import { cityLayout } from '../src/world/CityLayout';

describe('ổ gà khi lái xe', () => {
  it('bánh xe máy thẳng hàng, ô tô 4 bánh; lăn qua ổ gà thì bắt được', () => {
    expect(wheelPoints(0, 0, 0, getVehicle('moto'))).toHaveLength(2);
    const car = wheelPoints(0, 0, 0, getVehicle('car'));
    expect(car).toHaveLength(4);
    // yaw 0 → đầu xe hướng -Z: bánh trước ở z < 0
    expect(Math.min(...car.map(([, z]) => z))).toBeLessThan(0);
    const [fx, fz] = car[0];
    expect(holesUnder(car, [{ x: fx, z: fz, r: 0.4 }, { x: 50, z: 50, r: 0.4 }])).toEqual([0]);
    expect(holesUnder(car, [{ x: fx + 1, z: fz, r: 0.4 }])).toEqual([]);
  });

  it('đi chậm không rơi thùng; nhanh & ổ to thì rơi nhiều hơn; xe máy dễ rơi nhất, ô tô ít nhất', () => {
    expect(dropChance(POTHOLE.minSpeed - 0.5, 0.5, 'moto')).toBe(0);
    expect(dropChance(12, 0.5, 'moto')).toBeGreaterThan(dropChance(6, 0.5, 'moto'));
    expect(dropChance(10, 0.6, 'moto')).toBeGreaterThan(dropChance(10, 0.25, 'moto'));
    expect(dropChance(10, 0.4, 'moto')).toBeGreaterThan(dropChance(10, 0.4, 'pickup'));
    expect(dropChance(10, 0.4, 'pickup')).toBeGreaterThan(dropChance(10, 0.4, 'car'));
    expect(dropChance(40, 1, 'moto')).toBeLessThanOrEqual(POTHOLE.maxDrop);
    expect(bumpStrength(0, 0.5)).toBe(0);
    expect(bumpStrength(30, 1)).toBe(1);
  });

  it('số món vỡ không vượt số món trong thùng', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const n = brokenItems(15, 2, rng);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('bố cục có ổ gà trên đường chính trước cửa hàng', () => {
    const L = cityLayout(10, 12);
    const main = L.roads[1];
    const holes = L.damage.filter((d) => d.kind === 'pothole' && d.z > main.z0 && d.z < main.z1 && d.x > -10 && d.x < 30);
    expect(holes.length).toBeGreaterThan(5);
  });
});

describe('hàng rong cạnh tranh', () => {
  it('chỉ cạnh tranh đúng món, đúng giờ sạp mở', () => {
    expect(competingShift('bread', 8)).toBe('morning');
    expect(competingShift('bread', 20)).toBeNull();
    expect(competingShift('noodles', 20)).toBe('evening');
    expect(competingShift('noodles', 9)).toBeNull();
    expect(competingShift('coffee', 3)).toBe('allday');
    expect(competingShift('shampoo', 9)).toBeNull();
    for (const v of Object.values(VENDOR_GOODS)) expect(v.say.length).toBeGreaterThan(5);
  });

  it('bán rẻ hơn giá thị trường thì giữ được khách', () => {
    expect(vendorTakeChance(1, 1)).toBe(VENDOR_TAKE);
    expect(vendorTakeChance(0.85, 1)).toBe(VENDOR_TAKE_CHEAP);
    expect(VENDOR_TAKE_CHEAP).toBeLessThan(VENDOR_TAKE);
  });

  it('thống kê ngày có vendorLost; bản lưu cũ được bổ sung trường', () => {
    expect(createNewState(1).stats.vendorLost).toBe(0);
    const old = createNewState(1) as unknown as { stats: Record<string, number> };
    delete old.stats.vendorLost;
    expect(migrate(old as unknown as Record<string, unknown>).stats.vendorLost).toBe(0);
  });
});

describe('bàn thờ Thần Tài', () => {
  it('là nội thất mua được, đặt trên sàn', () => {
    const def = getFurniture('altar');
    expect(def.kind).toBe('altar');
    expect(def.buyable).toBe(true);
    expect(def.footprint).toEqual({ w: 2, h: 1 });
  });

  it('thắp nhang có hiệu lực trong ngày, khói cháy vài giờ', () => {
    expect(incenseLitToday(undefined, 1)).toBe(false);
    expect(incenseLitToday({ day: 2, hour: 8 }, 2)).toBe(true);
    expect(incenseLitToday({ day: 2, hour: 8 }, 3)).toBe(false);
    expect(incenseBurning({ day: 2, hour: 8 }, 2, 9)).toBe(true);
    expect(incenseBurning({ day: 2, hour: 8 }, 2, 15)).toBe(false);
  });
});
