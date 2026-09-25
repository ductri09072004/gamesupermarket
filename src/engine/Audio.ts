import * as THREE from 'three';
import type { EventBus, GameEvents, SoundName } from '../core/EventBus';
import type { Settings } from '../core/GameState';
import { buildSoundBank } from './SoundBank';

/**
 * Âm thanh: THREE.AudioListener gắn vào camera, PositionalAudio cho âm 3D,
 * 3 kênh (sfx / nhạc / môi trường). Toàn bộ buffer tổng hợp bằng code.
 */
export class AudioEngine {
  readonly listener = new THREE.AudioListener();
  private bank: Map<string, AudioBuffer> | null = null;
  private sfx!: GainNode;
  private music!: GainNode;
  private ambient!: GainNode;
  private pool: THREE.PositionalAudio[] = [];
  private poolIndex = 0;
  private musicTimer: number | null = null;
  private step = 0;
  private crowd: AudioBufferSourceNode | null = null;
  private crowdGain!: GainNode;
  private settings: Settings | null = null;
  private offs: Array<() => void> = [];

  constructor(private scene: THREE.Scene) {
    const ctx = this.listener.context;
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.ambient = ctx.createGain();
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    for (const g of [this.sfx, this.music, this.ambient]) g.connect(this.listener.getInput());
    this.crowdGain.connect(this.ambient);
    const unlock = () => {
      void ctx.resume();
      this.ensureBank();
      this.startLoops();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get context(): AudioContext {
    return this.listener.context;
  }

  private ensureBank(): Map<string, AudioBuffer> {
    if (!this.bank) this.bank = buildSoundBank(this.context) as Map<string, AudioBuffer>;
    return this.bank;
  }

  attach(bus: EventBus<GameEvents>): void {
    this.offs.forEach((o) => o());
    this.offs = [bus.on('sound', ({ name, pos, pitch, volume }) => this.play(name, pos, pitch, volume))];
  }

  applySettings(st: Settings): void {
    this.settings = st;
    const t = this.context.currentTime;
    this.listener.setMasterVolume(st.muted ? 0 : st.volMaster);
    this.sfx.gain.setTargetAtTime(st.volSfx, t, 0.05);
    this.music.gain.setTargetAtTime(st.music ? st.volMusic * 0.35 : 0, t, 0.1);
    this.ambient.gain.setTargetAtTime(st.volAmbient, t, 0.1);
  }

  play(name: SoundName, pos?: { x: number; y: number; z: number }, pitch = 1, volume = 1): void {
    if (this.settings?.muted || this.context.state !== 'running') return;
    const buf = this.ensureBank().get(name);
    if (!buf) return;
    if (pos) {
      const a = this.positional();
      a.position.set(pos.x, pos.y, pos.z);
      if (a.isPlaying) a.stop();
      a.setBuffer(buf);
      a.setPlaybackRate(pitch);
      a.setVolume(volume);
      a.play();
      return;
    }
    const src = this.context.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.context.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfx);
    src.start();
  }

  private positional(): THREE.PositionalAudio {
    if (this.pool.length < 10) {
      const a = new THREE.PositionalAudio(this.listener);
      a.setRefDistance(2);
      a.setRolloffFactor(1.4);
      a.gain.disconnect();
      a.gain.connect(this.sfx);
      this.scene.add(a);
      this.pool.push(a);
      return a;
    }
    this.poolIndex = (this.poolIndex + 1) % this.pool.length;
    return this.pool[this.poolIndex];
  }

  /** Âm thanh lặp gắn vào vật (tiếng máy lạnh tủ đông). */
  attachHum(obj: THREE.Object3D, volume = 0.5): THREE.PositionalAudio {
    const a = new THREE.PositionalAudio(this.listener);
    a.setRefDistance(1.2);
    a.setRolloffFactor(2);
    a.setLoop(true);
    a.setVolume(volume);
    a.gain.disconnect();
    a.gain.connect(this.ambient);
    obj.add(a);
    const start = () => {
      if (a.isPlaying || this.context.state !== 'running') return;
      a.setBuffer(this.ensureBank().get('hum')!);
      a.offset = Math.random() * 1.5;
      a.play();
    };
    start();
    this.humStarters.push(start);
    return a;
  }

  private humStarters: Array<() => void> = [];

  /** Độ ồn đám đông theo số khách. */
  setCrowd(count: number): void {
    const v = Math.min(1, count / 18) * 0.35;
    this.crowdGain.gain.setTargetAtTime(v, this.context.currentTime, 1);
  }

  private startLoops(): void {
    this.humStarters.forEach((s) => s());
    if (!this.crowd && this.context.state === 'running') {
      this.crowd = this.context.createBufferSource();
      this.crowd.buffer = this.ensureBank().get('crowd')!;
      this.crowd.loop = true;
      this.crowd.connect(this.crowdGain);
      this.crowd.start();
    }
    this.startMusic();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.context;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Nhạc siêu thị nhẹ nhàng (electric piano + bass) sinh bằng oscillator. */
  private startMusic(): void {
    if (this.musicTimer !== null) return;
    const chords = [[261.6, 329.6, 392, 493.9], [220, 277.2, 329.6, 415.3], [293.7, 349.2, 440, 523.3], [196, 246.9, 293.7, 392]];
    const melody = [0, 2, 1, 3, 2, 1, 0, 1];
    const beat = 60 / 92 / 2;
    this.musicTimer = window.setInterval(() => {
      if (this.context.state !== 'running' || !this.settings?.music || this.settings.muted) { this.step++; return; }
      const s = this.step++;
      const chord = chords[Math.floor(s / 8) % chords.length];
      if (s % 8 === 0) chord.forEach((f) => this.tone(f, beat * 7.5, 'sine', 0.12));
      if (s % 4 === 0) this.tone(chord[0] / 2, beat * 3, 'triangle', 0.3);
      if (s % 2 === 0) this.tone(chord[melody[(s / 2) % 8]] * 2, beat * 1.6, 'sine', 0.07);
    }, beat * 1000);
  }

  destroy(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.offs.forEach((o) => o());
  }
}
