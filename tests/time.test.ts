import { describe, expect, it, vi } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState } from '../src/core/GameState';
import { formatClock, TimeSystem } from '../src/systems/TimeSystem';

function setup(open = true) {
  const bus = new EventBus<GameEvents>();
  const state = new GameState(createNewState(1));
  state.data.storeOpen = open;
  return { bus, state, time: new TimeSystem(state, bus) };
}

describe('TimeSystem', () => {
  it('1 giây thực = 1 phút game', () => {
    const { time } = setup();
    time.update(60_000);
    expect(formatClock(time.minutes)).toBe('09:00');
  });

  it('chỉ có 1x và tua nhanh 3x', () => {
    const { time, state } = setup();
    time.setSpeed(3);
    expect(time.update(1000)).toBe(3);
    expect(time.minutes).toBe(8 * 60 + 3);
    time.setSpeed(2);
    expect(time.speed).toBe(3);
    time.toggleFast();
    expect(time.speed).toBe(1);
    time.toggleFast();
    expect(time.isFast).toBe(true);
    state.data.speed = 2; // save cũ có tốc độ 2x
    expect(time.speed).toBe(1);
  });

  it('đồng hồ chỉ chạy khi cửa hàng mở cửa, mô phỏng vẫn chạy', () => {
    const { time, state } = setup(false);
    expect(time.clockRunning).toBe(false);
    expect(time.update(60_000)).toBe(60);
    expect(formatClock(time.minutes)).toBe('08:00');
    state.data.storeOpen = true;
    expect(time.clockRunning).toBe(true);
    time.update(60_000);
    expect(formatClock(time.minutes)).toBe('09:00');
    state.data.storeOpen = false;
    time.update(60_000);
    expect(formatClock(time.minutes)).toBe('09:00');
    time.pause('pc');
    state.data.storeOpen = true;
    expect(time.clockRunning).toBe(false);
  });

  it('pause khi mở menu', () => {
    const { time, bus } = setup();
    const fn = vi.fn();
    bus.on('time:paused', fn);
    time.pause('pc');
    time.pause('build');
    expect(time.update(5000)).toBe(0);
    time.resume('pc');
    expect(time.paused).toBe(true);
    time.resume('build');
    expect(time.paused).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('khoá tốc độ 1x khi thu ngân', () => {
    const { time } = setup();
    time.setSpeed(3);
    time.lockSpeed(true);
    expect(time.speed).toBe(1);
    time.lockSpeed(false);
    expect(time.speed).toBe(3);
  });

  it('emit day:closing lúc 22:00 và dừng ở 23:59', () => {
    const { time, bus } = setup();
    const fn = vi.fn();
    bus.on('day:closing', fn);
    expect(time.isOpenHours()).toBe(true);
    time.update(14 * 60 * 1000);
    expect(fn).toHaveBeenCalledOnce();
    expect(time.isAfterClose()).toBe(true);
    time.update(10 * 60 * 60 * 1000);
    expect(formatClock(time.minutes)).toBe('23:59');
  });

  it('ngày mới', () => {
    const { time, state } = setup();
    time.update(100_000);
    time.startNewDay();
    expect(state.data.day).toBe(2);
    expect(formatClock(time.minutes)).toBe('08:00');
  });
});
