import { WALK_SPEED } from '../config/constants';
import type { AudioEngine } from '../engine/Audio';
import type { StepSurface } from '../engine/FootstepSynth';
import { worldToCell } from '../world/NavGrid';
import type { GameCtx } from './Ctx';

/** Gạch trong cửa hàng/kho, còn lại (vỉa hè, đường phố) là bê tông. */
export function stepSurface(c: GameCtx): StepSurface {
  const cell = worldToCell(c.player.x, c.player.z);
  const t = c.s.grid.get(cell.gx, cell.gy)?.type;
  return t === 'floor' || t === 'warehouse' || t === 'door' ? 'tile' : 'concrete';
}

/** Bước chân to/nhỏ theo dáng đi: rón rén khi ngồi, dậm mạnh khi chạy hoặc bê thùng. */
export function playerFootstep(c: GameCtx, audio: AudioEngine): void {
  const p = c.player;
  const pace = Math.min(1.6, p.speed / WALK_SPEED);
  const vol = p.crouching ? 0.22 : 0.3 + 0.4 * pace + (p.carrying ? 0.08 : 0);
  audio.playStep(stepSurface(c), vol);
}
