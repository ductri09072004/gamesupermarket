import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GRAVITY, JUMP_VELOCITY } from '../src/config/constants';
import type { Input } from '../src/engine/Input';
import { PlayerController } from '../src/player/PlayerController';

function fakeInput(down: Set<string>): Input {
  return { keys: { isDown: (c: string) => down.has(c) } } as unknown as Input;
}

describe('Nhảy', () => {
  it('nhảy lên rồi rơi xuống sàn, độ cao đỉnh ≈ v²/2g', () => {
    const p = new PlayerController(new THREE.PerspectiveCamera(), 0, 0, 0);
    const keys = new Set(['Space']);
    let maxY = 0;
    let landed = false;
    p.onLand = () => { landed = true; };
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60, fakeInput(keys), []);
      maxY = Math.max(maxY, p.y);
      if (i === 0) keys.delete('Space');
    }
    expect(maxY).toBeGreaterThan(0.6);
    expect(maxY).toBeLessThanOrEqual((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY) + 0.05);
    expect(landed).toBe(true);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('giữ Space không nhảy liên tục, không nhảy kép giữa không trung', () => {
    const p = new PlayerController(new THREE.PerspectiveCamera(), 0, 0, 0);
    let jumps = 0;
    p.onJump = () => { jumps++; };
    const keys = new Set(['Space']);
    for (let i = 0; i < 20; i++) p.update(1 / 60, fakeInput(keys), []);
    keys.delete('Space');
    p.update(1 / 60, fakeInput(keys), []);
    keys.add('Space');
    p.update(1 / 60, fakeInput(keys), []);
    expect(jumps).toBe(1);
  });

  it('không nhảy khi đang ngồi', () => {
    const p = new PlayerController(new THREE.PerspectiveCamera(), 0, 0, 0);
    p.update(1 / 60, fakeInput(new Set(['ControlLeft', 'Space'])), []);
    expect(p.y).toBe(0);
  });
});
