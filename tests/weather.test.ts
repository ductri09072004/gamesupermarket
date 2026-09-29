import { describe, expect, it } from 'vitest';
import { FLOOD, WEATHER } from '../src/config/weather';
import { mulberry32 } from '../src/core/Random';
import { dirtRatePerHour, pickDirtKind } from '../src/systems/CleanlinessSystem';
import {
  cloudAt, dayWeather, floodAt, gripFactor, rainAt, rainSpawnFactor, vendorsPackUp, wadeState, weatherIcon, weatherNow, wetAt,
  type DayWeather,
} from '../src/systems/WeatherSystem';

const storm: DayWeather = { start: 13, end: 16.5, peak: 1 };
const drizzle: DayWeather = { start: 13, end: 15, peak: 0.55 };

describe('dự báo thời tiết theo ngày', () => {
  it('cùng hạt giống & ngày luôn ra cùng một kết quả; ngày đầu không mưa', () => {
    expect(dayWeather(7, 5)).toEqual(dayWeather(7, 5));
    for (const seed of [1, 2, 3, 99]) expect(dayWeather(seed, 1)).toBeNull();
  });

  it('khoảng 40% ngày có mưa, giờ mưa nằm trong khung cho phép', () => {
    let rainy = 0;
    for (let d = 2; d < 402; d++) {
      const w = dayWeather(12345, d);
      if (!w) continue;
      rainy++;
      expect(w.start).toBeGreaterThanOrEqual(WEATHER.startWindow[0]);
      expect(w.start).toBeLessThanOrEqual(WEATHER.startWindow[1]);
      expect(w.end - w.start).toBeGreaterThanOrEqual(WEATHER.durationH[0]);
      expect(w.end - w.start).toBeLessThanOrEqual(WEATHER.durationH[1]);
      expect(w.peak).toBeGreaterThanOrEqual(WEATHER.peak[0]);
      expect(w.peak).toBeLessThanOrEqual(WEATHER.peak[1]);
    }
    expect(rainy / 400).toBeGreaterThan(0.3);
    expect(rainy / 400).toBeLessThan(0.5);
  });
});

describe('cường độ mưa & mây', () => {
  it('0 ngoài trận mưa, tăng dần rồi giảm chậm, đỉnh ≤ peak', () => {
    expect(rainAt(storm, 12)).toBe(0);
    expect(rainAt(storm, 17)).toBe(0);
    expect(rainAt(storm, 13.1)).toBeGreaterThan(0);
    expect(rainAt(storm, 13.1)).toBeLessThan(rainAt(storm, 14));
    expect(rainAt(storm, 15)).toBe(storm.peak);
    expect(rainAt(storm, 16.4)).toBeLessThan(0.3);
    expect(rainAt(null, 14)).toBe(0);
  });

  it('mây kéo tới trước khi mưa, tan sau khi tạnh', () => {
    expect(cloudAt(storm, 9)).toBe(0);
    expect(cloudAt(storm, 12.6)).toBeGreaterThan(0.1);
    expect(cloudAt(storm, 12.9)).toBeGreaterThan(cloudAt(storm, 12.4));
    expect(cloudAt(storm, 15)).toBeGreaterThan(0.9);
    expect(cloudAt(storm, 20)).toBe(0);
  });
});

