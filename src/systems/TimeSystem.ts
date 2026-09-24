import { CLOSE_MINUTE, HARD_STOP_MINUTE, MINUTES_PER_SECOND, OPEN_MINUTE, TIME_SPEEDS } from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../core/GameState';

export function formatClock(minutes: number): string {
  const m = Math.floor(minutes);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export class TimeSystem {
  private pauseReasons = new Set<string>();
  private speedLocked = false;

  constructor(private state: GameState, private bus: EventBus<GameEvents>) {}

  get minutes(): number { return this.state.data.minutes; }
  get day(): number { return this.state.data.day; }
  get hour(): number { return this.state.data.minutes / 60; }
  get paused(): boolean { return this.pauseReasons.size > 0; }
  get speed(): number { return this.speedLocked ? 1 : this.state.data.speed; }

  isOpenHours(): boolean {
    return this.minutes >= OPEN_MINUTE && this.minutes < CLOSE_MINUTE;
  }

  isAfterClose(): boolean {
    return this.minutes >= CLOSE_MINUTE;
  }

  pause(reason: string): void {
    const was = this.paused;
    this.pauseReasons.add(reason);
    if (!was) this.bus.emit('time:paused', { paused: true });
  }

  resume(reason: string): void {
    const was = this.paused;
    this.pauseReasons.delete(reason);
    if (was && !this.paused) this.bus.emit('time:paused', { paused: false });
  }

  isPausedBy(reason: string): boolean {
    return this.pauseReasons.has(reason);
  }

  setSpeed(speed: number): void {
    if (!(TIME_SPEEDS as readonly number[]).includes(speed)) return;
    this.state.data.speed = speed;
    this.bus.emit('time:speed', { speed: this.speed });
  }

  lockSpeed(locked: boolean): void {
    this.speedLocked = locked;
    this.bus.emit('time:speed', { speed: this.speed });
  }

  get isSpeedLocked(): boolean {
    return this.speedLocked;
  }

  /** Tiến thời gian; trả về số giây mô phỏng (đã nhân tốc độ), 0 nếu đang pause. */
  update(dtMs: number): number {
    if (this.paused) return 0;
    const simSeconds = (dtMs / 1000) * this.speed;
    const d = this.state.data;
    const before = d.minutes;
    d.minutes = Math.min(HARD_STOP_MINUTE, d.minutes + simSeconds * MINUTES_PER_SECOND);
    if (Math.floor(before) !== Math.floor(d.minutes)) {
      this.bus.emit('time:changed', { day: d.day, minutes: d.minutes });
    }
    if (before < CLOSE_MINUTE && d.minutes >= CLOSE_MINUTE) {
      this.bus.emit('day:closing', { day: d.day });
    }
    return simSeconds;
  }

  startNewDay(): void {
    const d = this.state.data;
    d.day += 1;
    d.minutes = OPEN_MINUTE;
    this.bus.emit('day:started', { day: d.day });
    this.bus.emit('time:changed', { day: d.day, minutes: d.minutes });
  }
}
