import { describe, expect, it } from 'vitest';
import { PERF } from '../src/config/perf';
import { summarize, verdict } from '../src/systems/PerfStats';

const steady = (n: number, ms = 16.67) => Array.from({ length: n }, () => ms);

describe('thống kê hiệu năng', () => {
  it('60 FPS đều: FPS ≈ 60, 1% thấp ≈ 60, không giật', () => {
    const s = summarize(steady(600));
    expect(s.avgFps).toBeCloseTo(60, 0);
    expect(s.lowFps).toBeCloseTo(60, 0);
    expect(s.jank + s.hitch + s.freeze).toBe(0);
    expect(verdict(s).pass).toBe(true);
  });

  it('1% thấp bị kéo xuống bởi vài khung dài dù trung bình vẫn cao', () => {
    const frames = [...steady(594), ...Array(6).fill(120)];
    const s = summarize(frames);
    expect(s.avgFps).toBeGreaterThan(50);
    expect(s.lowFps).toBeLessThan(10);
    expect(s.freeze).toBe(6);
    const v = verdict(s);
    expect(v.pass).toBe(false);
    expect(v.issues.some((i) => i.includes('khựng'))).toBe(true);
  });

  it('một cú khựng 1 giây (như lúc vào xe trước khi sửa) làm hỏng kết luận', () => {
    const s = summarize([...steady(300), 1100, ...steady(300)]);
    expect(s.worstMs).toBe(1100);
    expect(verdict(s).pass).toBe(false);
  });

  it('30 FPS đều: trượt mục tiêu trung bình', () => {
    const s = summarize(steady(600, 33.3));
    expect(s.avgFps).toBeLessThan(PERF.minAvgFps);
    expect(verdict(s).issues[0]).toContain('trung bình');
  });

  it('chưa đủ dữ liệu thì không kết luận đạt', () => {
    expect(verdict(summarize(steady(5))).pass).toBe(false);
    expect(summarize([]).frames).toBe(0);
  });

  it('phân vị p50 / p95 / p99 tăng dần', () => {
    const frames = Array.from({ length: 1000 }, (_, i) => 10 + (i % 100) * 0.3);
    const s = summarize(frames);
    expect(s.p50).toBeLessThanOrEqual(s.p95);
    expect(s.p95).toBeLessThanOrEqual(s.p99);
    expect(s.p99).toBeLessThanOrEqual(s.worstMs);
  });
});
