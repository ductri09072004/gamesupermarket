import { DIRT } from '../config/hygiene';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { DirtData, DirtKind, GameState } from '../core/GameState';
import type { Rng } from '../core/Random';
import type { ProgressionSystem } from './ProgressionSystem';

/** Số vết bẩn mới mỗi giờ game theo lượng khách đang ở trong cửa hàng và diện tích. */
export function dirtRatePerHour(customers: number, areaM2: number): number {
  return DIRT.basePerHour + DIRT.perCustomerPerHour * Math.max(0, customers) + DIRT.perAreaPerHour * Math.max(0, areaM2);
}

export function pickDirtKind(rng: Rng): DirtKind {
  const w = DIRT.weights;
  const r = rng() * (w.litter + w.spill + w.smudge);
  return r < w.litter ? 'litter' : r < w.litter + w.spill ? 'spill' : 'smudge';
}

/** Chỗ đặt chất bẩn: trả null nếu không tìm được chỗ hợp lệ. */
export type DirtSpot = (kind: DirtKind) => { x: number; z: number } | null;

/** Chất bẩn xuất hiện dần khi có khách; để bẩn lâu thì mất uy tín. Lao công / người chơi dọn. */
export class CleanlinessSystem {
  private acc = 0;
  private repAcc = 0;

  constructor(private state: GameState, private bus: EventBus<GameEvents>, private rng: Rng, private progression: Pick<ProgressionSystem, 'changeReputation'>) {}

  get list(): DirtData[] {
    return this.state.data.dirt;
  }

  /** minutes: phút game vừa trôi qua. */
  update(minutes: number, customersInside: number, spot: DirtSpot): void {
    if (minutes <= 0) return;
    const d = this.state.data;
    this.acc += (minutes / 60) * dirtRatePerHour(customersInside, d.storeW * d.storeH);
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.list.length >= DIRT.max) continue;
      const kind = pickDirtKind(this.rng);
      const p = spot(kind);
      if (p) this.add(kind, p.x, p.z);
    }
    // uy tín giảm theo số vết bẩn, tính dồn mỗi giờ game
    this.repAcc += minutes;
    if (this.repAcc >= 60) {
      this.repAcc -= 60;
      if (this.list.length > 0) this.progression.changeReputation(DIRT.repPerDirtHour * this.list.length);
    }
  }

  add(kind: DirtKind, x: number, z: number): DirtData {
    const dirt: DirtData = { uid: this.state.newUid('d'), kind, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, seed: Math.floor(this.rng() * 1000) };
    this.list.push(dirt);
    this.bus.emit('dirt:changed', {});
    return dirt;
  }

  clean(uid: string): boolean {
    const i = this.list.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    this.list.splice(i, 1);
    this.bus.emit('dirt:changed', {});
    return true;
  }
}
