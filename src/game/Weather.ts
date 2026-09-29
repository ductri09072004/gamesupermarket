import * as THREE from 'three';
import { WAREHOUSE, WALL_THICKNESS } from '../config/constants';
import { WEATHER } from '../config/weather';
import { dayWeather, weatherIcon, weatherNow } from '../systems/WeatherSystem';
import { RainFx } from '../world/RainFx';
import type { World } from './World';

/**
 * Mưa & ngập: hạt mưa quanh camera, mặt đường ướt / nước dâng, trời u ám, tiếng mưa (nhỏ & đục khi ở trong nhà),
 * sấm chớp khi mưa to, thông báo dự báo / bắt đầu mưa / ngập. Số liệu thời tiết tính thuần (WeatherSystem) rồi
 * đặt vào Services.weather cho hệ thống khác đọc (khách, hàng rong, lái xe, vết bẩn).
 */
export class Weather {
  readonly group = new THREE.Group();
  private fx = new RainFx();
  private t = 0;
  private day = -1;
  private icon = '';
  private rainy = false;
  private flooded = false;
  private thunderGap = 12;
  private thunderIn = -1;
  private flash = 0;
  private heardRain = -1;
  private heardIndoor = false;

  constructor(private w: World) {
    this.group.add(this.fx.lines);
  }

  private insideStore(x: number, z: number): boolean {
    const d = this.w.s.data;
    return x > -0.1 && x < d.storeW + 0.1 && z > WAREHOUSE.z0 - 0.3 && z < d.storeH + WALL_THICKNESS;
  }

  update(dt: number): void {
    const w = this.w;
    const s = w.s;
    const d = s.data;
    const hour = s.time.hour;
    const n = weatherNow(d.seed, d.day, hour);
    s.weather = n;
    this.t += dt;
    this.announce(hour);
    const cam = w.camera.position;
    this.fx.roof = { x0: -0.1, x1: d.storeW + 0.1, z0: WAREHOUSE.z0 - 0.3, z1: d.storeH + WALL_THICKNESS };
    this.fx.update(dt, cam, n.rain);
    w.city.setWet(n.wet, n.flood, this.t);
    this.hear(n.rain, this.insideStore(cam.x, cam.z));
    this.thunder(dt, n.rain);
    w.lighting.flash = this.flash;
    const icon = weatherIcon(n);
    if (icon !== this.icon) {
      this.icon = icon;
      s.bus.emit('weather:changed', { icon, rain: n.rain, flood: n.flood });
    }
    // báo hiệu khi mưa bắt đầu / tạnh / ngập (có độ trễ để khỏi nháy)
    if (!this.rainy && n.rain >= WEATHER.rainy) {
      this.rainy = true;
      w.toast('🌧️ Trời đổ mưa! Hàng rong dọn về hết, khách sẽ thưa hơn — sàn cửa hàng dễ bẩn', 'info');
    } else if (this.rainy && n.rain < 0.05) {
      this.rainy = false;
      w.toast('🌤️ Mưa đã tạnh', 'info');
    }
    if (!this.flooded && n.flood >= 0.06) {
      this.flooded = true;
      w.toast('🌊 Đường ngập rồi! Đi xe máy lội nước dễ chết máy — ô tô, bán tải chịu được sâu hơn', 'error');
    } else if (this.flooded && n.flood < 0.02) {
      this.flooded = false;
      w.toast('✅ Nước đã rút', 'success');
    }
  }

  /** Chỉ đẩy lên bộ âm thanh khi mức mưa hoặc trong/ngoài nhà đổi (tránh dồn hàng nghìn lệnh AudioParam). */
  private hear(rain: number, indoor: boolean): void {
    if (indoor === this.heardIndoor && Math.abs(rain - this.heardRain) < 0.01) return;
    this.heardIndoor = indoor;
    this.heardRain = rain;
    this.w.audio.setRain(rain, indoor);
  }

  /** Sáng ngày mới: báo dự báo (chỉ khi trận mưa còn ở phía trước). */
  private announce(hour: number): void {
    const d = this.w.s.data;
    if (d.day === this.day) return;
    this.day = d.day;
    const dw = dayWeather(d.seed, d.day);
    if (!dw || hour > dw.start - 0.5) return;
    const big = dw.peak > 0.7 ? ' rất to, có thể ngập đường' : '';
    this.w.toast(`🌦️ Dự báo: khoảng ${Math.round(dw.start)}h có mưa${big}`, 'info');
  }

  /** Mưa to: chớp sáng rồi vài giây sau mới nghe sấm (ánh sáng đi nhanh hơn âm thanh). */
  private thunder(dt: number, rain: number): void {
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (this.thunderIn >= 0) {
      this.thunderIn -= dt;
      if (this.thunderIn < 0) this.w.sound('thunder', undefined, 0.85 + Math.random() * 0.3, 0.6 + rain * 0.4);
    }
    if (rain < WEATHER.thunderFrom) return;
    this.thunderGap -= dt;
    if (this.thunderGap > 0) return;
    const [a, b] = WEATHER.thunderGapS;
    this.thunderGap = a + Math.random() * (b - a);
    this.flash = 1;
    this.thunderIn = 0.4 + Math.random() * 1.6;
  }

  destroy(): void {
    this.fx.dispose();
    this.group.removeFromParent();
    this.hear(0, false);
  }
}
