import type { SoundName } from '../core/EventBus';

/** Sinh AudioBuffer bằng code (không cần file âm thanh). */
type Gen = (t: number, i: number, n: number) => number;

function render(ctx: BaseAudioContext, seconds: number, gen: Gen): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, gen(i / ctx.sampleRate, i, n)));
  return buf;
}

const TAU = Math.PI * 2;
const env = (t: number, a: number, dec: number) => (t < a ? t / a : Math.exp(-(t - a) / dec));
let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

/** Bộ lọc thông thấp 1 cực cho noise. */
function lowNoise(k: number): () => number {
  let y = 0;
  return () => {
    y += k * (noise() - y);
    return y;
  };
}

export function buildSoundBank(ctx: BaseAudioContext): Map<SoundName | 'hum' | 'crowd', AudioBuffer> {
  const m = new Map<SoundName | 'hum' | 'crowd', AudioBuffer>();
  m.set('beep', render(ctx, 0.12, (t) => (Math.sin(TAU * 2350 * t) > 0 ? 0.35 : -0.35) * env(t, 0.003, 0.05)));
  m.set('scan', render(ctx, 0.14, (t) => Math.sin(TAU * (1900 + 400 * t) * t) * 0.4 * env(t, 0.002, 0.05)));
  m.set('ching', render(ctx, 0.9, (t) => {
    const bell = Math.sin(TAU * 1318 * t) * env(t, 0.002, 0.18) + Math.sin(TAU * 1976 * t) * env(Math.max(0, t - 0.09), 0.002, 0.35) * (t > 0.09 ? 1 : 0);
    return bell * 0.35 + noise() * 0.12 * env(t, 0.001, 0.03);
  }));
  m.set('coin', render(ctx, 0.3, (t) => (Math.sin(TAU * (t < 0.07 ? 988 : 1318) * t) > 0 ? 0.18 : -0.18) * env(t, 0.002, 0.12)));
  m.set('doorbell', render(ctx, 1.4, (t) => {
    const a = Math.sin(TAU * 784 * t) * env(t, 0.003, 0.4);
    const b = t > 0.35 ? Math.sin(TAU * 622 * t) * env(t - 0.35, 0.003, 0.5) : 0;
    return (a + b) * 0.3;
  }));
  m.set('door', render(ctx, 0.5, (t) => { const n = lowNoise(0.05); return n() * 0.4 * env(t, 0.05, 0.15); }));
  const stepNoise = lowNoise(0.25);
  m.set('footstep', render(ctx, 0.12, (t) => (stepNoise() * 0.8 + Math.sin(TAU * 90 * t) * 0.4) * env(t, 0.004, 0.03)));
  m.set('tock', render(ctx, 0.12, (t) => (Math.sin(TAU * 820 * t) * 0.5 + Math.sin(TAU * 1640 * t) * 0.15 + noise() * 0.2 * env(t, 0.001, 0.005)) * env(t, 0.001, 0.025)));
  m.set('place', render(ctx, 0.2, (t) => (Math.sin(TAU * 140 * t) * 0.6 + lowNoise(0.3)() * 0.3) * env(t, 0.002, 0.05)));
  m.set('thud', render(ctx, 0.3, (t) => (Math.sin(TAU * (90 - 40 * t) * t) * 0.8) * env(t, 0.002, 0.08)));
  m.set('click', render(ctx, 0.05, (t) => Math.sin(TAU * 1200 * t) * 0.3 * env(t, 0.001, 0.01)));
  m.set('pop', render(ctx, 0.12, (t) => Math.sin(TAU * (400 + 2500 * t) * t) * 0.35 * env(t, 0.003, 0.04)));
  m.set('error', render(ctx, 0.35, (t) => (Math.sin(TAU * (t < 0.15 ? 220 : 175) * t) > 0 ? 0.15 : -0.15) * env(t, 0.005, 0.12)));
  const w = lowNoise(0.08);
  m.set('whoosh', render(ctx, 0.35, (t) => w() * 0.9 * Math.sin(Math.PI * Math.min(1, t / 0.35))));
  const f = lowNoise(0.4);
  m.set('fold', render(ctx, 0.35, (t) => f() * 0.5 * (env(t, 0.005, 0.04) + (t > 0.15 ? env(t - 0.15, 0.005, 0.05) : 0))));
  const pp = lowNoise(0.6);
  m.set('paper', render(ctx, 0.25, (t) => pp() * 0.3 * Math.sin(Math.PI * Math.min(1, t / 0.25))));
  const dr = lowNoise(0.15);
  m.set('drawerOpen', render(ctx, 0.35, (t) => dr() * 0.5 * Math.sin(Math.PI * Math.min(1, t / 0.3)) + (t > 0.28 ? Math.sin(TAU * 180 * t) * env(t - 0.28, 0.002, 0.03) * 0.5 : 0)));
  m.set('drawerClose', render(ctx, 0.35, (t) => dr() * 0.4 * env(t, 0.02, 0.08) + Math.sin(TAU * 130 * t) * env(Math.max(0, t - 0.15), 0.002, 0.05) * (t > 0.15 ? 0.7 : 0)));
  const tr = lowNoise(0.02);
  m.set('truck', render(ctx, 2.6, (t) => {
    const rumble = tr() * 1.4 * Math.sin(Math.PI * Math.min(1, t / 2.6)) + Math.sin(TAU * 42 * t) * 0.15 * Math.sin(Math.PI * Math.min(1, t / 2.6));
    const beep = t > 1.7 && t < 2.4 && Math.floor((t - 1.7) / 0.18) % 2 === 0 ? (Math.sin(TAU * 1100 * t) > 0 ? 0.12 : -0.12) : 0;
    return rumble + beep;
  }));
  m.set('levelup', render(ctx, 0.9, (t) => {
    const notes = [523, 659, 784, 1046];
    const k = Math.min(3, Math.floor(t / 0.12));
    return Math.sin(TAU * notes[k] * t) * 0.25 * env(t - k * 0.12, 0.005, 0.25);
  }));
  // còi cổng an ninh: 2 tông luân phiên (kiểu còi báo trộm siêu thị)
  m.set('alarm', render(ctx, 1.2, (t) => {
    const f = Math.floor(t / 0.15) % 2 === 0 ? 1560 : 1170;
    const sq = Math.sin(TAU * f * t) > 0 ? 0.22 : -0.22;
    return sq * Math.min(1, t / 0.01, (1.2 - t) / 0.05);
  }));
  const mp = lowNoise(0.12);
  m.set('mop', render(ctx, 0.5, (t) => mp() * 0.7 * Math.sin(Math.PI * Math.min(1, t / 0.5)) * (0.6 + 0.4 * Math.sin(TAU * 6 * t))));
  m.set('punch', render(ctx, 0.25, (t) => (Math.sin(TAU * (120 - 200 * t) * t) * 0.9 + noise() * 0.5 * env(t, 0.001, 0.01)) * env(t, 0.002, 0.05)));
  // va chạm xe: tiếng dội trầm của thân xe + kim loại móp rung + mảnh vụn lách cách
  const cr = lowNoise(0.35);
  m.set('crash', render(ctx, 0.9, (t) => {
    const body = Math.sin(TAU * (70 - 40 * t) * t) * env(t, 0.002, 0.12) * 0.9;
    const metal = (Math.sin(TAU * 410 * t) * 0.5 + Math.sin(TAU * 687 * t) * 0.35 + Math.sin(TAU * 1130 * t) * 0.2) * env(t, 0.003, 0.18) * 0.45;
    const debris = cr() * env(t, 0.001, 0.07) * 1.3 + (t > 0.12 && noise() > 0.93 ? noise() * 0.5 * env(t - 0.12, 0.001, 0.25) : 0);
    return body + metal + debris;
  }));
  const h = lowNoise(0.02);
  m.set('hum', render(ctx, 2, (t, i, n) => {
    const edge = Math.min(1, i / 2000, (n - i) / 2000);
    return (Math.sin(TAU * 60 * t) * 0.25 + Math.sin(TAU * 120 * t) * 0.1 + h() * 0.25) * edge;
  }));
  const c1 = lowNoise(0.05);
  m.set('crowd', render(ctx, 3, (t, i, n) => {
    const edge = Math.min(1, i / 4000, (n - i) / 4000);
    return c1() * (0.6 + 0.4 * Math.sin(TAU * 2.3 * t) * Math.sin(TAU * 0.7 * t)) * edge;
  }));
  return m;
}
