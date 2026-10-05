import { describe, expect, it } from 'vitest';
import { VENDOR_GOODS, VENDOR_TAKE, VENDOR_TAKE_CHEAP } from '../src/config/city';
import { getFurniture } from '../src/config/furniture';
import { createNewState } from '../src/core/GameState';
import { migrate } from '../src/core/SaveSystem';
import { competingShift, incenseBurning, incenseLitToday, vendorTakeChance } from '../src/systems/VendorSystem';
import { cityLayout } from '../src/world/CityLayout';

describe('mặt đường', () => {
  it('bố cục không còn ổ gà trên đường', () => {
    const L = cityLayout(10, 12);
    expect(L.damage.map((d) => d.kind).includes('pothole' as never)).toBe(false);
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
