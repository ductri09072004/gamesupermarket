import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Pedestrians } from '../src/game/Pedestrians';
import { cityLayout } from '../src/world/CityLayout';
import { carLoops } from '../src/world/CityRoutes';

describe('NPC qua đường', () => {
  const L = cityLayout(10);
  const path = L.crosswalks[0];
  function walker() {
    const people = new Pedestrians();
    const w = {
      human: { root: new THREE.Group(), speed: 0, animInterval: 0, update: () => {}, dispose: () => {} },
      route: carLoops([L.loopCenters[0]])[0], d: 0, speed: 1.25, curb: 1, x: 0, z: 0,
      crossing: { path, progress: 0, reverse: false, active: false, wait: 0 },
    };
    (people as unknown as { list: unknown[] }).list = [w];
    return { people, w };
  }
  const far = { x: -500, z: -500 };
  const camera = new THREE.Vector3(path.from.x, 2, path.from.z);

  it('chờ đèn và chờ xe cuối cùng rời vạch', () => {
    const { people, w } = walker();
    people.signalTime = -path.offset;
    people.update(1, far, camera);
    expect(w.crossing.progress).toBe(0);
    expect(w.human.speed).toBe(0);
    people.signalTime = 46 - path.offset;
    people.canCross = () => false;
    people.update(1, far, camera);
    expect(w.crossing.active).toBe(false);
    people.canCross = () => true;
    people.update(1, far, camera);
    expect(w.crossing.progress).toBeGreaterThan(0);
    expect(people.occupiedCrosswalks().has(path.id)).toBe(true);
  });

  it('đã bước xuống đường thì sang hết, dù đèn người đi bộ đổi đỏ', () => {
    const { people, w } = walker();
    people.signalTime = 46 - path.offset;
    people.update(1, far, camera);
    people.signalTime = 58 - path.offset;
    const before = w.crossing.progress;
    people.update(1, far, camera);
    expect(w.crossing.progress).toBeGreaterThan(before);
    for (let i = 0; i < 100 && w.crossing.active; i++) people.update(0.1, far, camera);
    expect(w.crossing.active).toBe(false);
    expect(w.crossing.reverse).toBe(true);
    expect(people.occupiedCrosswalks().size).toBe(0);
    people.destroy();
  });
});
