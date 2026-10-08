import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Loop } from '../src/engine/Loop';

describe('frame scheduling', () => {
  let now = 0, id = 0;
  let frames: Map<number, FrameRequestCallback>;
  let page: EventTarget & { hidden: boolean };
  beforeEach(() => {
    now = 0; id = 0; frames = new Map();
    page = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('document', page);
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id; });
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function tick(time: number): void {
    now = time;
    const ready = [...frames.values()]; frames.clear();
    for (const fn of ready) fn(now);
  }

  it('caps rendering on a 144Hz screen while preserving 60Hz simulation time', () => {
    let simulated = 0;
    const render = vi.fn();
    const loop = new Loop(dt => { simulated += dt; }, render);
    loop.start();
    for (let frame = 1; frame <= 288; frame++) tick(frame * 1000 / 144);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(118);
    expect(render.mock.calls.length).toBeLessThanOrEqual(121);
    expect(simulated).toBeCloseTo(2, 1);
    loop.stop();
    expect(frames.size).toBe(0);
  });

  it('does no work while hidden and resumes without a burst of catch-up updates', () => {
    const update = vi.fn(), render = vi.fn();
    const loop = new Loop(update, render); loop.start(); tick(20);
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    tick(10000);
    const before = update.mock.calls.length;
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); tick(10020);
    expect(update.mock.calls.length - before).toBe(1);
    expect(render.mock.calls.length).toBe(2);
    loop.stop();
  });

  it('renders a menu at 30fps and can return to 60fps without duplicating the loop', () => {
    const render = vi.fn(), loop = new Loop(() => {}, render);
    loop.setMaxFps(30); loop.start(); loop.start();
    for (let frame = 1; frame <= 60; frame++) tick(frame * 1000 / 60);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(29);
    expect(render.mock.calls.length).toBeLessThanOrEqual(31);
    render.mockClear(); loop.setMaxFps(60);
    for (let frame = 61; frame <= 120; frame++) tick(frame * 1000 / 60);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(58);
    loop.stop();
  });
});
