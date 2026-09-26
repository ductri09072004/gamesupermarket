import * as THREE from 'three';
import type { AABB } from '../world/Colliders';
import type { CityLayout } from '../world/CityLayout';
import { Pedestrians } from './Pedestrians';
import { Traffic } from './Traffic';

/** "Hơi thở" thành phố: xe NPC chạy trên đường + người dân đi bộ trên vỉa hè. */
export class CityLife {
  readonly group = new THREE.Group();
  readonly traffic = new Traffic();
  readonly pedestrians = new Pedestrians();

  constructor() {
    this.group.add(this.traffic.group, this.pedestrians.group);
  }

  /** Gọi mỗi khi dựng lại thành phố (vào game / mở rộng cửa hàng làm đường dịch). */
  reset(L: CityLayout): void {
    this.traffic.reset(L);
    this.pedestrians.reset(L);
  }

  /**
   * player: vị trí người chơi (đi bộ hoặc xe đang lái — driving=true thì né rộng hơn).
   * extra: vật cản khác trên đường (xe tải giao hàng đang đỗ...).
   */
  update(dt: number, player: { x: number; z: number }, driving: boolean, camera: THREE.Vector3, extra: Array<{ x: number; z: number; lat: number }> = []): void {
    this.traffic.update(dt, player, [{ x: player.x, z: player.z, lat: driving ? 2 : 1.4 }, ...extra]);
    this.pedestrians.update(dt, player, camera);
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
