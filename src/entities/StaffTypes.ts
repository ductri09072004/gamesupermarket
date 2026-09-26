import type { StaffData } from '../core/GameState';
import type { StaffWorld } from './Staff';
import type { Walker } from './Walker';

/** API của nhân viên NPC mà các "bộ não" theo vai trò dùng. */
export interface StaffBody extends Walker {
  readonly data: StaffData;
  readonly world: StaffWorld;
  /** Hệ số tốc độ đi (bảo vệ chạy khi đuổi trộm) */
  speedMul: number;
  setStatus(text: string): void;
  /** Đi ra chỗ nghỉ ngoài cửa hàng; true khi đã đứng ở đó */
  goRest(): boolean;
}

/** Logic theo vai trò: update mỗi khung hình, tick khi đã tới nơi (không còn đang đi). */
export interface StaffBrain {
  update?(dt: number): void;
  tick(sim: number): void;
  destroy(): void;
}
