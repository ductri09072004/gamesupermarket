import { STAFF_UNLOCK_LEVEL } from '../config/constants';
import { FIRST_NAMES, LAST_NAMES, MAX_STAFF, STAFF_ROLES } from '../config/staff';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState, StaffData, StaffRole } from '../core/GameState';
import { pick, randInt, type Rng } from '../core/Random';

export interface Candidate {
  name: string;
  role: StaffRole;
  wage: number;
  speed: number;
  shirt: number;
}

export function generateCandidate(role: StaffRole, rng: Rng): Candidate {
  const [lo, hi] = STAFF_ROLES[role].wage;
  const speed = Math.round((0.8 + rng() * 0.5) * 100) / 100;
  const wage = Math.round(lo + (hi - lo) * ((speed - 0.8) / 0.5) * 0.7 + rng() * (hi - lo) * 0.3);
  return { name: `${pick(rng, LAST_NAMES)} ${pick(rng, FIRST_NAMES)}`, role, wage, speed, shirt: randInt(rng, 0, 7) };
}

export function totalWages(staff: StaffData[]): number {
  return staff.reduce((a, s) => a + s.wage, 0);
}

export class StaffSystem {
  candidates: Candidate[] = [];

  constructor(private state: GameState, private bus: EventBus<GameEvents>, private rng: Rng) {
    this.refreshCandidates();
  }

  get unlocked(): boolean {
    return this.state.levelAtLeast(STAFF_UNLOCK_LEVEL);
  }

  refreshCandidates(): void {
    this.candidates = [
      generateCandidate('cashier', this.rng), generateCandidate('cashier', this.rng),
      generateCandidate('stocker', this.rng), generateCandidate('stocker', this.rng),
      generateCandidate('helper', this.rng),
    ];
  }

  hire(index: number): { ok: boolean; reason?: string } {
    if (!this.unlocked) return { ok: false, reason: `Cần cấp ${STAFF_UNLOCK_LEVEL}` };
    if (this.state.data.staff.length >= MAX_STAFF) return { ok: false, reason: 'Đã đủ nhân viên' };
    const c = this.candidates[index];
    if (!c) return { ok: false, reason: 'Ứng viên không tồn tại' };
    this.state.data.staff.push({ uid: this.state.newUid('s'), ...c });
    this.candidates.splice(index, 1, generateCandidate(c.role, this.rng));
    this.bus.emit('staff:changed', {});
    this.bus.emit('toast', { message: `👋 Đã thuê ${c.name} (${STAFF_ROLES[c.role].name})`, kind: 'success' });
    return { ok: true };
  }

  fire(uid: string): void {
    const s = this.state.data.staff.find((x) => x.uid === uid);
    if (!s) return;
    this.state.data.staff = this.state.data.staff.filter((x) => x.uid !== uid);
    this.bus.emit('staff:changed', {});
    this.bus.emit('toast', { message: `Đã cho ${s.name} nghỉ việc`, kind: 'info' });
  }
}
