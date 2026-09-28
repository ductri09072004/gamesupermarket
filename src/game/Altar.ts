import * as THREE from 'three';
import { INCENSE } from '../config/constants';
import { incenseLitToday } from '../systems/VendorSystem';
import type { World } from './World';

/** Thắp nhang Thần Tài: mỗi ngày 1 lần → khách đông hơn cả ngày + uy tín tăng nhẹ. */
export function lightIncense(w: World, uid: string): void {
  const d = w.s.data;
  if (incenseLitToday(d.incense, d.day)) {
    w.toast('🙏 Hôm nay đã thắp nhang rồi — mai nhớ thắp tiếp nhé', 'info');
    return;
  }
  d.incense = { day: d.day, hour: w.s.time.hour };
  w.s.progression.changeReputation(INCENSE.rep);
  const v = w.furniture.get(uid);
  const at = v ? v.toWorld(new THREE.Vector3(0, 1.2, -0.4)) : new THREE.Vector3(w.player.x, 1.4, w.player.z);
  w.sound('bell', at);
  w.effects.floatText('🙏 Buôn may bán đắt!', at, '#c0392b');
  w.toast(`🧧 Đã thắp nhang Thần Tài — hôm nay khách đông hơn ${Math.round((INCENSE.spawnBonus - 1) * 100)}%`, 'success');
}

export function altarHint(w: World, click: string): string {
  const d = w.s.data;
  return incenseLitToday(d.incense, d.day) ? '🙏 Đã thắp nhang hôm nay' : `${click} Thắp nhang cầu may`;
}
