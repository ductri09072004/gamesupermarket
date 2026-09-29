import { tetSeason } from '../systems/SeasonSystem';
import type { World } from './World';

/** Ánh sáng theo giờ: trời, mặt trời / trăng, đèn trong nhà, rồi mọi thứ phát sáng ban đêm (biển hiệu, đèn đường, đèn xe). */
export function applyTimeOfDay(w: World, hour: number): void {
  const wx = w.s.weather;
  w.lighting.setHour(hour, w.lights.interior, wx.cloud);
  const night = w.lighting.night;
  w.exterior.setNight(night);
  w.city.setNight(night, hour, wx.rain);
  w.life.clock(hour, w.s.bus, wx);
  w.vehicles.setHeadlights(night);
  w.decor.setTet(tetSeason(w.s.data.day));
  w.sign.setNight(night);
}
