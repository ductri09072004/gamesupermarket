import { MAX_REPUTATION, XP_BASE, XP_EXPONENT } from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { GameState } from '../core/GameState';

export function xpNeeded(level: number): number {
  return Math.round(XP_BASE * Math.pow(level, XP_EXPONENT));
}

/** Cộng XP và trả về (level, xp) mới. */
export function applyXp(level: number, xp: number, gained: number): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let x = xp + gained;
  let n = 0;
  while (x >= xpNeeded(l)) {
    x -= xpNeeded(l);
    l += 1;
    n += 1;
  }
  return { level: l, xp: x, levelsGained: n };
}

export class ProgressionSystem {
  constructor(private state: GameState, private bus: EventBus<GameEvents>) {}

  addXp(amount: number): void {
    if (amount <= 0) return;
    const d = this.state.data;
    const r = applyXp(d.level, d.xp, amount);
    d.level = r.level;
    d.xp = r.xp;
    d.stats.xpGained += amount;
    this.bus.emit('xp:changed', { xp: d.xp, level: d.level, needed: xpNeeded(d.level) });
    if (r.levelsGained > 0) {
      this.bus.emit('level:up', { level: d.level });
      this.bus.emit('sound', { name: 'levelup' });
      this.bus.emit('toast', { message: `🎉 Lên cấp ${d.level}!`, kind: 'success' });
    }
  }

  changeReputation(delta: number): void {
    const d = this.state.data;
    const next = Math.max(0, Math.min(MAX_REPUTATION, d.reputation + delta));
    if (next === d.reputation) return;
    const real = next - d.reputation;
    d.reputation = next;
    this.bus.emit('reputation:changed', { reputation: next, delta: real });
  }
}
