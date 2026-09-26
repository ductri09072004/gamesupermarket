import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNewState, type BoxData } from '../src/core/GameState';
import type { Services } from '../src/core/Services';
import { BOX_H } from '../src/entities/Box';
import { BoxPhysics } from '../src/game/BoxPhysics';

function setup(boxes: Array<Partial<BoxData>>) {
  const data = createNewState(1);
  data.boxes = boxes.map((b, i) => ({ uid: `b${i + 1}`, productId: 'water', qty: 12, open: false, gx: 5, gy: 5, location: 'floor', holderId: null, ...b }) as BoxData);
  const s = { data } as unknown as Services;
  const none: never[] = [];
  const ph = new BoxPhysics(s, () => none, () => false);
  return { data, ph };
}
const run = (ph: BoxPhysics, frames: number, each: () => void = () => {}) => { for (let i = 0; i < frames; i++) { each(); ph.update(1 / 60, null); } };

describe('vật lý thùng hàng', () => {
  it('thùng nằm yên (đang ngủ) khi không ai đụng — không trôi, không ghi tư thế', () => {
    const { data, ph } = setup([{}]);
    run(ph, 120);
    expect(data.boxes[0].gx).toBe(5);
    expect(data.boxes[0].pose).toBeUndefined();
  });

  it('người chơi tì vào đẩy: thùng trượt đi theo hướng đẩy, ghi lại vị trí mới', () => {
    const { data, ph } = setup([{}]);
    run(ph, 90, () => ph.push('b1', 1, 0, 0, 1 / 60));
    run(ph, 120);
    const b = data.boxes[0];
    expect(b.gx).toBeGreaterThan(5.3);
    expect(Math.abs(b.gy - 5)).toBeLessThan(0.2);
    expect(b.pose).toBeDefined();
  });

  it('cung cấp hộp bao + độ cao nóc cho người chơi (1 thùng ≈ 0.3m, chồng 2 ≈ 0.6m)', () => {
    const { ph } = setup([{}, {}, { gx: 7, gy: 5 }]);
    run(ph, 5);
    const sup = ph.supports({ x: 6, z: 5 });
    const tops = sup.map((s) => s.top).sort();
    expect(tops[0]).toBeCloseTo(0.3, 1);
    expect(tops[2]).toBeCloseTo(0.6, 1);
  });

  it('chồng 3 thùng: rút thùng dưới cùng thì 2 thùng trên rơi xuống sàn', () => {
    const { data, ph } = setup([{}, {}, {}]);
    run(ph, 10);
    data.boxes[0].location = 'held';
    run(ph, 180);
    const ys = data.boxes.slice(1).map((b) => b.pose?.y ?? 99).sort();
    expect(ys[0]).toBeLessThan(BOX_H * 0.7);
    expect(ys[1]).toBeLessThan(BOX_H * 1.7);
  });

  it('thả thùng từ tầm tay: rơi xuống, nằm trên sàn (mặt nào cũng được, không xuyên đất)', () => {
    const { data, ph } = setup([{ location: 'held' }]);
    data.boxes[0].location = 'floor';
    ph.launch('b1', new THREE.Vector3(5, 1, 5), new THREE.Vector3(0, 0, -1));
    run(ph, 240);
    const b = data.boxes[0];
    // tâm hộp ở độ cao = nửa cạnh của mặt đang úp xuống (0.15 / 0.18 / 0.23 m)
    expect(b.pose!.y).toBeGreaterThan(0.13);
    expect(b.pose!.y).toBeLessThan(0.25);
    expect(b.gy).toBeLessThan(5);
  });
});
