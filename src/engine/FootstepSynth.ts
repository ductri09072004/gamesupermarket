/**
 * Tiếng bước chân tổng hợp bằng code, mỗi mặt sàn vài biến thể để không lặp.
 * Một bước = gót chạm (tiếng "cạch" cao + lực nén trầm + cộng hưởng sàn)
 * rồi mũi chân lăn xuống (~70ms sau, nhỏ hơn) + tiếng sột soạt đế giày.
 */
export type StepSurface = 'tile' | 'concrete';

export const STEP_VARIANTS = 6;

const TAU = Math.PI * 2;

/** PRNG riêng để các biến thể ổn định giữa các lần tải. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Lọc 1 cực: thông thấp (k nhỏ = trầm) và thông cao = x - LP. */
function filters(k: number) {
  let lp = 0;
  return {
    low: (x: number) => (lp += k * (x - lp)),
    high: (x: number) => x - (lp += k * (x - lp)),
  };
}

const decay = (t: number, tau: number) => (t < 0 ? 0 : Math.exp(-t / tau));
/** Bao hình có attack ngắn để khỏi nghe "tạch" số. */
const hit = (t: number, att: number, tau: number) => (t < 0 ? 0 : t < att ? t / att : Math.exp(-(t - att) / tau));

interface SurfaceProfile {
  click: number; // độ sáng tiếng gót (lượng noise cao tần)
  clickTau: number;
  thump: number; // lực nén trầm
  thumpHz: number;
  ring: number; // cộng hưởng của sàn (gạch vang hơn bê tông)
  ringHz: number;
  ringTau: number;
  grit: number; // sạn cát lạo xạo
  scuff: number;
}

const PROFILES: Record<StepSurface, SurfaceProfile> = {
  tile: { click: 0.55, clickTau: 0.004, thump: 0.55, thumpHz: 95, ring: 0.16, ringHz: 520, ringTau: 0.018, grit: 0, scuff: 0.1 },
  concrete: { click: 0.35, clickTau: 0.006, thump: 0.6, thumpHz: 80, ring: 0.05, ringHz: 380, ringTau: 0.01, grit: 0.35, scuff: 0.22 },
};

export function renderStep(ctx: BaseAudioContext, surface: StepSurface, variant: number): AudioBuffer {
  const p = PROFILES[surface];
  const r = rng(0x5eed + variant * 7919 + (surface === 'tile' ? 0 : 104729));
  const sr = ctx.sampleRate;
  const dur = 0.24;
  const n = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);

  // tham số ngẫu nhiên cho từng biến thể
  const toeAt = 0.055 + r() * 0.035;
  const toeGain = 0.35 + r() * 0.25;
  const thumpHz = p.thumpHz * (0.85 + r() * 0.3);
  const ringHz = p.ringHz * (0.85 + r() * 0.35);
  const ring2Hz = ringHz * (1.47 + r() * 0.2);
  const heelGain = 0.85 + r() * 0.15;
  const clickF = filters(0.35 + r() * 0.2);
  const toeF = filters(0.12 + r() * 0.08);
  const scuffF = filters(0.06);
  const gritF = filters(0.5);
  const noise = () => r() * 2 - 1;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tt = t - toeAt;
    // gót: tiếng cạch cao tần + lực nén trầm có pitch hơi tụt + cộng hưởng sàn
    const heelClick = clickF.high(noise()) * hit(t, 0.0006, p.clickTau) * p.click;
    const thump = Math.sin(TAU * thumpHz * t * (1 - t * 2)) * hit(t, 0.002, 0.022) * p.thump;
    const ring = (Math.sin(TAU * ringHz * t) + 0.5 * Math.sin(TAU * ring2Hz * t)) * hit(t, 0.001, p.ringTau) * p.ring;
    // mũi chân: nhẹ, trầm hơn gót
    const toe = toeF.low(noise()) * hit(tt, 0.001, 0.012) * 1.6
      + Math.sin(TAU * thumpHz * 1.3 * tt) * hit(tt, 0.002, 0.012) * 0.3;
    // đế giày miết nhẹ xuống sàn trong khoảng gót → mũi
    const roll = t > 0.004 && t < toeAt + 0.03 ? Math.sin(Math.PI * (t - 0.004) / (toeAt + 0.026)) : 0;
    const scuff = scuffF.low(noise()) * roll * p.scuff * 2.2;
    // sạn: các hạt nhỏ lác đác
    const grit = gritF.high(r() < 0.02 ? noise() : 0) * p.grit * decay(t, 0.05) * 3;
    const v = (heelClick + thump + ring) * heelGain + toe * toeGain + scuff + grit;
    d[i] = Math.max(-1, Math.min(1, v * 0.9));
  }
  // fade cuối tránh click
  const fade = Math.floor(sr * 0.01);
  for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  return buf;
}

export function buildStepBank(ctx: BaseAudioContext): Record<StepSurface, AudioBuffer[]> {
  const out = { tile: [] as AudioBuffer[], concrete: [] as AudioBuffer[] };
  for (const s of ['tile', 'concrete'] as const) for (let v = 0; v < STEP_VARIANTS; v++) out[s].push(renderStep(ctx, s, v));
  return out;
}
