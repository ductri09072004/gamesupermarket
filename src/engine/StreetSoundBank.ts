/** Âm thanh phố Việt tổng hợp bằng code: còi xe máy, tiếng rao hàng rong, chuông thắp nhang. */

const TAU = Math.PI * 2;

function render(ctx: BaseAudioContext, seconds: number, gen: (t: number) => number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, gen(i / ctx.sampleRate)));
  return buf;
}

/** Còi điện xe máy "tít tít": 2 hồi sóng vuông bị nén (cho giống loa còi rè), hơi rung tần số. */
function horn(ctx: BaseAudioContext): AudioBuffer {
  const f = 415 + Math.random() * 60;
  let ph = 0;
  return render(ctx, 0.45, (t) => {
    const on = (t < 0.15) || (t > 0.21 && t < 0.4);
    if (!on) return 0;
    ph += (TAU * f * (1 + 0.01 * Math.sin(TAU * 30 * t))) / ctx.sampleRate;
    const edge = Math.min(1, (t % 0.21) / 0.008);
    return Math.tanh(Math.sin(ph) * 3 + Math.sin(ph * 2) * 0.8) * 0.3 * edge;
  });
}

/**
 * Tiếng rao kiểu "bánh mì nóng giòn đây": giọng người mô phỏng bằng chuỗi hoạ âm của cao độ f0,
 * biên độ mỗi hoạ âm theo 2 formant của nguyên âm (≈ "a", "ô", "ây"), 3 âm tiết lên xuống.
 */
function vendorCall(ctx: BaseAudioContext): AudioBuffer {
  const syl = [
    { d: 0.34, f0: 225, f1: 780, f2: 1250 },
    { d: 0.3, f0: 262, f1: 520, f2: 900 },
    { d: 0.62, f0: 205, f1: 650, f2: 1750 },
  ];
  const total = syl.reduce((a, s) => a + s.d, 0) + 0.2;
  let ph = 0;
  return render(ctx, total, (t) => {
    let s0 = 0;
    let k = 0;
    while (k < syl.length - 1 && t > s0 + syl[k].d) { s0 += syl[k].d; k++; }
    const s = syl[k];
    const u = (t - s0) / s.d;
    if (u > 1) return 0;
    // luyến cao độ sang âm tiết sau + rung giọng
    const next = syl[Math.min(k + 1, syl.length - 1)];
    const f0 = (s.f0 + (next.f0 - s.f0) * Math.max(0, u - 0.7) / 0.3 * 0.4) * (1 + 0.012 * Math.sin(TAU * 5.5 * t));
    ph += (TAU * f0) / ctx.sampleRate;
    let v = 0;
    for (let h = 1; h <= 18; h++) {
      const hf = h * f0;
      const a = Math.exp(-(((hf - s.f1) / 260) ** 2)) + 0.6 * Math.exp(-(((hf - s.f2) / 330) ** 2)) + 0.12 / h;
      v += Math.sin(ph * h) * a;
    }
    const env = Math.min(1, u / 0.08) * Math.min(1, (1 - u) / 0.15);
    return v * 0.09 * env;
  });
}

/** Chuông nhỏ "boong" khi thắp nhang: các hoạ âm lệch (inharmonic) tắt dần, ngân dài. */
function bell(ctx: BaseAudioContext): AudioBuffer {
  const parts = [[520, 1, 2.2], [1310, 0.5, 1.4], [1990, 0.3, 0.9], [2760, 0.18, 0.6]];
  return render(ctx, 2.6, (t) => {
    let v = 0;
    for (const [f, a, dec] of parts) v += Math.sin(TAU * f * t) * a * Math.exp(-t / dec);
    return v * 0.22 * Math.min(1, t / 0.004);
  });
}

export function addStreetSounds(ctx: BaseAudioContext, m: Map<string, AudioBuffer>): void {
  m.set('horn', horn(ctx));
  m.set('vendorCall', vendorCall(ctx));
  m.set('bell', bell(ctx));
}
