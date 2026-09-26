import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Input } from '../src/engine/Input';
import { PlayerController } from '../src/player/PlayerController';
import type { Support } from '../src/player/StepSupport';

const input = (keys: string[]) => ({ keys: { isDown: (c: string) => keys.includes(c) } }) as unknown as Input;
/** Thùng 0.46 × 0.36 đặt ở (x, z), nóc cao `top` */
const box = (uid: string, x: number, z: number, top: number): Support => ({ uid, minX: x - 0.23, maxX: x + 0.23, minZ: z - 0.18, maxZ: z + 0.18, top });

/** Người chơi ở (0, 0) nhìn -Z, giữ W đi về phía trước N khung hình. */
function walk(supports: Support[], frames: number, p = new PlayerController(new THREE.PerspectiveCamera(), 0, 0, 0)) {
  p.supports = supports;
  const pushes: string[] = [];
  p.onPush = (uid) => pushes.push(uid);
  for (let i = 0; i < frames; i++) p.update(1 / 60, input(['KeyW']), []);
  return { p, pushes };
}

describe('người chơi & thùng hàng dưới đất', () => {
  it('thùng thấp (0.3m): bước lên, chân nâng dần lên nóc thùng, không bị chặn', () => {
    const { p, pushes } = walk([box('a', 0, -1, 0.3)], 22);
    expect(p.z).toBeLessThan(-0.8);
    expect(p.y).toBeCloseTo(0.3, 2);
    expect(pushes).toHaveLength(0);
  });

  it('bước qua khỏi thùng thì rơi xuống sàn', () => {
    const { p } = walk([box('a', 0, -1, 0.3)], 80);
    expect(p.z).toBeLessThan(-2);
    expect(p.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('chồng thùng cao (0.6m): bị chặn lại và tì vào thì đẩy thùng', () => {
    const { p, pushes } = walk([box('a', 0, -1, 0.6)], 60);
    expect(p.z).toBeGreaterThan(-1 + 0.18 + 0.29);
    expect(p.y).toBe(0);
    expect(pushes.length).toBeGreaterThan(10);
    expect(new Set(pushes)).toEqual(new Set(['a']));
  });

  it('đang đứng trên 1 thùng thì bước tiếp lên chồng cao hơn 1 bậc được', () => {
    const p = new PlayerController(new THREE.PerspectiveCamera(), 0, 0, 0);
    walk([box('a', 0, -1, 0.3), box('b', 0, -1.5, 0.6)], 40, p);
    expect(p.y).toBeCloseTo(0.6, 2);
  });
});
