import { STAFF_HELP_S } from '../config/constants';
import type { FurnitureData } from '../core/GameState';
import type { GridPoint } from '../world/Footprint';
import { furnitureCenter } from '../world/Placement';
import type { StaffBody, StaffBrain } from './StaffTypes';

/** Việc hỗ trợ ở máy tự tính tiền (SelfCheckoutManager cài đặt). */
export interface KioskHelpApi {
  /** Máy đang có khách bí và chưa ai nhận giúp */
  requests(): FurnitureData[];
  claim(uid: string, by: string): boolean;
  release(uid: string, by: string): void;
  needsHelp(uid: string): boolean;
  /** Giúp xong: khách quét tiếp (nhanh hơn) */
  assist(uid: string): boolean;
  /** Ô đứng cạnh máy để giúp khách */
  helpSpots(uid: string): GridPoint[];
}

/** Nhân viên chăm sóc khách hàng: máy nào báo đèn đỏ thì chạy tới giúp; rảnh thì ra ngoài cửa hàng đứng. */
export class HelperBrain implements StaffBrain {
  private job: string | null = null;
  private jobAt: { x: number; z: number } | null = null;
  private phase: 'idle' | 'go' | 'help' = 'idle';
  private timer = 0;

  constructor(private npc: StaffBody, private kiosks: KioskHelpApi) {}

  tick(sim: number): void {
    const k = this.kiosks;
    // người chơi đã giúp trước → bỏ việc
    if (this.job && !k.needsHelp(this.job)) this.drop();
    switch (this.phase) {
      case 'idle': {
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = 0.5;
        const reqs = k.requests();
        if (!reqs.length) {
          if (this.npc.goRest()) this.npc.setStatus('☕ Chờ ngoài cửa hàng');
          return;
        }
        const d = (f: FurnitureData) => {
          const c = furnitureCenter(f);
          return Math.hypot(c.x - this.npc.x, c.z - this.npc.z);
        };
        for (const f of [...reqs].sort((a, b) => d(a) - d(b))) {
          if (!k.claim(f.uid, this.npc.data.uid)) continue;
          if (this.npc.walkTo(k.helpSpots(f.uid))) {
            this.job = f.uid;
            this.jobAt = furnitureCenter(f);
            this.phase = 'go';
            this.npc.setStatus('🏃 Tới hỗ trợ khách');
            return;
          }
          k.release(f.uid, this.npc.data.uid);
        }
        return;
      }
      case 'go': {
        // tick chỉ chạy khi đã tới nơi
        if (!this.jobAt) { this.drop(); return; }
        this.npc.face(this.jobAt.x, this.jobAt.z);
        this.npc.human.reach();
        this.phase = 'help';
        this.timer = STAFF_HELP_S / this.npc.data.speed;
        this.npc.setStatus('🤝 Đang hướng dẫn khách');
        return;
      }
      case 'help':
        this.timer -= sim;
        if (this.timer > 0) return;
        if (this.job) k.assist(this.job);
        this.drop();
        this.timer = 1;
    }
  }

  private drop(): void {
    if (this.job) this.kiosks.release(this.job, this.npc.data.uid);
    this.job = null;
    this.jobAt = null;
    this.phase = 'idle';
  }

  destroy(): void {
    this.drop();
  }
}
