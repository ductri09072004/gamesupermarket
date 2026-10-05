import { PERF } from '../config/perf';

export interface PerfSummary {
  frames: number;
  seconds: number;
  avgFps: number;
  avgMs: number;
  p50: number;
  p95: number;
  p99: number;
  worstMs: number;
  /** FPS tính từ trung bình 1% khung chậm nhất ("1% low") */
  lowFps: number;
  jank: number;
  hitch: number;
  freeze: number;
}

export interface PerfVerdict {
  pass: boolean;
  issues: string[];
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

/** Thống kê từ danh sách thời gian khung (ms). Không dùng three / DOM nên chạy được trong test. */
export function summarize(frameMs: ArrayLike<number>): PerfSummary {
  const arr = Array.from(frameMs);
  const n = arr.length;
  if (n === 0) return { frames: 0, seconds: 0, avgFps: 0, avgMs: 0, p50: 0, p95: 0, p99: 0, worstMs: 0, lowFps: 0, jank: 0, hitch: 0, freeze: 0 };
  const total = arr.reduce((a, b) => a + b, 0);
  const sorted = [...arr].sort((a, b) => a - b);
  const worstN = Math.max(1, Math.ceil(n * 0.01));
  const worstAvg = sorted.slice(n - worstN).reduce((a, b) => a + b, 0) / worstN;
  return {
    frames: n,
    seconds: total / 1000,
    avgFps: total > 0 ? (n * 1000) / total : 0,
    avgMs: total / n,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    worstMs: sorted[n - 1],
    lowFps: 1000 / worstAvg,
    jank: arr.filter((v) => v > PERF.jankMs).length,
    hitch: arr.filter((v) => v > PERF.hitchMs).length,
    freeze: arr.filter((v) => v > PERF.freezeMs).length,
  };
}

/** Đạt mục tiêu 60 FPS ổn định chưa, và nếu chưa thì vì sao. */
export function verdict(s: PerfSummary): PerfVerdict {
  const issues: string[] = [];
  if (s.frames < 30) return { pass: false, issues: ['Chưa đủ dữ liệu (cần ít nhất 30 khung)'] };
  if (s.avgFps < PERF.minAvgFps) issues.push(`FPS trung bình ${s.avgFps.toFixed(1)} < ${PERF.minAvgFps}`);
  if (s.lowFps < PERF.minLowFps) issues.push(`1% khung chậm nhất chỉ ${s.lowFps.toFixed(1)} FPS (< ${PERF.minLowFps})`);
  if (s.hitch > 0) issues.push(`${s.hitch} khung khựng > ${PERF.hitchMs}ms (tệ nhất ${s.worstMs.toFixed(0)}ms)`);
  if (s.jank / s.frames > PERF.maxJankRatio) issues.push(`${s.jank} khung giật > ${PERF.jankMs}ms (${((s.jank / s.frames) * 100).toFixed(1)}%)`);
  return { pass: issues.length === 0, issues };
}
