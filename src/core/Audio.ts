import type { EventBus, GameEvents, SoundName } from './EventBus';

/** Âm thanh tổng hợp bằng WebAudio (không dùng file). */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  muted = false;
  musicOn = true;

  constructor() {
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Gắn vào EventBus (gọi lại mỗi khi bus được làm mới). */
  attach(bus: EventBus<GameEvents>): void {
    bus.on('sound', ({ name }) => this.play(name));
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number, dest?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, delay = 0, freq = 1200, dest?: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(dest ?? this.master);
    src.start(t);
  }

  play(name: SoundName): void {
    if (this.muted || !this.ensure()) return;
    switch (name) {
      case 'beep': this.tone(1760, 0.09, 'square', 0.15); break;
      case 'ching':
        this.tone(1318, 0.12, 'triangle', 0.3);
        this.tone(1976, 0.35, 'triangle', 0.25, 0.08);
        this.noise(0.15, 0.15, 0.02, 6000);
        break;
      case 'coin': this.tone(988, 0.08, 'square', 0.12); this.tone(1318, 0.2, 'square', 0.12, 0.07); break;
      case 'door': this.tone(660, 0.15, 'sine', 0.2); this.tone(880, 0.3, 'sine', 0.2, 0.15); break;
      case 'click': this.tone(600, 0.04, 'triangle', 0.15); break;
      case 'error': this.tone(220, 0.18, 'sawtooth', 0.12); this.tone(180, 0.2, 'sawtooth', 0.12, 0.1); break;
      case 'pop': this.tone(420, 0.1, 'sine', 0.25, 0, 900); break;
      case 'place': this.noise(0.08, 0.3, 0, 300); this.tone(140, 0.1, 'sine', 0.3); break;
      case 'whoosh': this.noise(0.25, 0.2, 0, 800); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, i * 0.1)); break;
    }
  }

  /** Nhạc nền lofi đơn giản: hợp âm + bass + trống nhẹ. */
  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null || !this.musicOn) return;
    const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2]];
    const beat = 60 / 76 / 2;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) { this.step++; return; }
      const s = this.step++;
      const chord = chords[Math.floor(s / 8) % chords.length];
      const dest = this.musicGain;
      if (s % 8 === 0) chord.forEach((f) => this.tone(f, beat * 7, 'sine', 0.18, 0, undefined, dest));
      if (s % 4 === 0) this.tone(chord[0] / 2, beat * 1.5, 'triangle', 0.35, 0, undefined, dest);
      if (s % 2 === 1) this.noise(0.05, 0.15, 0, 7000, dest);
      if (s % 8 === 4) this.noise(0.12, 0.3, 0, 1800, dest);
      if (s % 3 === 0 && Math.random() < 0.5) this.tone(chord[(s >> 1) % 4] * 2, beat * 0.9, 'sine', 0.08, 0, undefined, dest);
    }, beat * 1000);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
