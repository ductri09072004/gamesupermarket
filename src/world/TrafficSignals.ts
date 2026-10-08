export type SignalColor = 'red' | 'amber' | 'green';

export interface TrafficSignal {
  x: number;
  z: number;
  /** Mặt đèn hướng về phía xe đang tới. */
  rot: number;
  axis: 'x' | 'z';
  offset: number;
}

export const SIGNAL_CYCLE = 64;
export function signalPhase(time: number, offset = 0): number {
  return ((time + offset) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
}

/** Hai lượt xe (18s xanh + 3s vàng + 2s giải phóng), rồi 12s người đi bộ + 6s giải phóng. */
export function signalColor(time: number, axis: 'x' | 'z', offset = 0): SignalColor {
  const phase = signalPhase(time, offset) - (axis === 'z' ? 23 : 0);
  return phase >= 0 && phase < 18 ? 'green' : phase >= 18 && phase < 21 ? 'amber' : 'red';
}

export function pedestrianGreen(time: number, offset = 0): boolean {
  const phase = signalPhase(time, offset);
  return phase >= 46 && phase < 58;
}

/** Không cho người mới bắt đầu quá muộn; dành 1 giây dự phòng trước lượt xe tiếp theo. */
export function canStartCrossing(time: number, offset: number, distance: number, speed: number): boolean {
  return speed > 0 && pedestrianGreen(time, offset) && signalPhase(time, offset) + distance / speed + 1 < SIGNAL_CYCLE;
}

/** Một đèn cho mỗi hướng đường đi vào giao lộ, kể cả ngã ba và góc rẽ ở mép bản đồ. */
export function planTrafficSignals(xs: number[], zs: number[], halves: number[], vHalf: number): TrafficSignal[] {
  const out: TrafficSignal[] = [];
  xs.forEach((x, i) => zs.forEach((z, j) => {
    const dx = vHalf + 0.7;
    const dz = halves[j] + 0.7;
    const offset = (i * zs.length + j) * 3;
    // Làn phải: đi +X ở phía +Z, đi +Z ở phía -X.
    if (i > 0) out.push({ x: x - dx, z: z + dz, rot: -Math.PI / 2, axis: 'x', offset });
    if (i < xs.length - 1) out.push({ x: x + dx, z: z - dz, rot: Math.PI / 2, axis: 'x', offset });
    if (j > 0) out.push({ x: x - dx, z: z - dz, rot: Math.PI, axis: 'z', offset });
    if (j < zs.length - 1) out.push({ x: x + dx, z: z + dz, rot: 0, axis: 'z', offset });
  }));
  return out;
}
