import { describe, expect, it } from 'vitest';
import { createNewState } from '../src/core/GameState';
import { deserialize, migrate, SaveSystem, serialize, type StorageLike } from '../src/core/SaveSystem';
import { SAVE_VERSION } from '../src/config/constants';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('SaveSystem', () => {
  it('lưu → tải lại → state giống hệt', () => {
    const s = createNewState(99);
    s.money = 1234.56;
    s.day = 7;
    s.licenses.push(1);
    s.prices.noodles = 0.99;
    s.furniture[0].slots[0] = { productId: 'noodles', qty: 7 };
    s.boxes.push({ uid: 'b1', productId: 'water', qty: 3, open: true, gx: 4.8, gy: 10.9, location: 'floor', holderId: null });
    s.furniture.push({ uid: 'f9', type: 'shelf_small', gx: 14, gy: 8, rot: 2, slots: [{ productId: 'candy', qty: 5 }, { productId: null, qty: 0 }, { productId: null, qty: 0 }, { productId: null, qty: 0 }], boxes: [] });
    s.player = { gx: 2.3, gy: 7.1, yaw: 1.2 };
    s.staff.push({ uid: 's1', name: 'Lê An', role: 'stocker', wage: 50, speed: 1.1, shirt: 2 });
    s.settings.muted = true;
    const store = new MemStorage();
    const saves = new SaveSystem(store, 'k');
    expect(saves.hasSave()).toBe(false);
    saves.save(s);
    expect(saves.hasSave()).toBe(true);
    expect(saves.load()).toEqual(s);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('bản lưu 2D cũ không tương thích → coi như không có bản lưu', () => {
    const old = createNewState(5) as unknown as Record<string, unknown>;
    old.version = 2;
    expect(() => migrate(old)).toThrow();
    const store = new MemStorage();
    store.setItem('k', JSON.stringify(old));
    const saves = new SaveSystem(store, 'k');
    expect(saves.load()).toBeNull();
    expect(saves.hasSave()).toBe(false);
  });

  it('bổ sung trường thiếu bằng mặc định', () => {
    const cur = createNewState(5) as unknown as Record<string, unknown>;
    delete cur.furnitureStock;
    const m = migrate(cur);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.furnitureStock).toEqual([]);
  });

  it('dữ liệu hỏng → null', () => {
    const store = new MemStorage();
    store.setItem('k', '{broken');
    expect(new SaveSystem(store, 'k').load()).toBeNull();
  });
});
