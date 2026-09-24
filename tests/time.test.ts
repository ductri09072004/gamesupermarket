import { describe, expect, it, vi } from 'vitest';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { createNewState, GameState } from '../src/core/GameState';
import { formatClock, TimeSystem } from '../src/systems/TimeSystem';

function setup() {
  const bus = new EventBus<GameEvents>();
  const state = new GameState(createNewState(1));
  return { bus, state, time: new TimeSystem(state, bus) };
}

describe('TimeSystem', () => {
  it('1 giây thực = 1 phút game', () => {
    const { time } = setup();
    time.update(60_000);
    expect(formatClock(time.minutes)).toBe('09:00');
  });

  it('tốc độ 1x/2x/3x', () => {
    const { time } = setup();
    time.setSpeed(3);
    expect(time.update(1000)).toBe(3);
    expect(time.minutes).toBe(8 * 60 + 3);
    time.setSpeed(5);
    expect(time.speed).toBe(3);
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
