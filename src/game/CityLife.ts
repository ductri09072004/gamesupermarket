import * as THREE from 'three';
import type { AABB } from '../world/Colliders';
import type { CityLayout } from '../world/CityLayout';
import { Pedestrians } from './Pedestrians';
import { Traffic } from './Traffic';
import { StreetSounds } from './StreetSounds';
import type { EventBus, GameEvents } from '../core/EventBus';

/** "Hơi thở" thành phố: xe NPC chạy trên đường + người dân đi bộ trên vỉa hè. */
export class CityLife {
  readonly group = new THREE.Group();
  readonly traffic = new Traffic();
  readonly pedestrians = new Pedestrians();
  private sounds = new StreetSounds();
  private layout: CityLayout | null = null;
  private hour = 12;
  private bus: EventBus<GameEvents> | null = null;

  constructor() {
    this.group.add(this.traffic.group, this.pedestrians.group);
  }

  /** Gọi mỗi khi dựng lại thành phố (vào game / mở rộng cửa hàng làm đường dịch). */
  reset(L: CityLayout): void {
    this.layout = L;
    this.traffic.reset(L);
    this.pedestrians.reset(L);
  }

  /**
   * player: vị trí người chơi (đi bộ hoặc xe đang lái — driving=true thì né rộng hơn).
   * extra: vật cản khác trên đường (xe tải giao hàng đang đỗ...).
   */
  /** Giờ game + bus âm thanh (TimeOfDay gọi mỗi khung): sạp theo giờ, còi xe, tiếng rao. */
  clock(hour: number, bus: EventBus<GameEvents>): void {
    this.hour = hour;
    this.bus = bus;
    this.pedestrians.hour = hour;
  }

  update(dt: number, player: { x: number; z: number }, driving: boolean, camera: THREE.Vector3, extra: Array<{ x: number; z: number; lat: number }> = []): void {
    this.traffic.update(dt, player, [{ x: player.x, z: player.z, lat: driving ? 2 : 1.4 }, ...extra]);
    this.pedestrians.update(dt, player, camera);
    const bus = this.bus;
    if (bus && this.layout && dt > 0) this.sounds.update(dt, this.hour, camera, this.traffic.positions(), this.layout.stalls, (e) => bus.emit('sound', e));
  }

  colliders(): AABB[] {
    return this.traffic.colliders();
  }

  destroy(): void {
    this.traffic.destroy();
    this.pedestrians.destroy();
    this.group.removeFromParent();
  }
}
