import { BUS } from '../config/traffic';
import { busDue } from '../systems/TrafficSystem';
import { poseAt, type Route } from '../world/CityRoutes';
import { nearestD } from './TrafficKnock';

/** Chuyến buýt đang chờ xuất phát và điểm dừng trên tuyến. Xe xuất hiện từ xa rồi chạy tới trạm. */
export class BusService {
  private last = -1;
  private pending = false;
  route: Route | null = null;
  /** Quãng đường (trên route) tới điểm dừng */
  stopD = 0;

  /** Chọn tuyến chạy qua trạm gần nhất (spot = điểm xe buýt đỗ, tính theo làn xe). */
  reset(routes: Route[], spot: { x: number; z: number }): void {
    this.pending = false;
    this.last = -1;
    this.route = null;
    let best = Infinity;
    for (const r of routes) {
      const d = nearestD(r, spot.x, spot.z);
      const p = poseAt(r, d);
      const dist = Math.hypot(p.x - spot.x, p.z - spot.z);
      if (dist < best) {
        best = dist;
        this.route = r;
        this.stopD = d;
      }
    }
  }

  /** Gọi mỗi khung với giờ game; true khi có chuyến đang chờ xuất phát. */
  due(hour: number): boolean {
    if (this.last < 0) this.last = hour;
    if (busDue(this.last, hour) !== null) this.pending = true;
    this.last = hour;
    return this.pending && this.route !== null;
  }

  dispatched(): void {
    this.pending = false;
  }

  get startD(): number {
    return this.stopD - BUS.approachM;
  }
}
