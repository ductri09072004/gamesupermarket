import type { World } from './World';

/** Ánh sáng theo giờ: trời, mặt trời / trăng, đèn trong nhà, rồi mọi thứ phát sáng ban đêm (biển hiệu, đèn đường, đèn xe). */
export function applyTimeOfDay(w: World, hour: number): void {
  w.lighting.setHour(hour, w.lights.interior);
  const night = w.lighting.night;
  w.exterior.setNight(night);
  w.city.setNight(night);
  w.vehicles.setHeadlights(night);
  w.sign.setNight(night);
}
