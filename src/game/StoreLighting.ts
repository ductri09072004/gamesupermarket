import * as THREE from 'three';
import { CEILING_HEIGHT, LAMP_POOL } from '../config/constants';
import { getFurniture, isCeiling } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { setLampsGlow } from '../entities/LampModels';
import { LightSwitch } from '../entities/LightSwitch';
import { interiorLight, lampCoverage } from '../systems/LightingSystem';
import { furnitureCenter } from '../world/Placement';
import type { GameCtx } from './Ctx';

/**
 * Đèn trong cửa hàng: công tắc + đèn trần mua/dời được.
 * - Độ sáng chung (interior) tính theo tổng diện tích các đèn phủ → chỉnh đèn trần đổ bóng, bán cầu, môi trường.
 * - Nhóm cố định LAMP_POOL PointLight (không bóng) gán cho các bóng gần camera nhất → vũng sáng cục bộ,
 *   số đèn trong shader không đổi nên thêm/bớt đèn không phải biên dịch lại shader.
 */
export class StoreLighting {
  readonly lightSwitch = new LightSwitch();
  interior = 0;
  private pool: THREE.PointLight[] = [];
  private assignT = 0;

  constructor(private c: GameCtx) {
    for (let i = 0; i < LAMP_POOL; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 7, 1.5);
      p.castShadow = false;
      c.scene.add(p);
      this.pool.push(p);
    }
    this.layout();
  }

  layout(): void {
    this.lightSwitch.place(this.c.s.data.storeH);
  }

  /** E ở công tắc. */
  toggle(): boolean {
    const d = this.c.s.data;
    d.lightsOn = !d.lightsOn;
    this.c.sound('click', this.lightSwitch.group.position.clone());
    this.assignT = 0;
    return d.lightsOn;
  }

  update(dt: number): void {
    const d = this.c.s.data;
    this.interior = interiorLight(d.lightsOn, lampCoverage(d.furniture, d.storeW, d.storeH));
    setLampsGlow(d.lightsOn);
    this.c.store.setLightsOn(d.lightsOn);
    this.lightSwitch.set(d.lightsOn);
    this.assignT -= dt;
    if (this.assignT > 0) return;
    this.assignT = 0.25;
    this.assign(d.furniture.filter((f) => isCeiling(getFurniture(f.type))), d.lightsOn);
  }

  private assign(lamps: FurnitureData[], on: boolean): void {
    const cam = this.c.camera.position;
    const pts = lamps.map((f) => ({ f, p: furnitureCenter(f) }));
    pts.sort((a, b) => Math.hypot(a.p.x - cam.x, a.p.z - cam.z) - Math.hypot(b.p.x - cam.x, b.p.z - cam.z));
    this.pool.forEach((light, i) => {
      const lamp = pts[i];
      if (!lamp || !on) {
        light.intensity = 0;
        return;
      }
      const def = getFurniture(lamp.f.type);
      const pendant = def.id === 'lamp_pendant';
      light.position.set(lamp.p.x, CEILING_HEIGHT - (pendant ? 0.75 : 0.35), lamp.p.z);
      light.color.setHex(def.light?.color ?? 0xffffff);
      light.intensity = pendant ? 2.2 : 3;
    });
  }

  dispose(): void {
    for (const p of this.pool) p.removeFromParent();
    this.lightSwitch.group.removeFromParent();
  }
}
