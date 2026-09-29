import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/Random';
import { WALKING_VENDOR } from '../src/config/city';
import { DOOR_X } from '../src/config/constants';
import { Pedestrians } from '../src/game/Pedestrians';
import { competingShift, walkingVendorSays, walkingVendorsOut } from '../src/systems/VendorSystem';
import { cityLayout } from '../src/world/CityLayout';

// Người khối tạo texture bóng bằng canvas → dựng canvas giả (không cần vẽ thật)
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deep: any = new Proxy(function () {}, { get: () => deep, apply: () => deep, set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => deep }) });
  const rng = mulberry32(11);
  vi.spyOn(Math, 'random').mockImplementation(() => rng());
});

describe('gánh hàng rong đi bộ', () => {
  it('chỉ ra phố sáng sớm & chiều, nghỉ khi mưa', () => {
    expect(walkingVendorsOut(8)).toBe(true);
    expect(walkingVendorsOut(13)).toBe(false);
    expect(walkingVendorsOut(17)).toBe(true);
    expect(walkingVendorsOut(21)).toBe(false);
    expect(walkingVendorsOut(8, 0.6)).toBe(false);
  });

  it('chỉ cạnh tranh khi gánh đang đi ngang cửa hàng và đúng món', () => {
    const good = WALKING_VENDOR.goods[0];
    expect(walkingVendorSays(good, true)).toBe(WALKING_VENDOR.say);
    expect(walkingVendorSays(good, false)).toBeNull();
    expect(walkingVendorSays('shampoo', true)).toBeNull();
  });

  it('trời mưa thì sạp cố định cũng dọn về nên không giành khách', () => {
    expect(competingShift('bread', 8)).toBe('morning');
    expect(competingShift('bread', 8, 0.6)).toBeNull();
    expect(competingShift('bread', 8, 0.1)).toBe('morning');
  });

  const cam = new THREE.Vector3(DOOR_X, 1.6, 14);
  const player = { x: -400, z: -400 };

  function walk(hour: number, rain: number, seconds: number): { near: boolean; vendorsVisible: number; pedestrians: Pedestrians } {
    const L = cityLayout(10, 12);
    const p = new Pedestrians();
    p.reset(L);
    p.hour = hour;
    p.rain = rain;
    let near = false;
    for (let t = 0; t < seconds; t += 0.25) {
      p.update(0.25, player, cam);
      near ||= p.vendorNear;
    }
    const list = (p as unknown as { list: Array<{ vendor?: unknown; human: { root: THREE.Object3D } }> }).list;
    return { near, vendorsVisible: list.filter((w) => w.vendor && w.human.root.visible).length, pedestrians: p };
  }

  it('buổi sáng có gánh đi qua trước cửa hàng trong một vòng phố; giữa trưa và khi mưa thì không', () => {
    expect(walk(8, 0, 420).near).toBe(true);
    const noon = walk(13, 0, 260);
    expect(noon.near).toBe(false);
    expect(noon.vendorsVisible).toBe(0);
    const rainy = walk(8, 0.8, 260);
    expect(rainy.near).toBe(false);
    expect(rainy.vendorsVisible).toBe(0);
  });

  it('trời mưa người đi bộ thưa hẳn đi', () => {
    const count = (rain: number) => {
      const r = walk(12, rain, 1);
      const list = (r.pedestrians as unknown as { list: Array<{ vendor?: unknown; human: { root: THREE.Object3D } }> }).list;
      return list.filter((w) => !w.vendor && w.human.root.visible).length;
    };
    expect(count(0.9)).toBeLessThan(count(0));
  });
});
