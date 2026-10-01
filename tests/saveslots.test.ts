import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_SLOTS } from '../src/config/constants';
import { createNewState } from '../src/core/GameState';
import { SaveSlots } from '../src/core/SaveSlots';
import { serialize, type StorageLike } from '../src/core/SaveSystem';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('SaveSlots', () => {
  it(`có ${SAVE_SLOTS} hồ sơ, ban đầu đều trống`, () => {
    const slots = new SaveSlots(new MemStorage());
    const list = slots.list();
    expect(list).toHaveLength(5);
    expect(list.every((s) => s.empty)).toBe(true);
    expect(slots.lastSlot()).toBeNull();
    expect(slots.firstEmpty()).toBe(1);
  });

  it('các hồ sơ độc lập, tóm tắt đúng ngày / tiền / cấp', () => {
    const slots = new SaveSlots(new MemStorage());
    const a = createNewState(1); a.day = 3; a.money = 500; a.level = 2;
    const b = createNewState(2); b.day = 9; b.devMode = true;
    slots.system(2).save(a);
    slots.system(4).save(b);
    const [s1, s2, s3, s4] = slots.list();
    expect([s1.empty, s3.empty]).toEqual([true, true]);
    expect(s2).toMatchObject({ slot: 2, empty: false, day: 3, money: 500, level: 2, devMode: false });
    expect(s4).toMatchObject({ slot: 4, day: 9, devMode: true });
    expect(slots.firstEmpty()).toBe(1);
  });

  it('markSaved ghi nhận hồ sơ đang chơi → lastSlot trỏ tới đó', () => {
    const slots = new SaveSlots(new MemStorage());
    slots.system(1).save(createNewState(1));
    slots.system(3).save(createNewState(2));
    slots.setActive(3);
    slots.markSaved();
    expect(slots.lastSlot()).toBe(3);
    expect(slots.list()[2].savedAt).toBeGreaterThan(0);
    slots.setActive(1);
    expect(slots.lastSlot()).toBe(1);
  });

  it('xoá hồ sơ cuối cùng → lastSlot về hồ sơ còn lại', () => {
    const slots = new SaveSlots(new MemStorage());
    slots.system(1).save(createNewState(1));
    slots.system(2).save(createNewState(2));
    slots.setActive(2);
    slots.clear(2);
    expect(slots.list()[1].empty).toBe(true);
    expect(slots.lastSlot()).toBe(1);
    slots.clear(1);
    expect(slots.lastSlot()).toBeNull();
  });

  it('không có hồ sơ đang chơi (menu demo) → activeSystem không ghi gì', () => {
    const store = new MemStorage();
    const slots = new SaveSlots(store);
    slots.setActive(null);
    expect(slots.activeSystem().save(createNewState(1))).toBe(true);
    expect(store.map.size).toBe(0);
  });

  it('bản lưu một-ô cũ được chuyển thành hồ sơ 1', () => {
    const store = new MemStorage();
    const old = createNewState(7); old.day = 12;
    store.setItem(SAVE_KEY, serialize(old));
    const slots = new SaveSlots(store);
    expect(slots.list()[0]).toMatchObject({ empty: false, day: 12 });
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it('dữ liệu meta hỏng không làm sập', () => {
    const store = new MemStorage();
    store.setItem(`${SAVE_KEY}-slots`, '{broken');
    const slots = new SaveSlots(store);
    slots.system(5).save(createNewState(3));
    expect(slots.lastSlot()).toBe(5);
  });
});
