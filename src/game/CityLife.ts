import * as THREE from 'three';
import type { AABB } from '../world/Colliders';
import type { CityLayout } from '../world/CityLayout';
import { Pedestrians } from './Pedestrians';
import { Traffic } from './Traffic';
import { StreetSounds } from './StreetSounds';
import type { EventBus, GameEvents } from '../core/EventBus';
import { WEATHER } from '../config/weather';
import { vendorsPackUp, type WeatherNow } from '../systems/WeatherSystem';

/** "Hơi thở" thành phố: xe NPC chạy trên đường + người dân đi bộ trên vỉa hè. */
export class CityLife {
  readonly group = new THREE.Group();
  readonly traffic = new Traffic();
  readonly pedestrians = new Pedestrians();
  private sounds = new StreetSounds();
  private layout: CityLayout | null = null;
  private hour = 12;
  private rain = 0;
  private ear = { x: 0, z: 0 };
  private bus: EventBus<GameEvents> | null = null;
  signalTime = 0;

  /** Buýt thả khách (cửa xe x, z, số người) — World nối với CustomerManager */
  onPassengers: (x: number, z: number, n: number) => void = () => {};

  constructor() {
    this.pedestrians.canCross = (c) => this.traffic.crosswalkClear(c);
    this.group.add(this.traffic.group, this.pedestrians.group);
    this.traffic.onSound = (name, x, z) => this.bus?.emit('sound', { name, pos: { x, y: 1.5, z }, volume: 0.9 });
    this.traffic.onPassengers = (x, z, n) => this.onPassengers(x, z, n);
    this.traffic.onHitPlayer = (vx, vz, speed) => this.bus?.emit('player:hit', { vx, vz, speed });
    // gánh hàng rong cất tiếng rao (chỉ khi người nghe ở gần)
    this.pedestrians.onCall = (x, z) => {
      if (Math.hypot(x - this.ear.x, z - this.ear.z) > 40) return;
      this.bus?.emit('sound', { name: 'vendorCall', pos: { x, y: 1.6, z }, pitch: 1.2 + Math.random() * 0.2, volume: 0.75 });
    };
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
  clock(hour: number, bus: EventBus<GameEvents>, wx: WeatherNow): void {
    this.hour = hour;
    this.bus = bus;
    this.rain = wx.rain;
    this.traffic.hour = hour;
    this.traffic.rain = wx.rain;
    this.pedestrians.hour = hour;
    this.pedestrians.rain = wx.rain;
    // mưa & nước ngập: xe chạy chậm lại
    this.traffic.speedScale = 1 - WEATHER.trafficSlow * wx.rain - 0.25 * Math.min(1, wx.flood / 0.15);
  }

  update(dt: number, player: { x: number; z: number }, driving: boolean, camera: THREE.Vector3, extra: Array<{ x: number; z: number; lat: number }> = []): void {
    this.traffic.signalTime = this.signalTime;
    this.signalTime += dt;
    this.pedestrians.signalTime = this.signalTime;
    this.traffic.occupiedCrosswalks = this.pedestrians.occupiedCrosswalks();
    this.traffic.update(dt, player, [{ x: player.x, z: player.z, lat: driving ? 2 : 1.4 }, ...extra], !driving);
    this.ear = camera;
    this.pedestrians.update(dt, player, camera);
    const bus = this.bus;
    if (bus && this.layout && dt > 0) this.sounds.update(dt, this.hour, camera, this.traffic.positions(), vendorsPackUp(this.rain) ? [] : this.layout.stalls, (e) => bus.emit('sound', e));
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
