import { FLOOD, WEATHER } from '../config/weather';
import { mulberry32 } from '../core/Random';

/** Trận mưa trong ngày (giờ game). null = ngày nắng. */
export interface DayWeather {
  start: number;
  end: number;
  /** Cường độ đỉnh 0..1 */
  peak: number;
}

export interface WeatherNow {
  /** 0..1 */
  rain: number;
  /** Mực nước trên đường (m) */
  flood: number;
  /** Độ ướt mặt đường 0..1 (còn ướt một lúc sau khi tạnh) */
  wet: number;
  /** Độ u ám của bầu trời 0..1 (mây kéo tới trước, tan sau mưa) */
  cloud: number;
}

export const CLEAR: WeatherNow = { rain: 0, flood: 0, wet: 0, cloud: 0 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Thời tiết của 1 ngày — cùng hạt giống & ngày luôn ra cùng kết quả (không cần lưu vào save). */
export function dayWeather(seed: number, day: number): DayWeather | null {
  if (day < WEATHER.firstRainDay) return null;
  const rng = mulberry32((Math.imul(seed | 0, 2654435761) ^ Math.imul(day, 40503) ^ WEATHER.seedSalt) >>> 0);
  if (rng() >= WEATHER.rainDayChance) return null;
  const start = lerp(WEATHER.startWindow, rng());
  return { start, end: start + lerp(WEATHER.durationH, rng()), peak: lerp(WEATHER.peak, rng()) };
}

/** Cường độ mưa: tăng dần lúc bắt đầu, giữ ở đỉnh, giảm chậm khi tạnh. */
export function rainAt(w: DayWeather | null, hour: number): number {
  if (!w || hour <= w.start || hour >= w.end) return 0;
  const up = (hour - w.start) / WEATHER.rampUpH;
  const down = (w.end - hour) / WEATHER.rampDownH;
  return w.peak * smooth(clamp01(Math.min(up, down)));
}

/** Mây u ám: kéo tới trước cơn mưa, tan dần sau đó. */
export function cloudAt(w: DayWeather | null, hour: number): number {
  if (!w) return 0;
  const rain = rainAt(w, hour) * 0.95;
  if (hour < w.start) return Math.max(rain, clamp01((hour - (w.start - WEATHER.cloudBeforeH)) / WEATHER.cloudBeforeH) * 0.55);
  if (hour > w.end) return clamp01(1 - (hour - w.end) / WEATHER.cloudAfterH) * 0.5;
  return Math.max(rain, 0.5);
}

/** Mực nước: dâng khi mưa to hơn ngưỡng, rút đều đặn; tích phân từng bước 5 phút từ lúc bắt đầu mưa. */
export function floodAt(w: DayWeather | null, hour: number): number {
  if (!w || hour <= w.start || w.peak <= FLOOD.from) return 0;
  const step = 1 / 12;
  let level = 0;
  for (let t = w.start; t < hour; t += step) {
    const r = rainAt(w, t);
    const fill = r > FLOOD.from ? (FLOOD.fillPerHour * (r - FLOOD.from)) / (1 - FLOOD.from) : 0;
    level = Math.max(0, Math.min(FLOOD.max, level + (fill - (level > 0 ? FLOOD.drainPerHour : 0)) * step));
  }
  return level;
}

export function wetAt(w: DayWeather | null, hour: number, flood: number): number {
  if (!w || hour <= w.start) return 0;
  if (flood > 0.005) return 1;
  const r = rainAt(w, hour);
  if (r > 0) return clamp01(r / 0.5);
  return clamp01(1 - (hour - w.end) / WEATHER.dryH);
}

let cachedKey = '';
let cachedDay: DayWeather | null = null;

/** Thời tiết tại 1 thời điểm (dùng lại thời tiết ngày nếu cùng hạt giống & ngày). */
export function weatherNow(seed: number, day: number, hour: number): WeatherNow {
  const key = `${seed}:${day}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedDay = dayWeather(seed, day);
  }
  const w = cachedDay;
  if (!w) return { ...CLEAR };
  const flood = floodAt(w, hour);
  return { rain: rainAt(w, hour), flood, wet: wetAt(w, hour, flood), cloud: cloudAt(w, hour) };
}

/** Khách giảm khi trời mưa, giảm thêm khi đường ngập. */
export function rainSpawnFactor(rain: number, flood: number): number {
  return 1 - WEATHER.spawnDrop * clamp01(rain) - WEATHER.floodSpawnDrop * clamp01(flood / FLOOD.max);
}

/** Hàng rong dọn về khi mưa. */
export function vendorsPackUp(rain: number): boolean {
  return rain >= WEATHER.rainy;
}

/** Hệ số bám đường (1 = khô). */
export function gripFactor(wet: number): number {
  return 1 - WEATHER.grip * clamp01(wet);
}

export type Wade = 'ok' | 'slow' | 'stall';

/** Xe lội nước: nước nông chạy bình thường, sâu thì lết, sâu hơn nữa thì chết máy (xe máy dễ nhất). */
export function wadeState(level: number, vehicle: string): Wade {
  const t = FLOOD.wade[vehicle] ?? FLOOD.wade.car;
  return level >= t.stall ? 'stall' : level >= t.slow ? 'slow' : 'ok';
}

/** Biểu tượng thời tiết cho HUD. */
export function weatherIcon(n: WeatherNow): string {
  if (n.flood > 0.03) return '🌊';
  if (n.rain >= WEATHER.thunderFrom) return '⛈️';
  if (n.rain > 0.05) return '🌧️';
  return n.cloud > 0.3 ? '⛅' : '☀️';
}