describe('ngập đường', () => {
  it('mưa nhỏ không ngập; mưa rất to ngập dần rồi rút', () => {
    expect(floodAt(drizzle, 14)).toBe(0);
    expect(floodAt(null, 14)).toBe(0);
    const at = (h: number) => floodAt(storm, h);
    expect(at(13)).toBe(0);
    expect(at(15)).toBeGreaterThan(0.05);
    expect(at(16)).toBeGreaterThan(at(14.5));
    expect(at(16)).toBeLessThanOrEqual(FLOOD.max);
    expect(at(19)).toBeLessThan(at(16.5));
    expect(at(23.9)).toBe(0);
  });

  it('mặt đường ướt khi mưa, còn ướt một lúc sau khi tạnh rồi khô; ngập thì ướt hoàn toàn', () => {
    expect(wetAt(storm, 12, 0)).toBe(0);
    expect(wetAt(storm, 14, 0.1)).toBe(1);
    expect(wetAt(drizzle, 15.5, 0)).toBeGreaterThan(0);
    expect(wetAt(drizzle, 15.5, 0)).toBeLessThan(1);
    expect(wetAt(drizzle, 17.5, 0)).toBe(0);
  });

  it('weatherNow khớp các hàm thành phần', () => {
    let day = 2;
    while (!dayWeather(4, day)) day++;
    const w = dayWeather(4, day)!;
    const h = (w.start + w.end) / 2;
    const n = weatherNow(4, day, h);
    expect(n.rain).toBeCloseTo(rainAt(w, h), 6);
    expect(n.flood).toBeCloseTo(floodAt(w, h), 6);
    expect(weatherNow(4, day, 3).rain).toBe(0);
  });
});

describe('ảnh hưởng tới người chơi', () => {
  it('mưa làm khách thưa đi, đường ngập thưa thêm nhưng không về 0', () => {
    expect(rainSpawnFactor(0, 0)).toBe(1);
    expect(rainSpawnFactor(1, 0)).toBeLessThan(rainSpawnFactor(0.4, 0));
    expect(rainSpawnFactor(1, FLOOD.max)).toBeLessThan(rainSpawnFactor(1, 0));
    expect(rainSpawnFactor(1, FLOOD.max)).toBeGreaterThan(0.3);
  });

  it('hàng rong dọn về khi mưa, đường ướt bám kém', () => {
    expect(vendorsPackUp(0.1)).toBe(false);
    expect(vendorsPackUp(0.5)).toBe(true);
    expect(gripFactor(0)).toBe(1);
    expect(gripFactor(1)).toBeCloseTo(1 - WEATHER.grip, 6);
  });

  it('xe máy chết máy ở mực nước mà ô tô vẫn chạy được', () => {
    expect(wadeState(0, 'moto')).toBe('ok');
    expect(wadeState(0.08, 'moto')).toBe('slow');
    expect(wadeState(0.2, 'moto')).toBe('stall');
    expect(wadeState(0.2, 'car')).toBe('slow');
    expect(wadeState(0.2, 'pickup')).toBe('slow');
    expect(wadeState(0.3, 'pickup')).toBe('stall');
  });

  it('mưa làm sàn cửa hàng bẩn nhanh hơn, thiên về vết đổ (nước, bùn)', () => {
    expect(dirtRatePerHour(5, 120, 1)).toBeGreaterThan(dirtRatePerHour(5, 120, 0));
    expect(dirtRatePerHour(5, 120)).toBe(dirtRatePerHour(5, 120, 0));
    const share = (wet: number) => {
      const rng = mulberry32(5);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (pickDirtKind(rng, wet) === 'spill') n++;
      return n / 4000;
    };
    expect(share(1)).toBeGreaterThan(share(0) + 0.2);
  });

  it('biểu tượng HUD theo trạng thái', () => {
    expect(weatherIcon({ rain: 0, flood: 0, wet: 0, cloud: 0 })).toBe('☀️');
    expect(weatherIcon({ rain: 0, flood: 0, wet: 0, cloud: 0.5 })).toBe('⛅');
    expect(weatherIcon({ rain: 0.4, flood: 0, wet: 0.8, cloud: 0.4 })).toBe('🌧️');
    expect(weatherIcon({ rain: 0.9, flood: 0, wet: 1, cloud: 0.9 })).toBe('⛈️');
    expect(weatherIcon({ rain: 0.5, flood: 0.1, wet: 1, cloud: 0.5 })).toBe('🌊');
  });
});
